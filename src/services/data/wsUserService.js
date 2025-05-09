import { db } from "../../database/connection.js";
import { agendaSchema } from "../../schemas/agenda.js";
import { historicSchema, wsUserSchema } from "../../schemas/wsUser.js";
import { logger } from "../setup/logger.js";

export const wsUserService = {
  async registerBot() {
    try {
      const botNumber = process.env.P_NUMBER;
      const provider = process.env.PROVIDER || "baileys";

      logger.debug(`Registrando bot: ${botNumber} (${provider})`);

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

      logger.debug("Bot registrado exitosamente");
      logger.trace(`Detalles del bot: ${JSON.stringify(botResult[0])}`);
      return botResult[0];
    } catch (error) {
      logger.error("Error registrando bot", error);
      throw error;
    }
  },

  async createOrUpdateUser(phoneNumber, name) {
    try {
      const userData = wsUserSchema.parse({
        phone_number: phoneNumber,
        name,
      });

      logger.debug(`Creando/actualizando usuario: ${phoneNumber}`);
      logger.trace(`Datos de usuario: ${JSON.stringify(userData)}`);

      const result = await db.sql`
        INSERT INTO ws_users (phone_number, name)
        VALUES (${userData.phone_number}, ${userData.name})
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
          interaction_count = ws_users.interaction_count + 1,
          last_interaction = CURRENT_TIMESTAMP
        RETURNING *
      `;

      logger.debug(`Usuario ${result[0].phone_number} actualizado`);
      logger.trace(`Detalles actualizados: ${JSON.stringify(result[0])}`);
      return result[0];
    } catch (error) {
      logger.error("Error en createOrUpdateUser", error);
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
      logger.debug(
        `Registrando interacción de ${phoneNumber} con bot ${botNumber} (${provider})`
      );

      // Asegurarnos que el bot está registrado
      await this.registerBot();

      // Primero crear/actualizar el usuario para obtener el número correcto
      const user = await this.createOrUpdateUser(phoneNumber);
      logger.trace(`Usuario actualizado: ${JSON.stringify(user)}`);

      // Usar el número de teléfono que se usó para crear/actualizar el usuario
      const formattedNumber = user.phone_number;

      // Verificar si el bot existe
      const existingBot = await db.sql`
        SELECT * FROM bot_numbers WHERE phone_number = ${botNumber}
      `;
      logger.trace(`Bot existente: ${JSON.stringify(existingBot[0])}`);

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

      logger.debug("Insertando en histórico");
      logger.trace(`Datos de interacción: ${JSON.stringify(interactionData)}`);

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

      logger.debug("Interacción registrada exitosamente");
    } catch (error) {
      logger.error("Error en logInteraction", error);
      throw error;
    }
  },

  async getHotUsers() {
    try {
      return await db.sql`SELECT * FROM hot_users`;
    } catch (error) {
      logger.error("Error en getHotUsers", error);
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

      logger.debug(`Creando agenda para usuario: ${phoneNumber}`);
      logger.trace(`Datos de agenda: ${JSON.stringify(agendaData)}`);

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

      logger.info(`Cita agendada exitosamente para: ${phoneNumber}`);
      return result[0];
    } catch (error) {
      logger.error("Error en createAgenda", error);
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
      logger.error("Error en getUpcomingAgenda", error);
      throw error;
    }
  },

  async updateAgendaStatus(id, status) {
    try {
      return await db.sql`
        UPDATE agenda 
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } catch (error) {
      logger.error("Error en updateAgendaStatus", error);
      throw error;
    }
  },

  async getUpcomingAppointments() {
    try {
      const appointments = await db.sql`
        SELECT * FROM agenda 
        WHERE scheduled_at > CURRENT_TIMESTAMP
        AND scheduled_at < CURRENT_TIMESTAMP + INTERVAL '24 hours'
        AND status = 'scheduled'
        ORDER BY scheduled_at ASC
      `;
      return appointments;
    } catch (error) {
      logger.error("Error en getUpcomingAppointments", error);
      throw error;
    }
  },

  async updateAppointmentStatus(phoneNumber, scheduledAt, status) {
    try {
      return await db.sql`
        UPDATE agenda 
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE phone_number = ${phoneNumber}
        AND scheduled_at = ${scheduledAt}
        RETURNING *
      `;
    } catch (error) {
      logger.error("Error en updateAppointmentStatus", error);
      throw error;
    }
  },

  async getInteractionHistory(phoneNumber, limit = 10) {
    try {
      logger.debug(`Obteniendo historial de interacciones para ${phoneNumber}`);

      const history = await db.sql`
        SELECT * FROM historic
        WHERE phone_number = ${phoneNumber}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      logger.debug(
        `Se encontraron ${history.length} interacciones para ${phoneNumber}`
      );
      return history;
    } catch (error) {
      logger.error("Error en getInteractionHistory", error);
      throw error;
    }
  },

  async getRecentHistory(phoneNumber, limit = 10) {
    try {
      return await db.sql`
        SELECT * FROM historic 
        WHERE phone_number = ${phoneNumber}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } catch (error) {
      logger.error("Error en getRecentHistory", error);
      throw error;
    }
  },

  async countEngagementMessagesSinceLastUser(phoneNumber) {
    try {
      const lastUserMsg = await db.sql`
        SELECT created_at FROM historic
        WHERE phone_number = ${phoneNumber} AND provider != 'bot'
        ORDER BY created_at DESC LIMIT 1
      `;
      let since = lastUserMsg[0]?.created_at;
      let query;
      if (since) {
        query = await db.sql`
          SELECT COUNT(*) FROM historic
          WHERE phone_number = ${phoneNumber}
          AND provider = 'bot'
          AND message_type = 'text'
          AND created_at > ${since}
        `;
      } else {
        query = await db.sql`
          SELECT COUNT(*) FROM historic
          WHERE phone_number = ${phoneNumber}
          AND provider = 'bot'
          AND message_type = 'text'
        `;
      }
      return Number(query[0].count);
    } catch (error) {
      logger.error("Error en countEngagementMessagesSinceLastUser", error);
      throw error;
    }
  },
};
