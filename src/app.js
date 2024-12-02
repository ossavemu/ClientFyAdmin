import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { config } from './config/index.js';
import { db } from './database/connection.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';

const BASE_PORT = 3008;
const INSTANCE_ID = process.env.INSTANCE_ID || '1';
const PORT = BASE_PORT + (parseInt(INSTANCE_ID) - 1);

const log = (message) => console.log(`[Bot ${INSTANCE_ID}] ${message}`);

const main = async () => {
  try {
    log('Iniciando...');
    await db.testConnection();

    const adapterProvider =
      config.provider === 'meta' ? providerMeta : providerBaileys;
    const adapterDB = new Database();

    const { httpServer, bot } = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
    });

    bot.on('ready', () => log('Bot conectado'));
    bot.on('require_action', () => log('Esperando QR'));
    bot.on('message', () => log('Mensaje recibido'));

    httpServer(PORT);
    log(`Servidor en puerto ${PORT}`);

    reminder(adapterProvider);
  } catch (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }
};

main();
