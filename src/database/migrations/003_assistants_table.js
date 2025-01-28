import { db } from "../connection.js";

export async function up() {
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS user_assistants (
        phone_number VARCHAR(20),
        assistant_id VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (phone_number),
        FOREIGN KEY (phone_number) 
          REFERENCES ws_users(phone_number) 
          ON DELETE CASCADE
      )
    `;

    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_user_assistants_assistant_id 
      ON user_assistants(assistant_id)
    `;

    console.log("Assistants table migration completed successfully");
  } catch (error) {
    console.error("Assistants table migration failed:", error);
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
