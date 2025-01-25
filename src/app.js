import { createBot, MemoryDB as Database } from "@builderbot/bot";
import { config } from "./config/index.js";
import { db } from "./database/connection.js";
import { providerBaileys, providerMeta } from "./provider/index.js";
import { reminder } from "./services/reminder.js";
import templates from "./templates/index.js";
import { webServer } from "./web/server.js";

const PORT = config.PORT;

// Función para logs limpios
const log = (message, error = false) => {
  const timestamp = new Date().toISOString();
  const prefix = error ? "❌ ERROR:" : "✅ INFO:";
  console.log(`[${timestamp}] ${prefix} ${message}`);
};

const main = async () => {
  try {
    log("Iniciando aplicación...");
    await db.testConnection();
    log("Conexión a base de datos establecida");

    const adapterFlow = templates;
    let adapterProvider;
    let botNumber;

    if (config.provider === "meta") {
      adapterProvider = providerMeta;
      botNumber = config.numberId;
      log(`Usando provider Meta (${botNumber})`);
    } else if (config.provider === "baileys") {
      adapterProvider = providerBaileys;
      botNumber = config.P_NUMBER;
      log(`Usando provider Baileys (${botNumber})`);
    } else {
      throw new Error("ERROR: Provider no válido en .env");
    }

    // Registrar el bot en la base de datos
    try {
      log("Registrando bot en la base de datos...");
      await db.sql`
        INSERT INTO ws_users (phone_number, name)
        VALUES (${botNumber}, ${`Bot ${config.provider}`})
        ON CONFLICT (phone_number) DO NOTHING
      `;

      await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${botNumber}, ${config.provider})
        ON CONFLICT (phone_number) DO NOTHING
      `;
      log(`Bot registrado exitosamente: ${botNumber} (${config.provider})`);
    } catch (error) {
      log(`Error registrando bot: ${error.message}`, true);
      throw error;
    }

    const adapterDB = new Database();

    const { httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    httpServer(+PORT);
    log(`Servidor iniciado en puerto ${PORT}`);

    reminder(adapterProvider);
    log("Servicio de recordatorios iniciado");

    log("Bot y servicios iniciados correctamente");

    // Iniciar servidor web usando el puerto configurado
    webServer.listen(config.WEB_PORT, () => {
      log(`Panel web iniciado en puerto ${config.WEB_PORT}`);
    });
  } catch (error) {
    log(error.message, true);
    process.exit(1);
  }
};

main();
