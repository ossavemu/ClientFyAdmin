import { config } from "../../config/index.js";
import { providerBaileys, providerMeta } from "../../provider/index.js";
import { logger } from "./logger.js";

export const providerService = {
  getProvider() {
    let provider;
    let botNumber;

    if (config.provider === "meta") {
      provider = providerMeta;
      botNumber = config.numberId;
      logger.info(`Usando provider Meta (${botNumber})`);
    } else if (config.provider === "baileys") {
      provider = providerBaileys;
      botNumber = config.P_NUMBER;
      logger.info(`Usando provider Baileys (${botNumber})`);
    } else {
      throw new Error("ERROR: Provider no válido en .env");
    }

    return { provider, botNumber };
  },
};
