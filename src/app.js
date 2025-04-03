import { createBot, MemoryDB as Database } from "@builderbot/bot";
import { config } from "./config/index.js";
import { assistantService } from "./services/ai/assistantService.js";
import { trainingService } from "./services/ai/trainingService.js";
import { databaseService } from "./services/data/databaseService.js";
import { reminder } from "./services/features/reminder.js";
import { botService } from "./services/setup/botService.js";
import { imageService } from "./services/setup/imageService.js";
import { logger } from "./services/setup/logger.js";
import { providerService } from "./services/setup/providerService.js";
import templates from "./templates/index.js";
import { webServer } from "./web/server.js";

// Función para precargar recursos de AI
const preloadAIResources = async (botNumber) => {
  try {
    logger.info("Precargando recursos de IA...");

    // Obtener el asistente (o crearlo si no existe)
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );
    logger.info(`Asistente cargado con ID: ${assistantId}`);

    // Precargar archivos de entrenamiento
    const trainingFiles = await trainingService.getTrainingFiles(botNumber);
    logger.info(`Archivos de entrenamiento cargados: ${trainingFiles.length}`);

    // Precargar imágenes
    const images = await imageService.getImages(botNumber);
    logger.info(`Imágenes precargadas: ${images.length}`);

    return { assistantId, trainingFiles, images };
  } catch (error) {
    logger.error("Error precargando recursos de IA:", error);
    return { assistantId: null, trainingFiles: [], images: [] };
  }
};

const main = async () => {
  try {
    logger.info("Iniciando aplicación...");
    await databaseService.testConnection();
    logger.info("Conexión a base de datos establecida");

    const { provider: adapterProvider, botNumber } =
      providerService.getProvider();
    await databaseService.registerBot(botNumber, config.provider);

    // Precargar recursos de IA
    await preloadAIResources(botNumber);

    const adapterDB = new Database();
    const { httpServer } = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
    });

    httpServer(config.PORT);
    logger.info(`Servidor iniciado en puerto ${config.PORT}`);

    reminder(adapterProvider);
    logger.info("Servicio de recordatorios iniciado");

    webServer.listen(config.WEB_PORT, () => {
      logger.info(`Panel web iniciado en puerto ${config.WEB_PORT}`);
    });

    botService.startStatusCheck();
    logger.info("Bot y servicios iniciados correctamente");
  } catch (error) {
    logger.error("Error iniciando aplicación:", error);
    process.exit(1);
  }
};

main();
