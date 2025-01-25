import { createClient } from "@libsql/client";
import { config } from "../config/index.js";

if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
  throw new Error("Missing Turso configuration. Please check your .env file");
}

const turso = createClient({
  url: config.TURSO_DATABASE_URL,
  authToken: config.TURSO_AUTH_TOKEN,
});

export const db = {
  sql: async (strings, ...values) => {
    // Construir la consulta SQL con los valores
    const query = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? `?` : "");
    }, "");

    try {
      // Ejecutar la consulta con los valores como parámetros
      const result = await turso.execute({
        sql: query,
        args: values.filter((v) => v !== undefined),
      });
      return result.rows || [];
    } catch (error) {
      console.error("Error executing query:", query, error);
      throw error;
    }
  },

  async testConnection() {
    try {
      const result = await turso.execute({
        sql: "SELECT 1 as test",
        args: [],
      });

      if (result?.rows?.length > 0) {
        return true;
      }
      return false;
    } catch (error) {
      console.error("Database connection error:", error);
      return false;
    }
  },
};
