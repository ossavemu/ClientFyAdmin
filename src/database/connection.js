import { createClient } from "@libsql/client";
import { config } from "../config/index.js";

if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
  throw new Error("Missing Turso configuration. Please check your .env file");
}

// Crear un pool de conexiones
let tursoClient = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

async function getClient() {
  if (!tursoClient) {
    tursoClient = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
    });
  }
  return tursoClient;
}

async function executeWithRetry(operation, retries = MAX_RETRIES) {
  try {
    const client = await getClient();
    return await operation(client);
  } catch (error) {
    if (
      retries > 0 &&
      (error.code === "ECONNRESET" || error.code === "ENOTFOUND")
    ) {
      console.log(`Retrying operation, ${retries} attempts remaining...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      tursoClient = null; // Reset client on error
      return executeWithRetry(operation, retries - 1);
    }
    throw error;
  }
}

export const db = {
  sql: async (strings, ...values) => {
    const query = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? `?` : "");
    }, "");

    return executeWithRetry(async (client) => {
      try {
        const result = await client.execute({
          sql: query,
          args: values.filter((v) => v !== undefined),
        });
        return result.rows || [];
      } catch (error) {
        console.error("Error executing query:", query, error);
        throw error;
      }
    });
  },

  async testConnection() {
    return executeWithRetry(async (client) => {
      try {
        const result = await client.execute({
          sql: "SELECT 1 as test",
          args: [],
        });
        return result?.rows?.length > 0;
      } catch (error) {
        console.error("Database connection error:", error);
        return false;
      }
    });
  },

  // Método para cerrar la conexión explícitamente si es necesario
  async close() {
    if (tursoClient) {
      try {
        await tursoClient.close();
        tursoClient = null;
      } catch (error) {
        console.error("Error closing database connection:", error);
      }
    }
  },
};

// Manejar el cierre de conexión al terminar el proceso
process.on("SIGINT", async () => {
  await db.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await db.close();
  process.exit(0);
});
