export const up = async (db) => {
  // Crear tabla de bot_numbers primero ya que es referenciada por historic
  await db.sql`
    CREATE TABLE IF NOT EXISTS bot_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS ws_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT,
      interaction_count INTEGER DEFAULT 1,
      last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS historic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      bot_number TEXT NOT NULL,
      message_type TEXT NOT NULL,
      message_content TEXT,
      provider TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phone_number) REFERENCES ws_users(phone_number),
      FOREIGN KEY (bot_number) REFERENCES bot_numbers(phone_number)
    )
  `;

  // Crear índices para mejorar el rendimiento
  await db.sql`CREATE INDEX IF NOT EXISTS idx_historic_phone ON historic(phone_number)`;
  await db.sql`CREATE INDEX IF NOT EXISTS idx_historic_bot ON historic(bot_number)`;
};

export const down = async (db) => {
  // Verificar y eliminar tablas en orden (primero las que tienen referencias)
  const tables = ["historic", "ws_users", "bot_numbers"];

  for (const table of tables) {
    const exists = await db.sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=${table}
    `;

    if (exists.length > 0) {
      // Construir la consulta como string
      switch (table) {
        case "historic":
          await db.sql`DROP TABLE IF EXISTS historic`;
          break;
        case "ws_users":
          await db.sql`DROP TABLE IF EXISTS ws_users`;
          break;
        case "bot_numbers":
          await db.sql`DROP TABLE IF EXISTS bot_numbers`;
          break;
      }
    }
  }
};
