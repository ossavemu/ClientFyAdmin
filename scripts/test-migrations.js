import { db } from "../src/database/connection.js";

const testMigrations = async () => {
  try {
    console.log("🔄 Iniciando pruebas de migración...");

    // Probar inserción de bots
    const bots = await db.sql`SELECT * FROM bot_numbers`;
    console.log("📱 Bots registrados:", bots);

    // Probar inserción de usuario
    await db.sql`
      INSERT INTO ws_users (phone_number, name) 
      VALUES ('573001234567', 'Test User')
    `;

    // Probar inserción en historic
    await db.sql`
      INSERT INTO historic (
        phone_number, 
        bot_number,
        message_type, 
        message_content, 
        provider
      ) VALUES (
        '573001234567',
        '573053483248',
        'text',
        'Mensaje de prueba',
        'user'
      )
    `;

    const historic = await db.sql`SELECT * FROM historic`;
    console.log("📝 Registros históricos:", historic);

    console.log("✅ Pruebas completadas exitosamente");
  } catch (error) {
    console.error("❌ Error en las pruebas:", error);
    process.exit(1);
  }
};

testMigrations();
