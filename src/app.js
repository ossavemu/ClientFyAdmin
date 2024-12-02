import { createBot, MemoryDB as Database } from '@builderbot/bot';
import express from 'express';
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

    // Crear servidor Express primero
    const app = express();

    // Iniciar Express antes que nada
    const expressServer = await new Promise((resolve, reject) => {
      const server = app
        .listen(80, '0.0.0.0', () => {
          log('Servidor QR iniciado en puerto 80');
          resolve(server);
        })
        .on('error', (err) => {
          if (err.code === 'EACCES') {
            log(
              'Error: Se requieren privilegios de root para el puerto 80',
              true
            );
          } else if (err.code === 'EADDRINUSE') {
            log('Error: El puerto 80 ya está en uso', true);
          } else {
            log(`Error iniciando servidor Express: ${err.message}`, true);
          }
          reject(err);
        });
    });

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

    // Configurar ruta para el QR
    app.get(`/bot${INSTANCE_ID}`, (req, res) => {
      const qrCode = bot.getQRCode();
      if (qrCode) {
        res.send(`
          <html>
            <head>
              <title>Bot ${INSTANCE_ID} QR Code</title>
              <meta http-equiv="refresh" content="10">
            </head>
            <body>
              <h1>Bot ${INSTANCE_ID} QR Code</h1>
              <img src="${qrCode}" alt="QR Code">
            </body>
          </html>
        `);
      } else {
        res.send(`Bot ${INSTANCE_ID} ya está conectado`);
      }
    });

    // Agregar ruta de health check
    app.get('/health', (req, res) => {
      res.send('OK');
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

    httpServer(PORT);
    log(`Servidor bot iniciado en puerto ${PORT}`);

    reminder(adapterProvider);
    log('Servicio de recordatorios iniciado');

    log('Bot y servicios iniciados correctamente');
  } catch (error) {
    log(error.message, true);
    process.exit(1);
  }
};

main();
