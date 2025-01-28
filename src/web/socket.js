import { Server } from "socket.io";
import { config } from "../config/index.js";
import { chat } from "../services/ai/chatgpt.js";

let io;
const mutedUsers = new Map(); // Almacena {phoneNumber: {messages: [], lastThread: null}}
let messageHandler = null;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("Cliente web conectado");

    socket.on("muteUser", ({ phoneNumber }) => {
      mutedUsers.set(phoneNumber, { messages: [], lastThread: null });
      io.emit("userStatusChanged", { phoneNumber, status: "muted" });
    });

    socket.on(
      "unmuteUser",
      async ({ phoneNumber, sendMessage, useContext }) => {
        const userData = mutedUsers.get(phoneNumber);
        if (!userData) return;

        if (sendMessage && useContext && messageHandler) {
          const combinedMessages = userData.messages.join("\n");
          // Usar el último thread conocido y los mensajes acumulados
          const response = await chat(
            combinedMessages,
            config.P_NUMBER,
            null,
            userData.lastThread
          );

          // Usar el messageHandler para enviar la respuesta
          await messageHandler(phoneNumber, response.response);
        }

        mutedUsers.delete(phoneNumber);
        io.emit("userStatusChanged", { phoneNumber, status: "active" });
      }
    );

    socket.on("disconnect", () => {
      console.log("Cliente web desconectado");
    });

    // Agregar manejo de errores para las conexiones WebSocket
    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("Cliente web desconectado:", reason);
    });
  });

  return io;
};

// Registrar el handler para enviar mensajes
export const registerMessageHandler = (handler) => {
  messageHandler = handler;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io no ha sido inicializado");
  }
  return io;
};

export const isMuted = (phoneNumber) => {
  return mutedUsers.has(phoneNumber);
};

export const addMutedMessage = (phoneNumber, message, thread) => {
  if (mutedUsers.has(phoneNumber)) {
    const userData = mutedUsers.get(phoneNumber);
    userData.messages.push(message);
    userData.lastThread = thread;
    mutedUsers.set(phoneNumber, userData);
  }
};

export const socket = {
  emit: (event, data) => {
    const socketIO = getIO();
    socketIO.emit(event, data);
  },
};

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // No dejar que el proceso termine
});
