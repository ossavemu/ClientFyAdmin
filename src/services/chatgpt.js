import OpenAI from 'openai';
import { config } from '../config/index.js';
import { assistantService } from './assistantService.js';
import { getPrompt } from './promptService.js';

const openaiApiKey = config.openai_apikey;

// Función para formatear el número de teléfono
const formatPhoneNumber = (phone) => {
  console.log('Número original:', phone);

  // Eliminar todos los caracteres que no sean números
  const cleaned = phone.toString().replace(/\D/g, '');
  console.log('Número limpio:', cleaned);

  // Asegurarse de que tenga el formato correcto (agregar 57 si no lo tiene)
  const formatted = cleaned.startsWith('57') ? cleaned : `57${cleaned}`;
  console.log('Número formateado:', formatted);

  // Asegurarse de que tenga al menos 10 dígitos después del prefijo
  if (formatted.length < 12) {
    console.log('Longitud inválida:', formatted.length);
    throw new Error(
      `Número de teléfono inválido: longitud ${formatted.length}, se requieren al menos 12 dígitos`
    );
  }

  return formatted;
};

export const chat = async (
  question,
  botNumber,
  userName = null,
  thread = null
) => {
  try {
    if (!botNumber) {
      console.error('Error: botNumber es requerido pero es undefined/null');
      throw new Error('El número de bot es requerido');
    }

    console.log(
      'Iniciando chat con bot número:',
      botNumber,
      'usuario:',
      userName,
      'provider:',
      config.provider
    );
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Obtener el prompt desde la API
    const prompt = await getPrompt(botNumber);

    // Si no hay thread, crear uno nuevo
    if (!thread) {
      console.log('Creando nuevo thread...');
      thread = await openai.beta.threads.create();
      console.log('Nuevo thread creado:', thread.id);
    } else {
      console.log('Usando thread existente:', thread.id);
    }

    // Obtener el assistant_id para este bot
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    );

    // Agregar el mensaje del usuario al thread
    console.log('Agregando mensaje al thread...');
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: question,
    });

    // Ejecutar el asistente usando el prompt obtenido
    console.log('Ejecutando asistente...');
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistantId,
      instructions: `${config.defaultPrompt(userName)}\n\n${prompt}`,
    });

    // Si la corrida se completa, obtener la respuesta
    if (run.status === 'completed') {
      console.log('Run completado, obteniendo mensajes...');
      const messages = await openai.beta.threads.messages.list(run.thread_id);

      // Log de todos los mensajes para debug
      for (const message of messages.data.reverse()) {
        console.log(
          `Mensaje GS: ${message.role} > ${message.content[0].text.value}`
        );
      }

      // Obtener la última respuesta del asistente
      const assistantResponse = messages.data
        .filter((message) => message.role === 'assistant')
        .pop();

      if (!assistantResponse) {
        console.log('No se encontró respuesta del asistente');
        return {
          thread,
          response: 'Lo siento, no pude generar una respuesta.',
        };
      }

      const answer = assistantResponse.content[0].text.value;
      const cleanAnswer = answer.replace(/【\d+:\d+†source/g, '');

      console.log('Respuesta limpia:', cleanAnswer);
      return {
        thread,
        response: cleanAnswer,
      };
    }

    // Si el run no se completó
    console.log('Run no completado, estado:', run.status);
    return {
      thread,
      response: 'Lo siento, hubo un problema procesando tu mensaje.',
    };
  } catch (err) {
    console.error('Error al conectar con OpenAI:', err);
    return {
      thread,
      response: 'Lo siento, ocurrió un error. Por favor, intenta nuevamente.',
    };
  }
};
