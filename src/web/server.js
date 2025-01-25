import express from "express";
import { createServer } from "http";
import { config } from "../config/index.js";
import { db } from "../database/connection.js";
import { initializeSocket, isMuted, socket } from "./socket.js";

const app = express();
const httpServer = createServer(app);
const io = initializeSocket(httpServer);

// Estado global del bot
let botStatus = {
  state: "disconnected", // disconnected, connecting, show_qr, connected, error
  phoneBot: null,
  qr: null,
  error: null,
};

// Mantener un registro en memoria de los usuarios activos
const activeUsers = new Map();

// Servir archivos estáticos solo en /panel
app.use("/panel", express.static("src/web/public"));

// Endpoint para obtener el estado del bot
app.get("/api/status", (req, res) => {
  const response = {
    status: botStatus.state,
    phoneBot: botStatus.phoneBot || config.P_NUMBER,
    ...(botStatus.qr && { qr: botStatus.qr }),
    ...(botStatus.error && { error: botStatus.error }),
  };
  res.json(response);
});

// Redirigir / a /panel
app.get("/", (req, res) => {
  res.redirect("/panel");
});

// Endpoint para obtener el historial
app.get("/api/history", async (req, res) => {
  try {
    const botNumber = config.P_NUMBER; // Usar la configuración en lugar de process.env

    const history = await db.sql`
      WITH unique_users AS (
        SELECT DISTINCT
          h.phone_number,
          wu.name as user_name,
          FIRST_VALUE(h.created_at) OVER (
            PARTITION BY h.phone_number 
            ORDER BY h.created_at DESC
          ) as last_interaction,
          COALESCE(mu.until, null) as muted_until
        FROM historic h
        LEFT JOIN ws_users wu ON h.phone_number = wu.phone_number
        LEFT JOIN muted_users mu ON h.phone_number = mu.phone_number
        WHERE h.phone_number != ${botNumber}
        AND h.bot_number = ${botNumber}
        AND h.provider = 'user'
      )
      SELECT * FROM unique_users
      ORDER BY last_interaction DESC
    `;

    console.log("Usuarios encontrados:", history.length);
    res.json(history);
  } catch (error) {
    console.error("Error en /api/history:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para banear/desbanear usuarios
app.post("/api/ban/:phoneNumber", express.json(), async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { reason, botNumber } = req.body;

    if (reason) {
      await db.sql`
        INSERT INTO banned_users (phone_number, bot_number, reason)
        VALUES (${phoneNumber}, ${botNumber}, ${reason})
        ON CONFLICT (phone_number, bot_number) 
        DO NOTHING
      `;
    } else {
      await db.sql`
        DELETE FROM banned_users 
        WHERE phone_number = ${phoneNumber} 
        AND bot_number = ${botNumber}
      `;
    }

    socket.emit("userBanUpdated", { phoneNumber, botNumber, reason });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener usuarios activos
app.get("/api/active-users", async (req, res) => {
  try {
    const botNumber = config.P_NUMBER;

    // Obtener usuarios que han interactuado en la última hora
    const users = await db.sql`
      SELECT DISTINCT
        h.phone_number,
        wu.name as user_name,
        MAX(h.created_at) as last_interaction,
        h.message_content as last_message
      FROM historic h
      LEFT JOIN ws_users wu ON h.phone_number = wu.phone_number
      WHERE h.bot_number = ${botNumber}
      AND h.provider = 'user'
      AND h.created_at > datetime('now', '-1 hour')
      GROUP BY h.phone_number
      ORDER BY last_interaction DESC
    `;

    // Agregar estado de mute desde la memoria
    const activeUsers = users.map((user) => ({
      ...user,
      status: isMuted(user.phone_number) ? "muted" : "active",
    }));

    res.json(activeUsers);
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para mutear usuarios
app.post("/api/mute/:phoneNumber", express.json(), async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { minutes } = req.body;
    const botNumber = config.P_NUMBER;

    await db.sql`
      INSERT INTO muted_users (phone_number, bot_number, until)
      VALUES (
        ${phoneNumber}, 
        ${botNumber}, 
        datetime('now', '+' || ${minutes} || ' minutes')
      )
      ON CONFLICT (phone_number, bot_number) 
      DO UPDATE SET until = datetime('now', '+' || ${minutes} || ' minutes')
    `;

    socket.emit("userMuteUpdated", { phoneNumber, minutes });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para quitar mute
app.post("/api/unmute/:phoneNumber", express.json(), async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { sendMessage } = req.body;
    const botNumber = config.P_NUMBER;

    await db.sql`
      DELETE FROM muted_users 
      WHERE phone_number = ${phoneNumber}
      AND bot_number = ${botNumber}
    `;

    if (sendMessage) {
      socket.emit("sendContinuationMessage", { phoneNumber });
    }

    socket.emit("userUnmuted", { phoneNumber });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar funciones para usar en welcomeFlow.js
export const notifyNewUser = async (phoneNumber, name) => {
  try {
    socket.emit("newUser", {
      phone_number: phoneNumber,
      user_name: name || "Usuario",
      status: isMuted(phoneNumber) ? "muted" : "active",
    });
  } catch (error) {
    console.error("Error notificando nuevo usuario:", error);
  }
};

// Exportar funciones para actualizar el estado del bot
export const updateBotStatus = (status) => {
  botStatus = { ...botStatus, ...status };
  // Notificar a los clientes web sobre el cambio de estado
  socket.emit("botStatusChanged", botStatus);
};

// Exportar para usar en app.js
export const webServer = httpServer;
export { app };
