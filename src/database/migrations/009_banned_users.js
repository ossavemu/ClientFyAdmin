export const up = async (db) => {
  await db.sql`
    CREATE TABLE IF NOT EXISTS banned_users (
      phone_number TEXT,
      bot_number TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (phone_number, bot_number),
      FOREIGN KEY (bot_number) REFERENCES bot_numbers(phone_number)
    )
  `;
};

export const down = async (db) => {
  await db.sql`DROP TABLE IF EXISTS banned_users`;
};
