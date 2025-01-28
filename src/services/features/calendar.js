import { google } from "googleapis";
import { config } from "../../config/index.js";
import { db } from "../../database/connection.js";
import { getCalendarCredentials } from "../../utils/getCalendarCredentials.js";

// Cache para almacenar IDs de calendario por número de bot
const calendarIdCache = new Map();

// Función para inicializar la autenticación
async function initializeAuth() {
  try {
    const credentials = await getCalendarCredentials();

    // Verificar que todos los campos necesarios estén presentes
    const requiredFields = [
      "client_email",
      "private_key",
      "project_id",
      "client_id",
    ];

    for (const field of requiredFields) {
      if (!credentials[field]) {
        throw new Error(
          `Las credenciales no contienen el campo requerido: ${field}`
        );
      }
    }

    // Asegurarse de que la clave privada esté en el formato correcto
    if (credentials.private_key.includes("\\n")) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }

    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
      subject: credentials.client_email, // Usar el client_email de las credenciales
    });
  } catch (error) {
    console.error("Error al inicializar la autenticación:", error);
    throw new Error(`Error de autenticación: ${error.message}`);
  }
}

// Función para obtener el ID del calendario desde la base de datos
async function getCalendarIdFromDB(botNumber) {
  try {
    const results = await db.sql`
      SELECT calendar_id 
      FROM calendar_ids 
      WHERE bot_number = ${botNumber}
    `;
    return results[0]?.calendar_id;
  } catch (error) {
    console.error("Error getting calendar ID from DB:", error);
    throw error;
  }
}

// Función para guardar el ID del calendario en la base de datos
async function saveCalendarIdToDB(botNumber, calendarId) {
  try {
    await db.sql`
      INSERT INTO calendar_ids (bot_number, calendar_id)
      VALUES (${botNumber}, ${calendarId})
      ON CONFLICT (bot_number) 
      DO UPDATE SET 
        calendar_id = ${calendarId},
        updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error("Error saving calendar ID to DB:", error);
    throw error;
  }
}

// Nueva función para obtener o crear calendario para un bot específico
async function getOrCreateCalendar(botNumber) {
  try {
    // Primero intentar obtener de la base de datos
    const existingCalendarId = await getCalendarIdFromDB(botNumber);
    if (existingCalendarId) {
      return existingCalendarId;
    }

    const auth = await initializeAuth();
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const calendar = google.calendar({ version: "v3" });

    // Buscar calendario existente en Google Calendar
    const calendarList = await calendar.calendarList.list();
    const existingCalendar = calendarList.data.items.find(
      (cal) => cal.summary === `ClientFy Bot ${botNumber}`
    );

    if (existingCalendar) {
      // Guardar en DB y retornar
      await saveCalendarIdToDB(botNumber, existingCalendar.id);
      return existingCalendar.id;
    }

    // Crear nuevo calendario si no existe
    const newCalendar = await calendar.calendars.insert({
      requestBody: {
        summary: `ClientFy Bot ${botNumber}`,
        description: `Calendario para el bot ${botNumber}`,
        timeZone: config.calendar.timeZone,
      },
    });

    // Guardar el nuevo calendario en DB
    await saveCalendarIdToDB(botNumber, newCalendar.data.id);
    return newCalendar.data.id;
  } catch (error) {
    console.error("Error en getOrCreateCalendar:", error);
    throw error;
  }
}

const timeZone = "America/Cancun";

const rangeLimit = {
  days: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
};

const standardDuration = 1;

const dateLimit = 30;

export async function createEvent(
  eventName,
  description,
  date,
  botNumber,
  duration = config.calendar.standardDuration
) {
  try {
    const calendarId = await getOrCreateCalendar(botNumber);
    const auth = await initializeAuth();
    const authClient = await auth.getClient();

    google.options({ auth: authClient });

    console.log("Input date:", date);
    console.log("Input duration:", duration);

    const startDate = new Date(date);
    console.log("Start date object:", startDate);
    console.log("Start date hours:", startDate.getHours());
    console.log("Start date ISO:", startDate.toISOString());

    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + duration);
    console.log("End date object:", endDate);
    console.log("End date hours:", endDate.getHours());
    console.log("End date ISO:", endDate.toISOString());

    const event = {
      summary: eventName,
      description: description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timeZone,
      },
      colorId: "2",
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await google.calendar({ version: "v3" }).events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    const eventId = response.data.id;

    console.log(`Event created: ${eventId}`);

    return eventId;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
}

export async function listAvailableSlots(
  botNumber,
  startDate = new Date(),
  endDate
) {
  try {
    const calendarId = await getOrCreateCalendar(botNumber);
    const auth = await initializeAuth();
    const authClient = await auth.getClient();

    google.options({ auth: authClient });

    if (!endDate) {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + dateLimit);
    }

    const response = await google.calendar({ version: "v3" }).events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      timeZone: timeZone,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items;

    const slots = [];

    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();

      if (rangeLimit.days.includes(dayOfWeek)) {
        for (
          let hour = rangeLimit.startHour;
          hour < rangeLimit.endHour;
          hour++
        ) {
          const slotStart = new Date(currentDate);

          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);

          slotEnd.setHours(hour + standardDuration);

          const isBusy = events.some((event) => {
            const eventStart = new Date(
              event.start.dateTime || event.start.date
            );

            const eventEnd = new Date(event.end.dateTime || event.end.date);

            return slotStart < eventEnd && slotEnd > eventStart;
          });

          if (!isBusy) {
            slots.push({
              start: slotStart,
              end: slotEnd,
            });
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return slots;
  } catch (error) {
    console.error("Error listing available slots:", error);
    throw error;
  }
}

export async function getNextAvailableSlot(date, botNumber) {
  try {
    if (typeof date === "string") {
      date = new Date(date);
    } else if (!(date instanceof Date || isNaN(date))) {
      throw new Error("Invalid Date");
    }

    const availableSlots = await listAvailableSlots(botNumber, date);

    const filteredSlots = availableSlots.filter(
      (slot) => new Date(slot.start) > date
    );

    const sortedSlots = filteredSlots.sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );

    return sortedSlots.length > 0 ? sortedSlots[0] : null;
  } catch (error) {
    console.error("Error getting next available slot:", error);
    throw error;
  }
}

export async function isDateAvailable(date, botNumber) {
  try {
    const currentDate = new Date();

    const maxDate = new Date(date);

    maxDate.setDate(maxDate.getDate() + dateLimit);

    if (date < currentDate || date > maxDate) {
      return false;
    }

    const dayOfWeek = date.getDay();

    if (!rangeLimit.days.includes(dayOfWeek)) {
      return false;
    }

    const hour = date.getHours();

    if (hour < rangeLimit.startHour || hour >= rangeLimit.endHour) {
      return false;
    }

    const availableSlots = await listAvailableSlots(botNumber, currentDate);

    const slotsOnGivenDate = availableSlots.filter(
      (slot) => new Date(slot.start).toDateString() === date.toDateString()
    );

    const isSlotAvailable = slotsOnGivenDate.some(
      (slot) =>
        new Date(slot.start).getTime() === date.getTime() &&
        new Date(slot.end).getTime() ===
          date.getTime() + standardDuration * 60 * 60 * 1000
    );

    return isSlotAvailable;
  } catch (error) {
    console.error("Error checking if date is available:", error);
    throw error;
  }
}
