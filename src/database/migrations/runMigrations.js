import { db } from "../connection.js";
import * as initialSchema from "./001_initial_schema.js";
import * as agendaTable from "./002_agenda_table.js";
import * as assistantsTable from "./003_assistants_table.js";
import * as hotUsersExpiry from "./005_hot_users_expiry.js";
import * as historicBotNumber from "./006_historic_bot_number.js";
import * as defaultBots from "./007_default_bots.js";

// Orden para crear (las dependientes al final)
const migrationsUp = [
  { name: "Initial Schema", ...initialSchema },
  { name: "Agenda Table", ...agendaTable },
  { name: "Assistants Table", ...assistantsTable },
  { name: "Hot Users Expiry", ...hotUsersExpiry },
  { name: "Default Bots", ...defaultBots },
  { name: "Historic Bot Number", ...historicBotNumber },
];

// Orden para eliminar (las dependientes primero)
const migrationsDown = [
  { name: "Historic Bot Number", ...historicBotNumber },
  { name: "Hot Users Expiry", ...hotUsersExpiry },
  { name: "Assistants Table", ...assistantsTable },
  { name: "Agenda Table", ...agendaTable },
  { name: "Default Bots", ...defaultBots },
  { name: "Initial Schema", ...initialSchema },
];

export const up = async () => {
  try {
    console.log("🔄 Ejecutando migraciones...");
    for (const migration of migrationsUp) {
      console.log(`Ejecutando migración: ${migration.name}`);
      await migration.up(db);
    }
    console.log("✅ Migraciones completadas");
  } catch (error) {
    console.error("❌ Error en migraciones:", error);
    throw error;
  }
};

export const down = async () => {
  try {
    console.log("🔄 Revirtiendo migraciones...");
    for (const migration of migrationsDown) {
      console.log(`Revirtiendo migración: ${migration.name}`);
      await migration.down(db);
    }
    console.log("✅ Migraciones revertidas");
  } catch (error) {
    console.error("❌ Error revirtiendo migraciones:", error);
    throw error;
  }
};

// Si se ejecuta directamente
if (process.argv[2] === "up") {
  up().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (process.argv[2] === "down") {
  down().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
