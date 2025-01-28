export const up = async (db) => {
  // Primero respaldamos los datos existentes
  await db.sql`CREATE TABLE historic_backup AS SELECT * FROM historic`;

  // Eliminamos la tabla original
  await db.sql`DROP TABLE historic`;

  // Creamos la nueva tabla con la columna bot_number
  await db.sql`
    CREATE TABLE historic (
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

  // Restauramos los datos, asignando un valor por defecto para bot_number
  await db.sql`
    INSERT INTO historic (phone_number, bot_number, message_type, message_content, provider, created_at)
    SELECT 
      phone_number,
      CASE 
        WHEN provider = 'meta' THEN '000000000000'
        ELSE (SELECT phone_number FROM bot_numbers WHERE provider = 'baileys' LIMIT 1)
      END as bot_number,
      message_type,
      message_content,
      provider,
      created_at
    FROM historic_backup
  `;

  // Eliminamos la tabla de respaldo
  await db.sql`DROP TABLE historic_backup`;
};

export const down = async (db) => {
  // Verificar si la tabla historic existe
  const tableExists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='historic'
  `;

  if (tableExists.length > 0) {
    // Solo intentar borrar si la tabla existe
    await db.sql`DELETE FROM historic`;
    await db.sql`DROP TABLE historic`;
  }
};
