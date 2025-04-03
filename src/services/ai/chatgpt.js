import fs from "fs";
import OpenAI from "openai";
import { config } from "../../config/index.js";
import { prompt as metaPrompt } from "../../prompt.js";
import { logger } from "../setup/logger.js";
import { assistantService } from "./assistantService.js";
import { getPrompt } from "./promptService.js";
import { trainingService } from "./trainingService.js";

// Inicializar OpenAI una sola vez y usar singleton
let openaiInstance = null;
const getOpenAI = () => {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey: config.openai_apikey });
  }
  return openaiInstance;
};

// Caché para los vectorStores creados
export const vectorStoreCache = new Map();
// Caché para los threads para evitar creaciones repetidas
const threadCache = new Map();

// Función para almacenar un vector store en la caché (usado en la inicialización)
export const cacheVectorStore = (botNumber, vectorStoreId) => {
  if (botNumber && vectorStoreId) {
    vectorStoreCache.set(botNumber, vectorStoreId);
    logger.info(
      `Vector store ${vectorStoreId} almacenado en caché para bot ${botNumber}`
    );
    return true;
  }
  return false;
};

// Función para formatear el número de teléfono - refactorizada para ser más eficiente
const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  // Usar una sola expresión regular para limpiar
  const cleaned = phone.toString().replace(/\D/g, "");

  // Agregar prefijo solo si es necesario
  const formatted = cleaned.startsWith("57") ? cleaned : `57${cleaned}`;

  // Validación simple de longitud
  if (formatted.length < 12) {
    logger.warn(`Número inválido: ${formatted} (longitud < 12)`);
    return null;
  }

  return formatted;
};

// Función para obtener o crear un vector store para el asistente - con memoria caché
async function getOrCreateVectorStore(botNumber, assistantId) {
  // Verificar caché primero
  if (vectorStoreCache.has(botNumber)) {
    return vectorStoreCache.get(botNumber);
  }

  try {
    // Obtener archivos de entrenamiento
    const trainingFiles = await trainingService.getTrainingFiles(botNumber);
    if (trainingFiles.length === 0) {
      return null;
    }

    const openai = getOpenAI();

    // Filtrar archivos que realmente existen antes de procesarlos
    const existingFiles = trainingFiles.filter(
      (file) => file.localPath && fs.existsSync(file.localPath)
    );

    if (existingFiles.length === 0) {
      logger.warn(
        "Ninguno de los archivos de entrenamiento existe en el sistema"
      );
      return null;
    }

    // Subir archivos con un límite de concurrencia (máximo 3 a la vez)
    const fileIds = [];
    const concurrencyLimit = 3;
    for (let i = 0; i < existingFiles.length; i += concurrencyLimit) {
      const batch = existingFiles.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const uploadedFile = await openai.files.create({
              file: fs.createReadStream(file.localPath),
              purpose: "assistants",
            });
            return uploadedFile.id;
          } catch (err) {
            logger.error(`Error subiendo archivo ${file.name}:`, err);
            return null;
          }
        })
      );
      fileIds.push(...batchResults.filter((id) => id !== null));
    }

    if (fileIds.length === 0) {
      logger.warn("No se pudo subir ningún archivo a OpenAI");
      return null;
    }

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

    // Guardar en caché
    vectorStoreCache.set(botNumber, vectorStore.id);
    return vectorStore.id;
  } catch (error) {
    logger.error("Error creando vectorStore", error);
    return null;
  }
}

// Función principal de chat optimizada
export const chat = async (
  question,
  userPhoneNumber,
  userName = null,
  thread = null,
  provider = "baileys"
) => {
  try {
    const openai = getOpenAI();
    const botNumber = config.P_NUMBER;

    // Log del mensaje entrante
    logger.info(`[USUARIO ${userPhoneNumber}]: ${question}`);

    // Crear clave de cache usando botNumber y userPhoneNumber
    const cacheKey = `${botNumber}:${userPhoneNumber}`;

    // Obtener prompt según el provider
    let customPrompt;
    if (provider === "meta" || config.provider === "meta") {
      logger.info("Usando prompt específico para Meta");
      customPrompt = metaPrompt;
    } else {
      // Obtener el prompt normal para otros providers
      customPrompt = await getPrompt(botNumber);
    }

    // Obtener asistente
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );

    // Determinar si es un nuevo thread o usar uno existente
    const isFirstMessage = !thread;
    if (!thread) {
      // Usar thread de caché si existe
      if (threadCache.has(cacheKey)) {
        thread = threadCache.get(cacheKey);
        logger.debug(`Usando thread en caché: ${thread.id}`);
      } else {
        // Crear nuevo thread
        thread = await openai.beta.threads.create();
        threadCache.set(cacheKey, thread);
        logger.debug(`Nuevo thread creado y almacenado en caché: ${thread.id}`);

        // Verificar si hay vector store o necesitamos crearlo - en segundo plano
        if (!vectorStoreCache.has(botNumber)) {
          getOrCreateVectorStore(botNumber, assistantId).catch((err) =>
            logger.error("Error creando vector store en segundo plano:", err)
          );
        }
      }
    }

    // Agregar el mensaje del usuario al thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    // Preparar instrucciones básicas para el asistente
    const businessInfo = `
      Representas a: ${config.company_name || "nuestra empresa"}
      Ubicación: ${config.company_address || "dirección no especificada"}
    `;

    const instructions = `${config.defaultPrompt(
      userName
    )}\n\n${businessInfo}\n\n${customPrompt}`;

    // Ejecutar el asistente
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistantId,
      instructions: instructions,
    });

    // Procesar respuesta
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(run.thread_id);

      // Obtener la última respuesta del asistente
      const assistantResponse = messages.data
        .filter((message) => message.role === "assistant")
        .pop();

      if (!assistantResponse) {
        return {
          thread,
          response: "Lo siento, no pude generar una respuesta.",
        };
      }

      // Obtener la respuesta del asistente
      const answer = assistantResponse.content[0].text.value;

      // Log de la respuesta
      logger.info(
        `[ASISTENTE → ${userPhoneNumber}]: ${answer.substring(0, 100)}${
          answer.length > 100 ? "..." : ""
        }`
      );

      // Procesar comandos especiales
      if (answer.includes("!list_files")) {
        const files = await trainingService.getTrainingFiles(botNumber);
        const fileList = files
          .map((f, index) => `${index + 1}. ${f.name}`)
          .join("\n");
        const response = `Aquí están los documentos disponibles:\n${fileList}\n\nPuedes pedirme cualquiera por su nombre o número. ¿Cuál te gustaría recibir?`;

        return { thread, response };
      }

      return { thread, response: answer };
    } else {
      logger.error(`Error en la conversación: ${run.status}`);
      return {
        thread,
        response: "Lo siento, hubo un problema al procesar tu mensaje.",
      };
    }
  } catch (error) {
    logger.error("Error en chat service:", error);
    return {
      thread: null,
      response: "Lo siento, ocurrió un error en el servicio de chat.",
    };
  }
};
