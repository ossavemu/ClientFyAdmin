export const up = async (db) => {
  await db.sql`
    CREATE TABLE IF NOT EXISTS calendar_ids (
      bot_number TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
};

export const down = async (db) => {
  await db.sql`DROP TABLE IF EXISTS calendar_ids`;
};
