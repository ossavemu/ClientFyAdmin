import { db } from "../src/database/connection.js";
import { wsUserService } from "../src/services/wsUserService.js";

async function testAllMigrations() {
  try {
    console.log("🚀 Iniciando pruebas completas...\n");

    // 1. Probar usuarios y mensajes
    console.log("1️⃣ Probando usuarios y mensajes...");
    await testUsersAndMessages();

    // 2. Probar agenda
    console.log("\n2️⃣ Probando agenda...");
    await testAgenda();

    // 3. Probar asistentes de bot
    console.log("\n3️⃣ Probando asistentes de bot...");
    await testBotAssistants();

    console.log("\n✅ Todas las pruebas completadas exitosamente");
  } catch (error) {
    console.error("\n❌ Error durante las pruebas:", error);
  } finally {
    process.exit(0);
  }
}

async function testUsersAndMessages() {
  // Crear usuario y registrar interacciones
  const user = await wsUserService.createOrUpdateUser(
    "573001234567",
    "Usuario Test"
  );
  console.log("Usuario creado:", user);

  // Registrar mensajes de diferentes tipos
  await wsUserService.logInteraction("573001234567", "text", "Hola bot");
  await wsUserService.logInteraction(
    "000000000000",
    "text",
    "Respuesta Meta",
    "meta"
  );
  await wsUserService.logInteraction(
    "bot_baileys",
    "text",
    "Respuesta Baileys",
    "baileys"
  );

  // Verificar histórico
  const historic =
    await db.sql`SELECT * FROM historic ORDER BY created_at DESC LIMIT 3`;
  console.log("Histórico de mensajes:", historic);
}

async function testAgenda() {
  // Crear una cita
  const appointment = await db.sql`
    INSERT INTO agenda (phone_number, scheduled_at, email, name, zoom_link)
    VALUES ('573001234567', datetime('now', '+1 hour'), 'test@test.com', 'Test User', 'https://zoom.us/test')
    RETURNING *
  `;
  console.log("Cita creada:", appointment);

  // Verificar próximas citas
  const upcoming = await db.sql`SELECT * FROM upcoming_appointments`;
  console.log("Próximas citas:", upcoming);
}

async function testBotAssistants() {
  // Crear un asistente para Meta
  await db.sql`
    INSERT INTO bot_assistants (bot_number, assistant_id)
    VALUES ('000000000000', 'asst_test_meta')
  `;

  // Crear un asistente para Baileys
  await db.sql`
    INSERT INTO bot_assistants (bot_number, assistant_id)
    VALUES ('bot_baileys', 'asst_test_baileys')
  `;

  // Verificar asistentes
  const assistants = await db.sql`
    SELECT bn.provider, ba.* 
    FROM bot_assistants ba
    JOIN bot_numbers bn ON ba.bot_number = bn.phone_number
  `;
  console.log("Asistentes configurados:", assistants);
}

testAllMigrations();
