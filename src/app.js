import { createBot, MemoryDB as Database } from '@builderbot/bot';
import fs from 'fs/promises';
import { createServer } from 'net';
import path from 'path';
import { config } from './config/index.js';
import { db } from './database/connection.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';

// Modificamos para tener un rango de puertos
const BASE_PORT = 3008;
const INSTANCE_ID = process.env.INSTANCE_ID || '1';
const PORT = BASE_PORT + (parseInt(INSTANCE_ID) - 1);

// Función para actualizar el estado en el archivo JSON
const updateBotState = async (state) => {
  try {
    const stateFile = path.join(process.cwd(), '..', 'data', 'bot_states.json');
    let states = {};

    try {
      const data = await fs.readFile(stateFile, 'utf8');
      states = JSON.parse(data);
    } catch (error) {
      // Si el archivo no existe o está corrupto, empezamos con un objeto vacío
    }

    states[INSTANCE_ID] = {
      ...state,
      lastUpdate: new Date().toISOString(),
      port: PORT,
    };

    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify(states, null, 2));
  } catch (error) {
    console.error('Error actualizando estado:', error);
  }
};

// Función para encontrar un puerto disponible
const findAvailablePort = async (startPort) => {
  const isPortAvailable = (port) => {
    return new Promise((resolve) => {
      const server = createServer()
        .listen(port, () => {
          server.close();
          resolve(true);
        })
        .on('error', () => {
          resolve(false);
        });
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
};

// Función para logs limpios
const log = (message, error = false) => {
  const timestamp = new Date().toISOString();
  const prefix = error ? '❌ ERROR:' : '✅ INFO:';
  console.log(`[${timestamp}] ${prefix} ${message}`);
};

const main = async () => {
  try {
    log('Iniciando aplicación...');
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

    const availablePort = await findAvailablePort(PORT);
    if (availablePort !== PORT) {
      log(`Puerto ${PORT} en uso, usando puerto alternativo ${availablePort}`);
    }

    const { httpServer, bot } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
      settings: {
        host: '0.0.0.0',
      },
    });

    // Manejar eventos de conexión
    bot.on('ready', () => {
      updateBotState({
        paired: true,
        status: 'connected',
      });
    });

    bot.on('require_action', () => {
      updateBotState({
        paired: false,
        status: 'waiting_qr',
      });
    });

    bot.on('message', () => {
      updateBotState({
        paired: true,
        status: 'connected',
      });
    });

    // Inicializar estado como desconectado
    await updateBotState({
      paired: false,
      status: 'starting',
    });

    httpServer(availablePort);
    log(`Servidor iniciado en puerto ${availablePort}`);

    reminder(adapterProvider);
    log('Servicio de recordatorios iniciado');

    log('Bot y servicios iniciados correctamente');
  } catch (error) {
    log(error.message, true);
    process.exit(1);
  }
};

main();
