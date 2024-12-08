import { down as downInitial, up as upInitial } from './001_initial_schema.js';
import { down as downAgenda, up as upAgenda } from './002_agenda_table.js';
import {
  down as downAssistants,
  up as upAssistants,
} from './003_assistants_table.js';
import {
  down as downBotAssistants,
  up as upBotAssistants,
} from './004_bot_assistants_table.js';

async function runMigrations() {
  try {
    await upInitial();
    await upAgenda();
    await upAssistants();
    await upBotAssistants();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('Attempting rollback...');
    try {
      await downBotAssistants();
      await downAssistants();
      await downAgenda();
      await downInitial();
      console.log('Rollback completed successfully');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    process.exit(1);
  }
}

runMigrations();
