import OpenAI from "openai";
import { config } from "../../config/index.js";
import { wsUserService } from "../data/wsUserService.js";
import { assistantService } from "./assistantService.js";
import { getPrompt } from "./promptService.js";
import { trainingService } from "./trainingService.js";

const openaiApiKey = config.openai_apikey;

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
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Obtener el prompt desde la API
    const prompt = await getPrompt(botNumber);

    // Si no hay thread, crear uno nuevo
    if (!thread) {
      console.log("Creando nuevo thread...");
      thread = await openai.beta.threads.create();
      console.log("Nuevo thread creado:", thread.id);
    } else {
      console.log("Usando thread existente:", thread.id);
    }

    // Obtener el assistant_id para este bot
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );

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
      const customInstructions = `
        ${config.defaultPrompt(userName)}
        
        Instrucciones adicionales:
        1. Preséntate como un asesor comercial profesional y amigable
        2. Menciona brevemente los productos/servicios principales
        3. Pregunta específicamente en qué puedes ayudar
        4. Mantén un tono entusiasta pero profesional
        5. Incluye una frase que genere interés en los productos/servicios
        
        ${prompt}
      `;

      // Ejecutar el asistente con instrucciones personalizadas
      run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistantId,
        instructions: customInstructions,
      });
    } else {
      // Usar las instrucciones normales para mensajes que no son de bienvenida
      run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistantId,
        instructions: `${config.defaultPrompt(userName)}\n\n${prompt}`,
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
          const processedFile = await trainingService.downloadAndProcessFile(
            fileToSend.url,
            fileToSend.name
          );
          return {
            thread,
            response: "Enviando el archivo solicitado...",
            media: {
              path: processedFile.path,
              filename: fileToSend.name,
              mimetype: processedFile.mimeType,
            },
          };
        } else {
          // Si no se encuentra el archivo, volver a mostrar la lista
          const fileList = files
            .map((f, index) => `${index + 1}. ${f.name}`)
            .join("\n");
          return {
            thread,
            response: `No encontré ese documento. Aquí están los disponibles:\n${fileList}\n\nPuedes pedirme cualquiera por su nombre o número. ¿Cuál te gustaría recibir?`,
          };
        }
      }

      const cleanAnswer = answer.replace(/【\d+:\d+†source/g, "");

      // Registrar la respuesta del bot en el histórico
      if (assistantResponse) {
        await wsUserService.logInteraction(
          botNumber,
          "text",
          assistantResponse.content[0].text.value,
          provider
        );
      }

      return {
        thread,
        response: cleanAnswer,
      };
    }

    // Si el run no se completó
    if (run.status === "failed") {
      console.error("Run falló con error:", run.last_error);
      return {
        thread,
        response:
          "Lo siento, hubo un problema procesando tu mensaje. Por favor, intenta nuevamente.",
      };
    }

    console.log("Run no completado, estado:", run.status);
    return {
      thread,
      response:
        "Lo siento, hubo un problema procesando tu mensaje. Por favor, intenta nuevamente.",
    };
  } catch (err) {
    console.error("Error al conectar con OpenAI:", err);
    return {
      thread,
      response: "Lo siento, ocurrió un error. Por favor, intenta nuevamente.",
    };
  }
};
