import OpenAI from "openai";
import { config } from "../../config/index.js";
import { db } from "../../database/connection.js";
import { logger } from "../setup/logger.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.openai_apikey,
});

// Caché en memoria para asistentes
const assistantCache = new Map();

// Función para formatear el número de teléfono según el provider
const formatPhoneNumber = (phone, provider = "meta") => {
  if (provider === "meta") {
    // No formatear el número si el provider es 'meta'
    return phone;
  }

  if (!phone) {
    logger.error(`Error: Número de teléfono inválido: ${phone}`);
    throw new Error("El número de teléfono no puede ser undefined o null");
  }

  logger.trace(`Número original: ${phone}`);
  logger.trace(`Provider: ${provider}`);

  try {
    // Primero limpiamos el número de cualquier caracter no numérico
    const cleaned = phone.toString().replace(/\D/g, "");
    logger.trace(`Número limpio: ${cleaned}`);

    // Si ya tiene un prefijo válido (57 o 52), verificamos que no tenga duplicados
    if (cleaned.match(/^(57|52)/)) {
      // Verificar que no haya prefijos duplicados
      const withoutPrefix = cleaned.replace(/^(57|52)/, "");
      if (withoutPrefix.startsWith("57") || withoutPrefix.startsWith("52")) {
        // Si hay un prefijo duplicado, lo removemos
        logger.debug("Detectado prefijo duplicado, corrigiendo...");
        return `57${withoutPrefix.replace(/^(57|52)/, "")}`;
      }
      return cleaned;
    }

    // Si no tiene prefijo, agregamos 57 (Colombia)
    const formatted = `57${cleaned}`;
    logger.trace(`Número formateado: ${formatted}`);

    // Validar longitud final
    if (formatted.length !== 12) {
      throw new Error(
        `Número de teléfono inválido: longitud ${formatted.length}, se requieren 12 dígitos`
      );
    }

    return formatted;
  } catch (error) {
    logger.error("Error al formatear número", error);
    throw error;
  }
};

export const assistantService = {
  // Limpiar la caché (útil para testing o reinicio manual)
  clearCache() {
    assistantCache.clear();
  },

  // Verificar si un asistente está en caché
  isAssistantCached(botNumber) {
    return assistantCache.has(botNumber);
  },

  async registerBotNumber(phoneNumber, provider) {
    try {
      const formattedPhone =
        provider === "meta"
          ? phoneNumber
          : formatPhoneNumber(phoneNumber, provider);
      logger.debug(`Registrando bot número: ${formattedPhone} (${provider})`);

      await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${formattedPhone}, ${provider})
        ON CONFLICT (phone_number) DO UPDATE 
        SET provider = ${provider}
      `;
      return formattedPhone;
    } catch (error) {
      logger.error("Error registrando bot number", error);
      throw error;
    }
  },

  async getOrCreateAssistant(botNumber) {
    try {
      // Verificar primero en la caché
      if (assistantCache.has(botNumber)) {
        logger.debug(`Usando asistente en caché para ${botNumber}`);
        return assistantCache.get(botNumber);
      }

      // Buscar asistente existente para este bot
      const existingAssistant = await db.sql`
        SELECT assistant_id 
        FROM user_assistants 
        WHERE phone_number = ${botNumber}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      let assistantId = null;

      if (existingAssistant.length > 0) {
        try {
          // Verificar si el asistente existe en OpenAI
          await openai.beta.assistants.retrieve(
            existingAssistant[0].assistant_id
          );
          assistantId = existingAssistant[0].assistant_id;
        } catch (error) {
          if (error.status === 404) {
            logger.info(
              "Asistente no encontrado en OpenAI, creando uno nuevo..."
            );
            // No asignar assistantId, para que se cree uno nuevo
          } else {
            throw error; // Re-lanzar otros errores
          }
        }
      }

      if (!assistantId) {
        // Crear nuevo asistente
        logger.info(`Creando nuevo asistente para: ${botNumber}`);
        logger.debug(
          "Aplicando configuración de instrucciones predeterminadas"
        );

        const assistant = await openai.beta.assistants.create({
          name: `Asistente-${botNumber}`,
          instructions: config.defaultPrompt("Cliente"),
          model: config.model || "gpt-4-turbo",
          tools: [
            {
              type: "file_search",
            },
          ],
        });

        // Actualizar o insertar el nuevo asistente
        await db.sql`
          UPDATE user_assistants 
          SET assistant_id = ${assistant.id}, 
              updated_at = CURRENT_TIMESTAMP
          WHERE phone_number = ${botNumber}
        `;

        // Si no se actualizó ningún registro, insertar uno nuevo
        const updateResult = await db.sql`
          SELECT changes() as changes
        `;

        if (updateResult[0].changes === 0) {
          await db.sql`
            INSERT INTO user_assistants (phone_number, assistant_id)
            VALUES (${botNumber}, ${assistant.id})
          `;
        }

        assistantId = assistant.id;
      }

      // Guardar en caché
      assistantCache.set(botNumber, assistantId);
      return assistantId;
    } catch (error) {
      logger.error("Error en getOrCreateAssistant", error);
      throw error;
    }
  },
};
