export const up = async (db) => {
  await db.sql`
    INSERT INTO bot_numbers (phone_number, provider) 
    VALUES 
      ('000000000000', 'meta'),
      ('573053483248', 'baileys')
    ON CONFLICT (phone_number) DO NOTHING
  `;
};

export const down = async (db) => {
  // Verificar historic primero
  const historicExists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='historic'
  `;

  if (historicExists.length > 0) {
    await db.sql`DELETE FROM historic WHERE bot_number IN ('000000000000', '573053483248')`;
  }

  // Verificar bot_numbers
  const botNumbersExists = await db.sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='bot_numbers'
  `;

  if (botNumbersExists.length > 0) {
    await db.sql`
      DELETE FROM bot_numbers 
      WHERE phone_number IN ('000000000000', '573053483248')
    `;
  }
};
