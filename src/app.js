import { createBot, MemoryDB as Database } from "@builderbot/bot";
import fs from "fs";
import OpenAI from "openai";
import { config } from "./config/index.js";
import { assistantService } from "./services/ai/assistantService.js";
import { cacheVectorStore } from "./services/ai/chatgpt.js";
import { trainingService } from "./services/ai/trainingService.js";
import { databaseService } from "./services/data/databaseService.js";
import { reminder } from "./services/features/reminder.js";
import { botService } from "./services/setup/botService.js";
import { imageService } from "./services/setup/imageService.js";
import { logger } from "./services/setup/logger.js";
import { providerService } from "./services/setup/providerService.js";
import templates from "./templates/index.js";
import { webServer } from "./web/server.js";

// Inicializar OpenAI una sola vez
const openai = new OpenAI({ apiKey: config.openai_apikey });

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

    // Crear el vector store con los archivos de entrenamiento
    if (trainingFiles.length > 0) {
      logger.info("Precargando vector store para el asistente...");
      try {
        // Subir archivos a OpenAI para el vector store
        const filePromises = trainingFiles.map(async (file) => {
          if (!file.localPath || !fs.existsSync(file.localPath)) {
            logger.warn(`Archivo no encontrado: ${file.name}`);
            return null;
          }

          const uploadedFile = await openai.files.create({
            file: fs.createReadStream(file.localPath),
            purpose: "assistants",
          });
          return uploadedFile.id;
        });

        const fileIds = (await Promise.all(filePromises)).filter(
          (id) => id !== null
        );

        if (fileIds.length > 0) {
          // Crear vector store
          const vectorStore = await openai.beta.vectorStores.create({
            name: `VectorStore-${botNumber}-${Date.now()}`,
            file_ids: fileIds,
          });

          // Actualizar el assistant con el vector store
          await openai.beta.assistants.update(assistantId, {
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id],
              },
            },
          });

          // Almacenar el vector store en la caché para uso futuro
          cacheVectorStore(botNumber, vectorStore.id);
          logger.info(`Vector store creado con éxito: ${vectorStore.id}`);
        } else {
          logger.warn("No se pudieron procesar archivos para el vector store");
        }
      } catch (error) {
        logger.error("Error creando vector store:", error);
      }
    } else {
      logger.warn(
        "No hay archivos de entrenamiento disponibles para crear vector store"
      );
    }

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
