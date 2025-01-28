import fs from "fs";
import { config } from "../../config/index.js";
import { updateBotStatus } from "../../web/server.js";
import { logger } from "./logger.js";

export const botService = {
  checkSession() {
    const sessionPath = "./bot_sessions";

    try {
      if (!fs.existsSync(sessionPath)) {
        updateBotStatus({ state: "disconnected" });
        return;
      }

      const files = fs.readdirSync(sessionPath);
      const qrFile = files.find((f) => f.endsWith("_qr.png"));

      if (qrFile) {
        updateBotStatus({
          state: "show_qr",
          qr: `/bot_sessions/${qrFile}`,
        });
      } else if (files.some((f) => f.endsWith(".json"))) {
        updateBotStatus({
          state: "connected",
          phoneBot: config.P_NUMBER,
        });
      } else {
        updateBotStatus({ state: "connecting" });
      }
    } catch (error) {
      logger.error("Error verificando sesión:", error);
      updateBotStatus({
        state: "error",
        error: "Error verificando estado del bot",
      });
    }
  },

  startStatusCheck() {
    setInterval(() => this.checkSession(), 30000);
    this.checkSession();
  },
};
