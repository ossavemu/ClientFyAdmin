import { db } from '../connection.js';

export async function up() {
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS user_assistants (
        phone_number VARCHAR(20) PRIMARY KEY REFERENCES ws_users(phone_number),
        assistant_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ws_users 
          FOREIGN KEY (phone_number) 
          REFERENCES ws_users(phone_number) 
          ON DELETE CASCADE
      )
    `;

    await db.sql`
      CREATE INDEX IF NOT EXISTS idx_user_assistants_assistant_id 
      ON user_assistants(assistant_id)
    `;

    console.log('Assistants table migration completed successfully');
  } catch (error) {
    console.error('Assistants table migration failed:', error);
    throw error;
  }
}

export async function down() {
  try {
    await db.sql`DROP TABLE IF EXISTS user_assistants`;
    console.log('Assistants table rollback completed successfully');
  } catch (error) {
    console.error('Assistants table rollback failed:', error);
    throw error;
  }
}
