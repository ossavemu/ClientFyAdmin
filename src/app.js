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

    log('Creando bot...');
    const botInstance = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: new Database(),
      settings: {
        name: `Bot-${INSTANCE_ID}`,
        port: PORT,
      },
    });

    if (!botInstance) {
      throw new Error('No se pudo crear la instancia del bot');
    }

    const { httpServer, bot } = botInstance;

    if (!bot) {
      throw new Error('Bot no disponible en la instancia');
    }

    // Configurar eventos básicos
    bot.on('ready', () => log('Bot conectado'));
    bot.on('require_action', () => log('Esperando QR'));
    bot.on('message', () => log('Mensaje recibido'));
    bot.on('error', (err) => log(`Error: ${err.message}`));

    // Iniciar servidor HTTP
    httpServer(PORT);
    log(`Servidor iniciado en puerto ${PORT}`);

    // Iniciar recordatorios
    reminder(adapterProvider);
    log('Recordatorios iniciados');
  } catch (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  log(`Error no capturado: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`Promesa rechazada: ${reason}`);
  process.exit(1);
});

main();
