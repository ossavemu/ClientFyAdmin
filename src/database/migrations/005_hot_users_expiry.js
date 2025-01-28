import { db } from "../connection.js";

export async function up() {
  try {
    // Modificar la vista hot_users para incluir el límite de 2 días
    await db.sql`
      DROP VIEW IF EXISTS hot_users
    `;

    await db.sql`
      CREATE VIEW hot_users AS
      SELECT 
        phone_number,
        name,
        interaction_count,
        last_interaction
      FROM ws_users
      WHERE interaction_count > 3
      AND last_interaction > datetime('now', '-2 days')
      ORDER BY last_interaction DESC
    `;

    console.log("Hot users expiry migration completed successfully");
  } catch (error) {
    console.error("Hot users expiry migration failed:", error);
    throw error;
  }
}

export const down = async (db) => {
  const exists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='view' AND name='hot_users'
  `;

  if (exists.length > 0) {
    await db.sql`DROP VIEW IF EXISTS hot_users`;
  }
};
