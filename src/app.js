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

    // Verificar variables de entorno
    log('Verificando configuración...');
    if (!config.provider) {
      throw new Error('Falta configurar provider en .env');
    }

    // Verificar conexión a base de datos
    log('Conectando a base de datos...');
    await db.testConnection();
    log('Conexión a base de datos establecida');

    // Configurar provider
    let adapterProvider;
    if (config.provider === 'meta') {
      adapterProvider = providerMeta;
      log('Usando provider Meta');
    } else if (config.provider === 'baileys') {
      adapterProvider = providerBaileys;
      log('Usando provider Baileys');
    } else {
      throw new Error(`Provider no válido: ${config.provider}`);
    }

    // Verificar templates
    log('Verificando templates...');
    if (!templates || Object.keys(templates).length === 0) {
      throw new Error('No se encontraron templates');
    }
    log(`Templates cargados: ${Object.keys(templates).length}`);

    // Crear instancia de base de datos
    log('Inicializando base de datos en memoria...');
    const adapterDB = new Database();

    // Crear instancia del bot
    log('Creando instancia del bot...');
    const botInstance = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
      settings: {
        host: '0.0.0.0',
        port: PORT,
        name: `Bot-${INSTANCE_ID}`,
      },
    }).catch((error) => {
      log(`Error creando bot: ${error.message}`, true);
      throw error;
    });

    if (!botInstance) {
      throw new Error('createBot devolvió undefined');
    }

    log('Extrayendo componentes del bot...');
    const { httpServer, bot } = botInstance;

    if (!bot) {
      throw new Error('Bot no disponible en la instancia');
    }

    if (!httpServer || typeof httpServer !== 'function') {
      throw new Error('httpServer no disponible o no es una función');
    }

    log('Bot creado correctamente');

    // Configurar eventos del bot
    log('Configurando eventos del bot...');
    bot.on('ready', () => {
      log(`Bot ${INSTANCE_ID} listo y conectado`);
    });

    bot.on('require_action', () => {
      log(`Bot ${INSTANCE_ID} esperando QR`);
    });

    bot.on('message', () => {
      log(`Bot ${INSTANCE_ID} recibió mensaje`);
    });

    bot.on('error', (err) => {
      log(`Error en Bot ${INSTANCE_ID}: ${err.message}`, true);
    });

    log('Eventos configurados correctamente');

    // Iniciar servidor HTTP
    log(`Iniciando servidor en puerto ${PORT}...`);
    await new Promise((resolve, reject) => {
      try {
        httpServer(PORT);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    log(`Servidor HTTP iniciado en puerto ${PORT}`);

    // Iniciar recordatorios
    log('Iniciando servicio de recordatorios...');
    try {
      reminder(adapterProvider);
      log('Servicio de recordatorios iniciado');
    } catch (error) {
      log(`Error iniciando recordatorios: ${error.message}`, true);
    }

    log(`Bot ${INSTANCE_ID} iniciado completamente`);
  } catch (error) {
    log(`Error fatal en Bot ${INSTANCE_ID}: ${error.message}`, true);
    if (error.stack) {
      log(`Stack: ${error.stack}`, true);
    }
    process.exit(1);
  }
};

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  log(`Error no capturado en Bot ${INSTANCE_ID}: ${err.message}`, true);
  if (err.stack) {
    log(`Stack: ${err.stack}`, true);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`Promesa rechazada no manejada en Bot ${INSTANCE_ID}: ${reason}`, true);
  if (reason instanceof Error && reason.stack) {
    log(`Stack: ${reason.stack}`, true);
  }
  process.exit(1);
});

main();
