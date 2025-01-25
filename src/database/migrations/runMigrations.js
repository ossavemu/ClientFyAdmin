import { db } from "../connection.js";
import * as initialSchema from "./001_initial_schema.js";
import * as agendaTable from "./002_agenda_table.js";
import * as assistantsTable from "./003_assistants_table.js";
import * as hotUsersExpiry from "./005_hot_users_expiry.js";
import * as historicBotNumber from "./006_historic_bot_number.js";
import * as defaultBots from "./007_default_bots.js";
import * as mutedUsers from "./008_muted_users.js";
import * as bannedUsers from "./009_banned_users.js";
import * as removeMutedUsers from "./010_remove_muted_users.js";
import * as calendarIds from "./011_calendar_ids.js";

// Orden para crear (las dependientes al final)
const migrationsUp = [
  { name: "Initial Schema", ...initialSchema },
  { name: "Agenda Table", ...agendaTable },
  { name: "Assistants Table", ...assistantsTable },
  { name: "Hot Users Expiry", ...hotUsersExpiry },
  { name: "Default Bots", ...defaultBots },
  { name: "Historic Bot Number", ...historicBotNumber },
  { name: "Muted Users", ...mutedUsers },
  { name: "Banned Users", ...bannedUsers },
  { name: "Remove Muted Users", ...removeMutedUsers },
  { name: "Calendar IDs", ...calendarIds },
];

// Orden para eliminar (las dependientes primero)
const migrationsDown = [
  { name: "Calendar IDs", ...calendarIds },
  { name: "Remove Muted Users", ...removeMutedUsers },
  { name: "Banned Users", ...bannedUsers },
  { name: "Muted Users", ...mutedUsers },
  { name: "Historic Bot Number", ...historicBotNumber },
  { name: "Hot Users Expiry", ...hotUsersExpiry },
  { name: "Assistants Table", ...assistantsTable },
  { name: "Agenda Table", ...agendaTable },
  { name: "Default Bots", ...defaultBots },
  { name: "Initial Schema", ...initialSchema },
];

const runMigration = async (migration, isUp = true) => {
  try {
    console.log(
      `${isUp ? "Ejecutando" : "Revirtiendo"} migración: ${migration.name}`
    );
    await (isUp ? migration.up(db) : migration.down(db));
    console.log(`✅ ${migration.name} completada`);
  } catch (error) {
    console.error(`❌ Error en ${migration.name}:`, error);
    throw error;
  }
};

export const up = async () => {
  try {
    console.log("🔄 Ejecutando migraciones...");
    for (const migration of migrationsUp) {
      await runMigration(migration, true);
    }
    console.log("✅ Todas las migraciones completadas");
  } catch (error) {
    console.error("❌ Error en migraciones:", error);
    throw error;
  }
};

export const down = async () => {
  try {
    console.log("🔄 Revirtiendo migraciones...");
    for (const migration of migrationsDown) {
      await runMigration(migration, false);
    }
    console.log("✅ Todas las migraciones revertidas");
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
