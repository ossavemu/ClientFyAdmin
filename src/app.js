import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { config } from './config/index.js';
import { db } from './database/connection.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { assistantService } from './services/assistantService.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';

const PORT = config.PORT;

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
    let botNumber;

    if (config.provider === 'meta') {
      adapterProvider = providerMeta;
      botNumber = config.numberId;

      if (!botNumber) {
        throw new Error('ERROR: numberId no está configurado en .env');
      }

      log(`Usando provider Meta (${botNumber})`);
    } else if (config.provider === 'baileys') {
      adapterProvider = providerBaileys;
      botNumber = config.P_NUMBER;

      if (!botNumber) {
        throw new Error('ERROR: P_NUMBER no está configurado en .env');
      }

      log(`Usando provider Baileys (${botNumber})`);
    } else {
      throw new Error('ERROR: Falta agregar un provider al .env');
    }

    // Validar formato del número antes de registrarlo
    if (!botNumber.match(/^\d+$/)) {
      throw new Error(`ERROR: Número de bot inválido: ${botNumber}`);
    }

    log('Registrando bot...');
    await assistantService.registerBotNumber(botNumber, config.provider);
    log(`Bot registrado: ${botNumber} (${config.provider})`);

    const adapterDB = new Database();

    const { httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    httpServer(+PORT);
    log(`Servidor iniciado en puerto ${PORT}`);

    reminder(adapterProvider);
    log('Servicio de recordatorios iniciado');

    log('Bot y servicios iniciados correctamente');
  } catch (error) {
    log(error.message, true);
    process.exit(1);
  }
};

main();
