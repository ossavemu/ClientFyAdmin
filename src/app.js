import { createBot, MemoryDB as Database } from '@builderbot/bot';
import express from 'express';
import fs from 'fs/promises';
import { createProxyMiddleware } from 'http-proxy-middleware';
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
    log(`Iniciando Bot ${INSTANCE_ID} en puerto ${PORT}...`);

    // Crear servidor Express para el bot
    const app = express();

    // Agregar middleware para logging
    app.use((req, res, next) => {
      log(`${req.method} ${req.url}`);
      next();
    });

    // Agregar ruta de health check primero
    app.get('/health', (req, res) => {
      res.send('OK');
    });

    await db.testConnection();
    log('Conexión a base de datos establecida');

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

    // Crear el bot primero
    const { httpServer, bot } = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
      settings: {
        host: '0.0.0.0',
      },
    });

    // Esperar a que el bot esté listo
    await new Promise((resolve) => {
      bot.on('ready', () => {
        updateBotState({
          paired: true,
          status: 'connected',
        });
        resolve();
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
    });

    // Inicializar estado como desconectado
    await updateBotState({
      paired: false,
      status: 'starting',
    });

    // Configurar ruta para el QR después de crear el bot
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

    // Iniciar Express en el puerto del bot
    const expressServer = await new Promise((resolve, reject) => {
      try {
        const server = app
          .listen(PORT, '0.0.0.0', () => {
            log(`Bot ${INSTANCE_ID} escuchando en puerto ${PORT}`);
            resolve(server);
          })
          .on('error', (err) => {
            log(`Error iniciando Bot ${INSTANCE_ID}: ${err.message}`, true);
            reject(err);
          });
      } catch (err) {
        log(`Error crítico iniciando Bot ${INSTANCE_ID}: ${err.message}`, true);
        reject(err);
      }
    });

    // Si es la primera instancia, crear el proxy en puerto 80
    if (INSTANCE_ID === '1') {
      log('Iniciando proxy en puerto 80...');
      const proxyApp = express();

      // Configurar proxy para cada bot
      for (let i = 1; i <= 4; i++) {
        const botPort = BASE_PORT + (i - 1);
        log(`Configurando proxy para Bot ${i} en puerto ${botPort}`);
        proxyApp.use(
          `/bot${i}`,
          createProxyMiddleware({
            target: `http://localhost:${botPort}`,
            pathRewrite: {
              [`^/bot${i}`]: `/bot${i}`,
            },
            changeOrigin: true,
            onError: (err, req, res) => {
              log(`Error en proxy para Bot ${i}: ${err.message}`, true);
              res.status(502).send(`Error de proxy: ${err.message}`);
            },
          })
        );
      }

      // Iniciar proxy en puerto 80
      proxyApp
        .listen(80, '0.0.0.0', () => {
          log('Proxy iniciado exitosamente en puerto 80');
        })
        .on('error', (err) => {
          log(`Error iniciando proxy: ${err.message}`, true);
        });
    }

    httpServer(PORT);
    log(`Servidor bot iniciado en puerto ${PORT}`);

    reminder(adapterProvider);
    log('Servicio de recordatorios iniciado');

    log('Bot y servicios iniciados correctamente');
  } catch (error) {
    log(`Error fatal: ${error.message}`, true);
    log(`Stack: ${error.stack}`, true);
    process.exit(1);
  }
};

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  log(`Error no capturado: ${err.message}`, true);
  log(`Stack: ${err.stack}`, true);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Promesa rechazada no manejada: ${reason}`, true);
  process.exit(1);
});

main();
