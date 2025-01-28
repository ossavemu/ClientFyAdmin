export const up = async (db) => {
  await db.sql`DROP TABLE IF EXISTS muted_users`;
};

export const down = async (db) => {
  await db.sql`
    CREATE TABLE IF NOT EXISTS muted_users (
      phone_number TEXT,
      bot_number TEXT,
      until DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (phone_number, bot_number),
      FOREIGN KEY (bot_number) REFERENCES bot_numbers(phone_number)
    )
  `;
};
