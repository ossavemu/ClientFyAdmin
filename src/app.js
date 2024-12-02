import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { config } from './config/index.js';
import { db } from './database/connection.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';

const BASE_PORT = 3008;
const INSTANCE_ID = process.env.INSTANCE_ID || '1';
const PORT = BASE_PORT + (parseInt(INSTANCE_ID) - 1);

// Función para logs limpios
const log = (message, error = false) => {
  const timestamp = new Date().toISOString();
  const prefix = error ? '❌ ERROR:' : '✅ INFO:';
  console.log(`[${timestamp}] ${prefix} ${message}`);
};

const main = async () => {
  try {
    log(`Iniciando Bot ${INSTANCE_ID}...`);
    await db.testConnection();
    log('Conexión a base de datos establecida');

    const adapterFlow = templates;
    let adapterProvider;

    if (config.provider === 'meta') {
      adapterProvider = providerMeta;
      log('Usando provider Meta');
    } else if (config.provider === 'baileys') {
      adapterProvider = providerBaileys;
      log('Usando provider Baileys');
    } else {
      throw new Error('ERROR: Falta agregar un provider al .env');
    }

    const adapterDB = new Database();

    const { httpServer, bot } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
      settings: {
        host: '0.0.0.0',
      },
    });

    // Configurar eventos del bot
    bot.on('ready', () => {
      log('Bot listo y conectado');
    });

    bot.on('require_action', () => {
      log('Bot esperando QR');
    });

    bot.on('message', () => {
      log('Mensaje recibido');
    });

    httpServer(PORT);
    log(`Servidor iniciado en puerto ${PORT}`);

    reminder(adapterProvider);
    log('Servicio de recordatorios iniciado');

    log('Bot iniciado correctamente');
  } catch (error) {
    log(error.message, true);
    process.exit(1);
  }
};

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  log(`Error no capturado: ${err.message}`, true);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`Promesa rechazada no manejada: ${reason}`, true);
  process.exit(1);
});

main();
