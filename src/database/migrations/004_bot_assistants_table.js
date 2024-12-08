import { db } from '../connection.js';

export async function up() {
  try {
    // Eliminar la tabla anterior
    await db.sql`DROP TABLE IF EXISTS user_assistants`;

    // Crear tabla de bots
    await db.sql`
      CREATE TABLE IF NOT EXISTS bot_numbers (
        phone_number VARCHAR(20) PRIMARY KEY,
        provider VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Crear tabla de asistentes vinculados a bots
    await db.sql`
      CREATE TABLE IF NOT EXISTS bot_assistants (
        id SERIAL PRIMARY KEY,
        bot_number VARCHAR(20) REFERENCES bot_numbers(phone_number),
        assistant_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

    console.log('Bot assistants tables migration completed successfully');
  } catch (error) {
    console.error('Bot assistants tables migration failed:', error);
    throw error;
  }
}

export async function down() {
  try {
    await db.sql`DROP TABLE IF EXISTS bot_assistants`;
    await db.sql`DROP TABLE IF EXISTS bot_numbers`;
    console.log('Bot assistants tables rollback completed successfully');
  } catch (error) {
    console.error('Bot assistants tables rollback failed:', error);
    throw error;
  }
}
