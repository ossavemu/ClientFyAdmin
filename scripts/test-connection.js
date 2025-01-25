import { db } from "../src/database/connection.js";

async function testConnection() {
  try {
    const connected = await db.testConnection();
    if (connected) {
      console.log("✅ Conexión a Turso exitosa");
      process.exit(0);
    } else {
      console.error("❌ Error al conectar a Turso");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testConnection();
