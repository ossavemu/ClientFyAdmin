import { db } from "../connection.js";

export async function up() {
  try {
    // Eliminar la tabla anterior
    await db.sql`DROP TABLE IF EXISTS user_assistants`;

    // Crear tabla de bots
    await db.sql`
      CREATE TABLE IF NOT EXISTS bot_numbers (
        phone_number VARCHAR(20) PRIMARY KEY,
        provider VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (phone_number) 
          REFERENCES ws_users(phone_number) 
          ON DELETE CASCADE
      )
    `;

    // Crear tabla de asistentes vinculados a bots
    await db.sql`
      CREATE TABLE IF NOT EXISTS bot_assistants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_number VARCHAR(20),
        assistant_id VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_number) 
          REFERENCES bot_numbers(phone_number) 
          ON DELETE CASCADE,
        UNIQUE(bot_number, assistant_id)
      )
    `;

    // Crear índices
    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_bot_assistants_bot_number 
      ON bot_assistants(bot_number)
    `;

    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_bot_assistants_assistant_id 
      ON bot_assistants(assistant_id)
    `;

    // Insertar bots predeterminados
    await db.sql`
      INSERT INTO bot_numbers (phone_number, provider)
      VALUES 
        ('000000000000', 'meta'),
        ('bot_baileys', 'baileys')
      ON CONFLICT (phone_number) DO NOTHING
    `;

    console.log("Bot assistants tables migration completed successfully");
  } catch (error) {
    console.error("Bot assistants tables migration failed:", error);
    throw error;
  }
}

export const down = async (db) => {
  const exists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='bot_assistants'
  `;

  if (exists.length > 0) {
    await db.sql`DROP TABLE IF EXISTS bot_assistants`;
  }
};
