import { createBot, MemoryDB as Database } from '@builderbot/bot';
import { config } from './config/index.js';
import { providerBaileys, providerMeta } from './provider/index.js';
import { reminder } from './services/reminder.js';
import templates from './templates/index.js';

const PORT = config.PORT;

const main = async () => {
  const adapterFlow = templates;
  let adapterProvider;
  if (config.provider === 'meta') {
    adapterProvider = providerMeta;
  } else if (config.provider === 'baileys') {
    adapterProvider = providerBaileys;
  } else {
    console.log('ERROR: Falta agregar un provider al .env');
  }

  const adapterDB = new Database();

  const { httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  httpServer(+PORT);

  if (!(adapterDB instanceof Database)) {
    reminder(adapterDB, adapterProvider);
  }
};

main();
