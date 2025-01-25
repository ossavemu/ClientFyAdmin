import OpenAI from "openai";
import { config } from "../config/index.js";
import { db } from "../database/connection.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.openai_apikey,
});

// Función para formatear el número de teléfono según el provider
const formatPhoneNumber = (phone, provider = "meta") => {
  if (provider === "meta") {
    // No formatear el número si el provider es 'meta'
    return phone;
  }

  if (!phone) {
    console.error("Error: Número de teléfono inválido:", phone);
    throw new Error("El número de teléfono no puede ser undefined o null");
  }

  console.log("Número original:", phone);
  console.log("Provider:", provider);

  try {
    // Primero limpiamos el número de cualquier caracter no numérico
    const cleaned = phone.toString().replace(/\D/g, "");
    console.log("Número limpio:", cleaned);

    // Si ya tiene un prefijo válido (57 o 52), verificamos que no tenga duplicados
    if (cleaned.match(/^(57|52)/)) {
      // Verificar que no haya prefijos duplicados
      const withoutPrefix = cleaned.replace(/^(57|52)/, "");
      if (withoutPrefix.startsWith("57") || withoutPrefix.startsWith("52")) {
        // Si hay un prefijo duplicado, lo removemos
        console.log("Detectado prefijo duplicado, corrigiendo...");
        return `57${withoutPrefix.replace(/^(57|52)/, "")}`;
      }
      return cleaned;
    }

    // Si no tiene prefijo, agregamos 57 (Colombia)
    const formatted = `57${cleaned}`;
    console.log("Número formateado:", formatted);

    // Validar longitud final
    if (formatted.length !== 12) {
      throw new Error(
        `Número de teléfono inválido: longitud ${formatted.length}, se requieren 12 dígitos`
      );
    }

    return formatted;
  } catch (error) {
    console.error("Error al formatear número:", error);
    throw error;
  }
};

export const assistantService = {
  async registerBotNumber(phoneNumber, provider) {
    try {
      const formattedPhone =
        provider === "meta"
          ? phoneNumber
          : formatPhoneNumber(phoneNumber, provider);
      console.log(`Registrando bot número: ${formattedPhone} (${provider})`);

      await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${formattedPhone}, ${provider})
        ON CONFLICT (phone_number) DO UPDATE 
        SET provider = ${provider}
      `;
      return formattedPhone;
    } catch (error) {
      console.error("Error registering bot number:", error);
      throw error;
    }
  },

  async getOrCreateAssistant(botNumber) {
    try {
      // Buscar asistente existente para este bot
      const existingAssistant = await db.sql`
        SELECT assistant_id 
        FROM user_assistants 
        WHERE phone_number = ${botNumber}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      if (existingAssistant.length > 0) {
        return existingAssistant[0].assistant_id;
      }

      // Si no existe, crear uno nuevo
      const assistant = await openai.beta.assistants.create({
        name: `Bot Assistant ${botNumber}`,
        instructions: config.defaultPrompt("Cliente"),
        model: "gpt-4-1106-preview",
      });

      // Guardar el nuevo asistente
      await db.sql`
        INSERT INTO user_assistants (phone_number, assistant_id)
        VALUES (${botNumber}, ${assistant.id})
      `;

      return assistant.id;
    } catch (error) {
      console.error("Error in getOrCreateAssistant:", error);
      throw error;
    }
  },
};
