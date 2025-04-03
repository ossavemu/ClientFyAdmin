import { db } from "../../database/connection.js";
import { agendaSchema } from "../../schemas/agenda.js";
import { historicSchema, wsUserSchema } from "../../schemas/wsUser.js";

export const wsUserService = {
  async registerBot() {
    try {
      const botNumber = process.env.P_NUMBER;
      const provider = process.env.PROVIDER || "baileys";

      console.log("Registrando bot:", { botNumber, provider });

      // Registrar el bot en ws_users
      await db.sql`
        INSERT INTO ws_users (phone_number, name)
        VALUES (${botNumber}, ${`Bot ${provider}`})
        ON CONFLICT (phone_number) DO NOTHING
      `;

      // Registrar el bot en bot_numbers
      const botResult = await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${botNumber}, ${provider})
        ON CONFLICT (phone_number) DO NOTHING
        RETURNING *
      `;

      console.log("Bot registrado:", botResult[0]);
      return botResult[0];
    } catch (error) {
      console.error("Error registrando bot:", error);
      throw error;
    }
  },

  async createOrUpdateUser(phoneNumber, name) {
    try {
      const userData = wsUserSchema.parse({
        phone_number: phoneNumber,
        name,
      });

      console.log("Creando/actualizando usuario:", userData);

      const result = await db.sql`
        INSERT INTO ws_users (phone_number, name)
        VALUES (${userData.phone_number}, ${userData.name})
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
          interaction_count = ws_users.interaction_count + 1,
          last_interaction = CURRENT_TIMESTAMP
        RETURNING *
      `;

      console.log("Usuario creado/actualizado:", result[0]);
      return result[0];
    } catch (error) {
      console.error("Error in createOrUpdateUser:", error);
      throw error;
    }
  },

  async logInteraction(
    phoneNumber,
    messageType,
    content,
    provider = "user",
    botNumber = process.env.P_NUMBER
  ) {
    try {
      console.log("Iniciando logInteraction con:", {
        phoneNumber,
        botNumber,
        provider,
      });

      // Asegurarnos que el bot está registrado
      await this.registerBot();

      // Primero crear/actualizar el usuario para obtener el número correcto
      const user = await this.createOrUpdateUser(phoneNumber);
      console.log("Usuario después de createOrUpdateUser:", user);

      // Usar el número de teléfono que se usó para crear/actualizar el usuario
      const formattedNumber = user.phone_number;

      // Verificar si el bot existe
      const existingBot = await db.sql`
        SELECT * FROM bot_numbers WHERE phone_number = ${botNumber}
      `;
      console.log("Bot existente:", existingBot[0]);

      // Verificar que ambos existen antes de continuar
      const finalUserCheck = await db.sql`
        SELECT * FROM ws_users WHERE phone_number = ${formattedNumber}
      `;
      const finalBotCheck = await db.sql`
        SELECT * FROM bot_numbers WHERE phone_number = ${botNumber}
      `;

      if (!finalUserCheck[0] || !finalBotCheck[0]) {
        throw new Error(`No se pudo verificar la existencia de usuario o bot: 
          Usuario: ${JSON.stringify(finalUserCheck[0])}
          Bot: ${JSON.stringify(finalBotCheck[0])}`);
      }

      const interactionData = historicSchema.parse({
        phone_number: formattedNumber,
        bot_number: botNumber,
        message_type: messageType,
        message_content: content,
        provider,
      });

      console.log("Intentando insertar en historic:", interactionData);

      await db.sql`
        INSERT INTO historic (
          phone_number, 
          bot_number,
          message_type, 
          message_content, 
          provider
        )
        VALUES (
          ${interactionData.phone_number}, 
          ${interactionData.bot_number},
          ${interactionData.message_type}, 
          ${interactionData.message_content}, 
          ${interactionData.provider}
        )
      `;

      console.log("Inserción en historic exitosa");
    } catch (error) {
      console.error("Error detallado en logInteraction:", error);
      throw error;
    }
  },

  async getHotUsers() {
    try {
      return await db.sql`SELECT * FROM hot_users`;
    } catch (error) {
      console.error("Error in getHotUsers:", error);
      throw error;
    }
  },

  async createAgenda(phoneNumber, scheduledAt, email, name, zoomLink) {
    try {
      const agendaData = agendaSchema.parse({
        phone_number: phoneNumber,
        scheduled_at: scheduledAt,
        email,
        name,
        zoom_link: zoomLink,
      });

      const result = await db.sql`
        INSERT INTO agenda (
          phone_number, 
          scheduled_at, 
          email, 
          name, 
          zoom_link
        )
        VALUES (
          ${agendaData.phone_number}, 
          ${agendaData.scheduled_at}, 
          ${agendaData.email}, 
          ${agendaData.name}, 
          ${agendaData.zoom_link}
        )
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error("Error in createAgenda:", error);
      throw error;
    }
  },

  async getUpcomingAgenda(phoneNumber) {
    try {
      return await db.sql`
        SELECT * FROM agenda 
        WHERE phone_number = ${phoneNumber} 
        AND scheduled_at > CURRENT_TIMESTAMP
        AND status = 'scheduled'
        ORDER BY scheduled_at ASC
      `;
    } catch (error) {
      console.error("Error in getUpcomingAgenda:", error);
      throw error;
    }
  },

  async updateAgendaStatus(id, status) {
    try {
      const result = await db.sql`
        UPDATE agenda 
        SET status = ${status} 
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error("Error in updateAgendaStatus:", error);
      throw error;
    }
  },

  async getUpcomingAppointments() {
    try {
      const appointments = await db.sql`
        SELECT * FROM agenda 
        WHERE scheduled_at BETWEEN datetime('now') 
          AND datetime('now', '+24 hours')
        AND status = 'scheduled'
        ORDER BY scheduled_at ASC
      `;
      return appointments;
    } catch (error) {
      console.error("Error in getUpcomingAppointments:", error);
      throw error;
    }
  },

  async updateAppointmentStatus(phoneNumber, scheduledAt, status) {
    try {
      const result = await db.sql`
        UPDATE agenda 
        SET status = ${status}
        WHERE phone_number = ${phoneNumber}
        AND scheduled_at = ${scheduledAt}
        AND status = 'scheduled'
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error("Error in updateAppointmentStatus:", error);
      throw error;
    }
  },

  async getRecentHistory(phoneNumber, limit = 10) {
    try {
      const history = await db.sql`
        SELECT * FROM historic 
        WHERE phone_number = ${phoneNumber}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return history;
    } catch (error) {
      console.error("Error in getRecentHistory:", error);
      throw error;
    }
  },
};
