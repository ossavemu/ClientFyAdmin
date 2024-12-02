import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { createServer } from 'net';
import { config } from './config/index.js';
import { db } from './database/connection.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';
import { TunnelService } from './services/tunnels.js';

// Modificamos para tener un rango de puertos
const BASE_PORT = 3008;
const INSTANCE_ID = process.env.INSTANCE_ID || '1';
const PORT = BASE_PORT + (parseInt(INSTANCE_ID) - 1);

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

    // Encontrar un puerto disponible
    const availablePort = await findAvailablePort(PORT);
    if (availablePort !== PORT) {
      log(`Puerto ${PORT} en uso, usando puerto alternativo ${availablePort}`);
    }

    const { httpServer, serverHttp } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    // Añadir endpoint para túneles antes de iniciar el servidor
    serverHttp.get('/tunnels', async (req, res) => {
      try {
        const tunnels = await TunnelService.getTunnels();
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify(
            {
              status: 'success',
              data: tunnels,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
      } catch (error) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            status: 'error',
            message: error.message,
          })
        );
      }
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
