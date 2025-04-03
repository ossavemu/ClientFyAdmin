import { createBot, MemoryDB as Database } from "@builderbot/bot";
import fs from "fs";
import OpenAI from "openai";
import { config } from "./config/index.js";
import { assistantService } from "./services/ai/assistantService.js";
import { cacheVectorStore, vectorStoreCache } from "./services/ai/chatgpt.js";
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

// Cache de recursos precarargados para evitar operaciones duplicadas
const resourceCache = {
  assistantIds: new Map(),
  trainingFiles: new Map(),
  images: new Map(),
  vectorStores: new Map(),
};

// Función para precargar recursos de AI de manera optimizada
const preloadAIResources = async (botNumber) => {
  try {
    logger.info("Precargando recursos de IA...");

    // Verificar si los recursos ya están en caché
    if (resourceCache.assistantIds.has(botNumber)) {
      logger.info(`Usando recursos en caché para el bot ${botNumber}`);
      return {
        assistantId: resourceCache.assistantIds.get(botNumber),
        trainingFiles: resourceCache.trainingFiles.get(botNumber) || [],
        images: resourceCache.images.get(botNumber) || [],
      };
    }

    // Obtener el asistente (o crearlo si no existe)
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );
    resourceCache.assistantIds.set(botNumber, assistantId);
    logger.info(`Asistente cargado con ID: ${assistantId}`);

    // Precargar archivos de entrenamiento - hacer esto de manera asíncrona
    let trainingFilesPromise = trainingService
      .getTrainingFiles(botNumber)
      .then((files) => {
        resourceCache.trainingFiles.set(botNumber, files);
        logger.info(`Archivos de entrenamiento cargados: ${files.length}`);
        return files;
      });

    // Precargar imágenes - hacer esto de manera asíncrona
    let imagesPromise = imageService.getImages(botNumber).then((images) => {
      resourceCache.images.set(botNumber, images);
      logger.info(`Imágenes precargadas: ${images.length}`);
      return images;
    });

    // Esperar a que ambas operaciones terminen
    const [trainingFiles, images] = await Promise.all([
      trainingFilesPromise,
      imagesPromise,
    ]);

    // Crear el vector store con los archivos de entrenamiento si no existe en cache
    if (trainingFiles.length > 0 && !vectorStoreCache.has(botNumber)) {
      // Crear el vector store en segundo plano
      createVectorStore(botNumber, trainingFiles, assistantId).catch((error) =>
        logger.error("Error creando vector store en segundo plano:", error)
      );
    } else {
      logger.info(
        "Vector store ya existe o no hay archivos de entrenamiento disponibles"
      );
    }

    return { assistantId, trainingFiles, images };
  } catch (error) {
    logger.error("Error precargando recursos de IA:", error);
    return { assistantId: null, trainingFiles: [], images: [] };
  }
};

// Función para crear vector store en segundo plano
const createVectorStore = async (botNumber, trainingFiles, assistantId) => {
  logger.info("Creando vector store en segundo plano...");
  try {
    // Subir archivos a OpenAI para el vector store - solo los que existen
    const filePromises = trainingFiles
      .filter((file) => file.localPath && fs.existsSync(file.localPath))
      .map(async (file) => {
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
};

const main = async () => {
  try {
    logger.info("Iniciando aplicación...");

    // Iniciar servicios en paralelo para ahorrar tiempo de inicio
    const initPromises = [
      // Verificar conexión a base de datos
      databaseService
        .testConnection()
        .then(() => logger.info("Conexión a base de datos establecida"))
        .catch((error) => {
          logger.error("Error conectando a base de datos:", error);
          throw error;
        }),

      // Obtener provider y registrar bot
      (async () => {
        const { provider: adapterProvider, botNumber } =
          providerService.getProvider();
        await databaseService.registerBot(botNumber, config.provider);
        return { adapterProvider, botNumber };
      })(),
    ];

    // Esperar a que se completen las operaciones críticas
    const [_, { adapterProvider, botNumber }] = await Promise.all(initPromises);

    // Precargar recursos de IA en segundo plano
    preloadAIResources(botNumber).catch((error) =>
      logger.error("Error precargando recursos de IA:", error)
    );

    // Iniciar el bot
    const adapterDB = new Database();
    const { httpServer } = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
    });

    // Iniciar servicios de forma asíncrona
    const startServices = async () => {
      try {
        // Iniciar servidor HTTP
        httpServer(config.PORT);
        logger.info(`Servidor iniciado en puerto ${config.PORT}`);

        // Iniciar servicio de recordatorios
        reminder(adapterProvider);
        logger.info("Servicio de recordatorios iniciado");

        // Iniciar panel web
        webServer.listen(config.WEB_PORT, () => {
          logger.info(`Panel web iniciado en puerto ${config.WEB_PORT}`);
        });

        // Iniciar verificación de estado del bot
        botService.startStatusCheck();
        logger.info("Bot y servicios iniciados correctamente");
      } catch (error) {
        logger.error("Error iniciando servicios:", error);
      }
    };

    // Iniciar servicios
    startServices();
  } catch (error) {
    logger.error("Error crítico iniciando aplicación:", error);
    process.exit(1);
  }
};

// Si estamos ejecutando en producción, manejar excepciones no capturadas
if (process.env.NODE_ENV === "production") {
  // Manejar excepciones no capturadas para evitar caídas del servidor
  process.on("uncaughtException", (error) => {
    logger.error("Excepción no capturada:", error);
    // No cerramos el proceso, solo registramos el error
  });

  // Manejar rechazos de promesas no capturados
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Rechazo de promesa no manejado:", reason);
    // No cerramos el proceso, solo registramos el error
  });
}

main();
