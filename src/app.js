import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { config } from './config/index.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';
import { db } from './database/connection.js';

const PORT = config.PORT;

const main = async () => {
  try {
    // Verificar conexión a la base de datos
    await db.testConnection();

    const adapterFlow = templates;
    let adapterProvider;

    if (config.provider === 'meta') {
      adapterProvider = providerMeta;
    } else if (config.provider === 'baileys') {
      adapterProvider = providerBaileys;
    } else {
      throw new Error('ERROR: Falta agregar un provider al .env');
    }

    const adapterDB = new Database();

    const { httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    httpServer(+PORT);

    // Iniciar el servicio de reminder
    reminder(adapterProvider);

    console.log('🤖 Bot y servicios iniciados correctamente');
  } catch (error) {
    console.error('❌ Error iniciando el bot:', error);
    process.exit(1);
  }
};

main();
