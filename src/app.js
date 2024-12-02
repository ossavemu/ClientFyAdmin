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

    // Configurar provider
    const provider =
      config.provider === 'meta' ? providerMeta : providerBaileys;
    log(`Usando provider: ${config.provider}`);

    // Configurar base de datos
    const database = new Database();
    log('Base de datos en memoria inicializada');

    // Verificar templates
    if (!templates || Object.keys(templates).length === 0) {
      throw new Error('No se encontraron templates');
    }
    log(`Templates cargados: ${Object.keys(templates).length}`);

    // Crear bot con configuración explícita
    const botConfig = {
      flow: templates,
      provider: provider,
      database: database,
      settings: {
        name: `Bot-${INSTANCE_ID}`,
        port: PORT,
        blackList: [],
        timeout: 30000,
      },
    };

    log('Creando instancia del bot...');
    const instance = await createBot(botConfig);

    if (!instance) {
      throw new Error('createBot devolvió undefined');
    }

    log('Instancia creada, configurando componentes...');

    // Extraer componentes
    const { bot, httpServer } = instance;

    // Configurar eventos del bot
    if (bot) {
      bot.on('ready', () => log('Bot conectado'));
      bot.on('require_action', () => log('Esperando QR'));
      bot.on('message', () => log('Mensaje recibido'));
      bot.on('error', (err) => log(`Error del bot: ${err.message}`));
      log('Eventos del bot configurados');
    } else {
      throw new Error('Bot no disponible después de crear la instancia');
    }

    // Iniciar servidor HTTP
    if (typeof httpServer === 'function') {
      httpServer(PORT);
      log(`Servidor HTTP iniciado en puerto ${PORT}`);
    } else {
      throw new Error('httpServer no es una función');
    }

    // Iniciar recordatorios
    try {
      reminder(provider);
      log('Servicio de recordatorios iniciado');
    } catch (error) {
      log(`Warning: Error iniciando recordatorios: ${error.message}`);
    }

    log('Bot iniciado completamente');
  } catch (error) {
    log(`Error fatal: ${error.message}`);
    if (error.stack) {
      log(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
};

// Manejo de errores global
process.on('uncaughtException', (err) => {
  log(`Error no capturado: ${err.message}`);
  if (err.stack) {
    log(`Stack: ${err.stack}`);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`Promesa rechazada: ${reason}`);
  if (reason instanceof Error && reason.stack) {
    log(`Stack: ${reason.stack}`);
  }
  process.exit(1);
});

main().catch((error) => {
  log(`Error en main: ${error.message}`);
  if (error.stack) {
    log(`Stack: ${error.stack}`);
  }
  process.exit(1);
});
