import fs from "fs";
import OpenAI from "openai";
import { config } from "../../config/index.js";
import { assistantService } from "./assistantService.js";
import { getPrompt } from "./promptService.js";
import { trainingService } from "./trainingService.js";

// Inicializar OpenAI una sola vez
const openai = new OpenAI({ apiKey: config.openai_apikey });

// Caché para los vectorStores creados
const vectorStoreCache = new Map();

// Función para formatear el número de teléfono
const formatPhoneNumber = (phone) => {
  console.log("Número original:", phone);

  // Eliminar todos los caracteres que no sean números
  const cleaned = phone.toString().replace(/\D/g, "");
  console.log("Número limpio:", cleaned);

  // Asegurarse de que tenga el formato correcto (agregar 57 si no lo tiene)
  const formatted = cleaned.startsWith("57") ? cleaned : `57${cleaned}`;
  console.log("Número formateado:", formatted);

  // Asegurarse de que tenga al menos 10 dígitos después del prefijo
  if (formatted.length < 12) {
    console.log("Longitud inválida:", formatted.length);
    throw new Error(
      `Número de teléfono inválido: longitud ${formatted.length}, se requieren al menos 12 dígitos`
    );
  }

  return formatted;
};

// Función para obtener o crear un vector store para el asistente
async function getOrCreateVectorStore(botNumber, assistantId) {
  // Verificar si ya tenemos un vector store en caché
  if (vectorStoreCache.has(botNumber)) {
    console.log(`Usando vectorStore en caché para ${botNumber}`);
    return vectorStoreCache.get(botNumber);
  }

  console.log(`Creando nuevo vectorStore para ${botNumber}`);

  // Obtener archivos de entrenamiento
  const trainingFiles = await trainingService.getTrainingFiles(botNumber);
  if (trainingFiles.length === 0) {
    console.log("No hay archivos de entrenamiento disponibles");
    return null;
  }

  try {
    // Subir archivos a OpenAI
    console.log("Subiendo archivos a OpenAI...");
    const filePromises = trainingFiles.map(async (file) => {
      const uploadedFile = await openai.files.create({
        file: fs.createReadStream(file.localPath),
        purpose: "assistants",
      });
      return uploadedFile.id;
    });

    const fileIds = await Promise.all(filePromises);

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

    // Limpiar archivos temporales
    trainingFiles.forEach((file) => {
      if (file.localPath && fs.existsSync(file.localPath)) {
        console.log("Limpiando archivo temporal:", file.localPath);
        fs.unlinkSync(file.localPath);
      }
    });

    return vectorStore.id;
  } catch (error) {
    console.error("Error creando vectorStore:", error);
    return null;
  }
}

