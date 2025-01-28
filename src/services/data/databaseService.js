import { db } from "../../database/connection.js";
import { logger } from "../setup/logger.js";

export const databaseService = {
  async registerBot(botNumber, provider) {
    try {
      logger.info("Registrando bot en la base de datos...");

      await db.sql`
        INSERT INTO ws_users (phone_number, name)
        VALUES (${botNumber}, ${`Bot ${provider}`})
        ON CONFLICT (phone_number) DO NOTHING
      `;

      await db.sql`
        INSERT INTO bot_numbers (phone_number, provider)
        VALUES (${botNumber}, ${provider})
        ON CONFLICT (phone_number) DO NOTHING
      `;

      logger.info(`Bot registrado exitosamente: ${botNumber} (${provider})`);
    } catch (error) {
      logger.error("Error registrando bot:", error);
      throw error;
    }
  },

  async testConnection() {
    return db.testConnection();
  },
};
