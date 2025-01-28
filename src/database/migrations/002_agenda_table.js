import { db } from "../connection.js";

export async function up() {
  try {
    // Crear tabla de agenda
    await db.sql`
      CREATE TABLE IF NOT EXISTS agenda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number VARCHAR(20),
        scheduled_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'scheduled' 
          CHECK (status IN ('scheduled', 'completed', 'cancelled')),
        zoom_link TEXT,
        email VARCHAR(100),
        name VARCHAR(100),
        FOREIGN KEY (phone_number) 
          REFERENCES ws_users(phone_number) 
          ON DELETE CASCADE
      )
    `;

    // Crear índices para mejorar el rendimiento
    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_agenda_phone_number 
      ON agenda(phone_number)
    `;

    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_agenda_scheduled_at 
      ON agenda(scheduled_at)
    `;

    // Crear vista para próximas citas (próximas 24 horas)
    await db.sql`
      CREATE VIEW IF NOT EXISTS upcoming_appointments AS
      SELECT 
        a.*,
        w.name as user_name
      FROM agenda a
      JOIN ws_users w ON a.phone_number = w.phone_number
      WHERE a.scheduled_at BETWEEN datetime('now') 
        AND datetime('now', '+24 hours')
      AND a.status = 'scheduled'
      ORDER BY a.scheduled_at ASC
    `;

    console.log("Agenda table migration completed successfully");
  } catch (error) {
    console.error("Agenda table migration failed:", error);
    throw error;
  }
}

export const down = async (db) => {
  const exists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='agenda'
  `;

  if (exists.length > 0) {
    await db.sql`DROP TABLE IF EXISTS agenda`;
  }
};