export const chat = async (
  question,
  userPhoneNumber,
  userName = null,
  thread = null,
  provider = "baileys"
) => {
  try {
    // Determinar el número del bot según el provider
    const botNumber = provider === "meta" ? "000000000000" : config.P_NUMBER;

    console.log(
      "Iniciando chat con bot número:",
      botNumber,
      "usuario:",
      userPhoneNumber,
      "provider:",
      provider
    );

    // Obtener el prompt desde la API
    const prompt = await getPrompt(botNumber);

    // Obtener o crear el assistant_id para este bot
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );

    // Si no hay thread, crear uno nuevo
    if (!thread) {
      console.log("Creando nuevo thread...");
      thread = await openai.beta.threads.create();
      console.log("Nuevo thread creado:", thread.id);

      // Si no existe un vectorStore para este bot, crear uno
      await getOrCreateVectorStore(botNumber, assistantId);
    } else {
      console.log("Usando thread existente:", thread.id);
    }

    // Agregar el mensaje del usuario al thread
    console.log("Agregando mensaje al thread...");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    // Modificar para incluir un mensaje de bienvenida más elaborado si es el primer mensaje
    const isFirstMessage = !thread;
    let run;

    if (
      isFirstMessage &&
      question.toLowerCase().match(/^(hola|buenos|hi|hey)/)
    ) {
      // Crear una versión personalizada del prompt con información específica de la empresa
      const businessInfo = `
        Representas a: ${config.company_name || "nuestra empresa"}
        Ubicación: ${config.company_address || "dirección no especificada"}
      `;

      const customInstructions = `
        ${config.defaultPrompt(userName)}
        
        ${businessInfo}

        Instrucciones adicionales:
        1. Preséntate como un asesor comercial profesional y amigable
        2. Menciona brevemente nuestros productos/servicios principales
        3. Pregunta específicamente en qué puedes ayudar
        4. Mantén un tono entusiasta pero profesional
        5. Incluye una frase que genere interés en nuestros productos/servicios
        6. Cuando sea relevante, menciona nuestra ubicación
        
        ${prompt}
      `;

      // Ejecutar el asistente con instrucciones personalizadas
      run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistantId,
        instructions: customInstructions,
      });
    } else {
      // Crear una versión estándar del prompt con información específica de la empresa
      const businessInfo = `
        Representas a: ${config.company_name || "nuestra empresa"}
        Ubicación: ${config.company_address || "dirección no especificada"}
      `;

      // Usar las instrucciones normales para mensajes que no son de bienvenida
      run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistantId,
        instructions: `${config.defaultPrompt(
          userName
        )}\n\n${businessInfo}\n\n${prompt}`,
      });
    }

    // Si la corrida se completa, obtener la respuesta
    if (run.status === "completed") {
      console.log("Run completado, obteniendo mensajes...");
      const messages = await openai.beta.threads.messages.list(run.thread_id);

      // Log de todos los mensajes para debug
      for (const message of messages.data.reverse()) {
        console.log(
          `Mensaje GS: ${message.role} > ${message.content[0].text.value}`
        );
      }

      // Obtener la última respuesta del asistente
      const assistantResponse = messages.data
        .filter((message) => message.role === "assistant")
        .pop();

      if (!assistantResponse) {
        console.log("No se encontró respuesta del asistente");
        return {
          thread,
          response: "Lo siento, no pude generar una respuesta.",
        };
      }

      // Obtener la respuesta del asistente
      const answer = assistantResponse.content[0].text.value;

      // Procesar comandos especiales
      if (answer.includes("!list_files")) {
        const files = await trainingService.getTrainingFiles(botNumber);
        // Enumerar los archivos para facilitar la selección
        const fileList = files
          .map((f, index) => `${index + 1}. ${f.name}`)
          .join("\n");
        return {
          thread,
          response: `Aquí están los documentos disponibles:\n${fileList}\n\nPuedes pedirme cualquiera por su nombre o número. ¿Cuál te gustaría recibir?`,
        };
      }

      if (answer.includes("!send_file:")) {
        const fileName = answer.split("!send_file:")[1].trim();
        const files = await trainingService.getTrainingFiles(botNumber);

        // Intentar encontrar el archivo de varias formas
        let fileToSend = files.find((f) => {
          const userInput = fileName.toLowerCase();
          const name = f.name.toLowerCase();

          // Verificar por nombre exacto
          if (name === userInput) return true;

          // Verificar por número (1, 2, 3...)
          const fileIndex = files.indexOf(f) + 1;
          if (fileIndex.toString() === userInput) return true;

          // Verificar por texto (primero, segundo...)
          const textNumbers = {
            primero: 1,
            primer: 1,
            uno: 1,
            segundo: 2,
            dos: 2,
            tercero: 3,
            tercer: 3,
            tres: 3,
            cuarto: 4,
            cuatro: 4,
            quinto: 5,
            cinco: 5,
          };
          if (fileIndex === textNumbers[userInput]) return true;

          // Verificar si el nombre contiene la entrada del usuario
          return name.includes(userInput);
        });

        if (fileToSend) {
          // Preparar archivo para envío
          return {
            thread,
            response: `¡Aquí tienes el archivo "${fileToSend.name}"!`,
            file: fileToSend,
          };
        } else {
          return {
            thread,
            response: `Lo siento, no pude encontrar el archivo "${fileName}". Por favor, intenta con otro nombre.`,
          };
        }
      }

      return { thread, response: answer };
    } else if (run.status === "failed") {
      console.log("Run falló:", run.error);
      return {
        thread,
        response: `Lo siento, ocurrió un error: ${run.error.message}`,
      };
    } else {
      console.log("Run no completado, estado:", run.status);
      return {
        thread,
        response:
          "Lo siento, no pude completar la operación. Por favor, intenta de nuevo más tarde.",
      };
    }
  } catch (error) {
    console.error("Error en chat:", error);
    return {
      thread: null,
      response:
        "Lo siento, ocurrió un error. Por favor, intenta de nuevo más tarde.",
    };
  }
};
