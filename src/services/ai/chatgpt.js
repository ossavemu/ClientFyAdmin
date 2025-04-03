import fs from "fs";
import OpenAI from "openai";
import { config } from "../../config/index.js";
import { prompt as metaPrompt } from "../../prompt.js";
import { logger } from "../setup/logger.js";
import { assistantService } from "./assistantService.js";
import { cacheService } from "./cacheService.js";
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

// Caché para los vectorStores creados (se migrará gradualmente a cacheService)
export const vectorStoreCache = new Map();
// Caché para los threads para evitar creaciones repetidas (se migrará a cacheService)
export const threadCache = new Map();

// Función para limpiar la caché de threads
export const clearThreadCache = (userPhoneNumber = null) => {
  const botNumber = config.P_NUMBER;

  if (userPhoneNumber) {
    // Limpiar thread para un usuario específico
    const cacheKey = `${botNumber}:${userPhoneNumber}`;
    const threadId = threadCache.has(cacheKey)
      ? threadCache.get(cacheKey).id
      : "desconocido";
    threadCache.delete(cacheKey);
    logger.info(
      `✅ Thread ${threadId} eliminado de caché para usuario ${userPhoneNumber}`
    );

    // También limpiar del caché centralizado si existe
    if (cacheService.threads.has(cacheKey)) {
      cacheService.threads.delete(cacheKey);
      logger.info(
        `✅ Thread también eliminado del caché centralizado para usuario ${userPhoneNumber}`
      );
    }

    return true;
  } else {
    // Limpiar todos los threads
    const count = threadCache.size;
    threadCache.clear();
    logger.info(
      `✅ Caché completa de threads limpiada (${count} threads eliminados)`
    );
    return true;
  }
};

// Función para almacenar un vector store en la caché (usado en la inicialización)
export const cacheVectorStore = (botNumber, vectorStoreId) => {
  if (botNumber && vectorStoreId) {
    vectorStoreCache.set(botNumber, vectorStoreId);
    // También almacenar en el nuevo servicio centralizado
    cacheService.vectorStores.set(botNumber, vectorStoreId);
    logger.info(
      `✅ Vector store ${vectorStoreId} almacenado en caché para bot ${botNumber}`
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

// Función para obtener archivos de entrenamiento con preferencia al caché centralizado
async function getTrainingFilesFromCache(botNumber) {
  // Usar la misma clave de caché que en trainingService
  const cacheKey = config.P_NUMBER;

  logger.debug(
    `[CHATGPT] Buscando archivos en caché para ${botNumber} (clave caché: ${cacheKey})`
  );

  // Verificar primero si están en el caché centralizado
  if (cacheService.training.has(cacheKey)) {
    const cachedFiles = cacheService.training.get(cacheKey);
    logger.info(
      `[CHATGPT] ⚡ USANDO CACHÉ CENTRALIZADO: ${cachedFiles.length} archivos (desde getTrainingFilesFromCache)`
    );
    return cachedFiles;
  }

  // Si no están en caché, obtenerlos de la API y guardarlos en caché
  logger.info(
    `[CHATGPT] 🔍 Archivos NO ENCONTRADOS en caché, solicitando desde API...`
  );
  const files = await trainingService.getTrainingFiles(botNumber);

  // No necesitamos guardar en caché nuevamente ya que trainingService ya lo hace
  logger.debug(
    `[CHATGPT] Se obtuvieron ${files.length} archivos de trainingService`
  );

  return files;
}

// Función para obtener o crear un vector store para el asistente - con memoria caché
async function getOrCreateVectorStore(botNumber, assistantId) {
  // Verificar caché primero
  if (vectorStoreCache.has(botNumber)) {
    return vectorStoreCache.get(botNumber);
  }

  try {
    // Obtener archivos de entrenamiento usando el caché centralizado
    const trainingFiles = await getTrainingFilesFromCache(botNumber);
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

    // SOLUCIÓN: Crear siempre un nuevo thread para evitar respuestas repetitivas
    // No reutilizar threads de la caché
    logger.debug(
      `[CHATGPT] Creando nuevo thread para pregunta: ${question.substring(
        0,
        30
      )}...`
    );
    thread = await openai.beta.threads.create();
    logger.debug(`[CHATGPT] Nuevo thread creado: ${thread.id}`);

    // Almacenar el nuevo thread en caché
    threadCache.set(cacheKey, thread);

    // También almacenar en el caché centralizado
    cacheService.threads.set(cacheKey, thread);

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

    // IMPORTANTE: Añadir instrucción específica para evitar mensajes de bienvenida repetitivos
    const additionalInstruction = `
      INSTRUCCIÓN IMPORTANTE: 
      1. Responde directamente a la pregunta del usuario.
      2. NO repitas mensajes de bienvenida o introducciones si el usuario ya está haciendo preguntas específicas.
      3. Si el usuario pregunta por información específica como precios, web page, características, responde con esa información exacta.
      4. Mantén un tono profesional pero conversacional, contestando lo que se te pregunta.
    `;

    const instructions = `${config.defaultPrompt(
      userName
    )}\n\n${businessInfo}\n\n${customPrompt}\n\n${additionalInstruction}`;

    // Ejecutar el asistente
    logger.debug(
      `[CHATGPT] Ejecutando asistente ${assistantId} en thread ${thread.id}`
    );

    // Verificar y cancelar ejecuciones activas anteriores en el mismo thread
    try {
      const runs = await openai.beta.threads.runs.list(thread.id, { limit: 5 }); // Revisar las últimas 5 por si acaso
      const activeRuns = runs.data.filter((run) =>
        ["queued", "in_progress", "cancelling"].includes(run.status)
      );

      if (activeRuns.length > 0) {
        logger.warn(
          `[CHATGPT] ⚠️ Encontradas ${activeRuns.length} ejecuciones activas para thread ${thread.id}. Intentando cancelar...`
        );
        for (const activeRun of activeRuns) {
          logger.debug(
            `[CHATGPT] Cancelando run ${activeRun.id} con estado ${activeRun.status}`
          );
          try {
            await openai.beta.threads.runs.cancel(thread.id, activeRun.id);
            logger.info(`[CHATGPT] ✅ Ejecución ${activeRun.id} cancelada.`);
          } catch (cancelError) {
            // Si el error es porque la ejecución ya no está activa (se completó/falló mientras tanto), ignorarlo
            if (
              cancelError.status === 400 &&
              cancelError.message.includes("cannot be cancelled")
            ) {
              logger.warn(
                `[CHATGPT] No se pudo cancelar la ejecución ${activeRun.id} (probablemente ya terminó): ${cancelError.message}`
              );
            } else {
              logger.error(
                `[CHATGPT] ❌ Error al cancelar la ejecución ${activeRun.id}`,
                cancelError
              );
              // Decidir si continuar o no - por ahora continuaremos
            }
          }
        }
        // Dar un pequeño respiro para que la cancelación se procese
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (listRunError) {
      logger.error(
        `[CHATGPT] ❌ Error al listar ejecuciones para ${thread.id}`,
        listRunError
      );
      // Continuar de todos modos, pero registrar el error
    }

    // Crear y esperar la nueva ejecución
    logger.debug(`[CHATGPT] Creando nueva ejecución para thread ${thread.id}`);
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistantId,
      instructions: instructions,
    });

    logger.info(
      `[CHATGPT] ✅ Ejecución ${run.id} completada con estado: ${run.status}`
    );

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
        const files = await getTrainingFilesFromCache(botNumber);
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
