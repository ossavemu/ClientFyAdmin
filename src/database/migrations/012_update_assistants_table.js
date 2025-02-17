export const up = async (db) => {
  // Primero respaldamos los datos existentes
  await db.sql`CREATE TABLE user_assistants_backup AS SELECT * FROM user_assistants`;

  // Eliminamos la tabla original
  await db.sql`DROP TABLE user_assistants`;

  // Creamos la nueva tabla sin la restricción única en phone_number
  await db.sql`
    CREATE TABLE user_assistants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number VARCHAR(20),
      assistant_id VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phone_number) 
        REFERENCES ws_users(phone_number) 
        ON DELETE CASCADE
    )
  `;

  // Restauramos los datos
  await db.sql`
    INSERT INTO user_assistants (phone_number, assistant_id, created_at)
    SELECT phone_number, assistant_id, created_at
    FROM user_assistants_backup
  `;

  // Eliminamos la tabla de respaldo
  await db.sql`DROP TABLE user_assistants_backup`;

  // Creamos índices para mejorar el rendimiento
  await db.sql`
    CREATE INDEX IF NOT EXISTS idx_user_assistants_phone 
    ON user_assistants(phone_number)
  `;

  await db.sql`
    CREATE INDEX IF NOT EXISTS idx_user_assistants_assistant 
    ON user_assistants(assistant_id)
  `;
};

export const down = async (db) => {
  // Primero respaldamos los datos existentes
  await db.sql`CREATE TABLE user_assistants_backup AS SELECT * FROM user_assistants`;

  // Eliminamos la tabla actual
  await db.sql`DROP TABLE user_assistants`;

  // Recreamos la tabla original con la restricción única
  await db.sql`
    CREATE TABLE user_assistants (
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

  // Restauramos los datos (solo el registro más reciente por phone_number)
  await db.sql`
    INSERT INTO user_assistants (phone_number, assistant_id, created_at)
    SELECT phone_number, assistant_id, MAX(created_at)
    FROM user_assistants_backup
    GROUP BY phone_number
  `;

  // Eliminamos la tabla de respaldo
  await db.sql`DROP TABLE user_assistants_backup`;
};
