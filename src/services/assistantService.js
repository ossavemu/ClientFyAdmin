import OpenAI from 'openai';
import { config } from '../config/index.js';
import { db } from '../database/connection.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.openai_apikey,
});

// Función para formatear el número de teléfono según el provider
const formatPhoneNumber = (phone, provider = 'meta') => {
  if (!phone) {
    console.error('Error: Número de teléfono inválido:', phone);
    throw new Error('El número de teléfono no puede ser undefined o null');
  }

  console.log('Número original:', phone);
  console.log('Provider:', provider);

  try {
    // Primero limpiamos el número de cualquier caracter no numérico
    const cleaned = phone.toString().replace(/\D/g, '');
    console.log('Número limpio:', cleaned);

    // Si ya tiene un prefijo válido (57 o 52), verificamos que no tenga duplicados
    if (cleaned.match(/^(57|52)/)) {
      // Verificar que no haya prefijos duplicados
      const withoutPrefix = cleaned.replace(/^(57|52)/, '');
      if (withoutPrefix.startsWith('57') || withoutPrefix.startsWith('52')) {
        // Si hay un prefijo duplicado, lo removemos
        console.log('Detectado prefijo duplicado, corrigiendo...');
        return `57${withoutPrefix.replace(/^(57|52)/, '')}`;
      }
      return cleaned;
    }

    // Si no tiene prefijo, agregamos 57 (Colombia)
    const formatted = `57${cleaned}`;
    console.log('Número formateado:', formatted);

    // Validar longitud final
    if (formatted.length !== 12) {
      throw new Error(
        `Número de teléfono inválido: longitud ${formatted.length}, se requieren 12 dígitos`
      );
    }

    return formatted;
  } catch (error) {
    console.error('Error al formatear número:', error);
    throw error;
  }
};

export const assistantService = {
  async registerBotNumber(phoneNumber, provider) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber, provider);
      console.log(`Registrando bot número: ${formattedPhone} (${provider})`);

      await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${formattedPhone}, ${provider})
        ON CONFLICT (phone_number) DO UPDATE 
        SET provider = ${provider}
      `;
      return formattedPhone;
    } catch (error) {
      console.error('Error registering bot number:', error);
      throw error;
    }
  },

  async getOrCreateAssistant(botNumber, provider = 'meta') {
    try {
      const formattedBotNumber = formatPhoneNumber(botNumber, provider);
      console.log('Buscando asistente para bot:', formattedBotNumber);

      // Verificar si el bot está registrado
      const botExists = await db.sql`
        SELECT phone_number FROM bot_numbers 
        WHERE phone_number = ${formattedBotNumber}
      `;

      if (botExists.length === 0) {
        throw new Error(`Bot number not registered: ${formattedBotNumber}`);
      }

      // Intentar obtener el asistente existente
      const existingAssistant = await db.sql`
        SELECT assistant_id 
        FROM bot_assistants 
        WHERE bot_number = ${formattedBotNumber}
      `;

      if (existingAssistant.length > 0) {
        console.log('Asistente encontrado:', existingAssistant[0].assistant_id);
        // Actualizar último uso
        await db.sql`
          UPDATE bot_assistants 
          SET last_used = CURRENT_TIMESTAMP 
          WHERE bot_number = ${formattedBotNumber}
        `;
        return existingAssistant[0].assistant_id;
      }

      console.log('Creando nuevo asistente para bot:', formattedBotNumber);
      // Si no existe, crear nuevo asistente en OpenAI
      const assistant = await openai.beta.assistants.create({
        name: `Assistant for Bot ${formattedBotNumber}`,
        instructions: config.defaultPrompt('Cliente'),
        model: 'gpt-4-1106-preview',
      });

      console.log('Nuevo asistente creado:', assistant.id);

      // Guardar en la base de datos
      await db.sql`
        INSERT INTO bot_assistants (bot_number, assistant_id)
        VALUES (${formattedBotNumber}, ${assistant.id})
      `;

      return assistant.id;
    } catch (error) {
      console.error('Error in getOrCreateAssistant:', error);
      throw error;
    }
  },
};
