import { config } from "../../config/index.js";
import { providerBaileys, providerMeta } from "../../provider/index.js";
import { logger } from "./logger.js";

export const providerService = {
  getProvider() {
    const providerName = config.provider?.toLowerCase();
    let provider;
    let botNumber;

    if (providerName === "meta") {
      provider = providerMeta;
      botNumber = config.numberId;
      logger.info(`Usando provider Meta (${botNumber})`);
    } else if (providerName === "baileys") {
      provider = providerBaileys;
      botNumber = config.P_NUMBER;
      logger.info(`Usando provider Baileys (${botNumber})`);
    } else {
      throw new Error(`ERROR: Provider no válido: ${config.provider}`);
    }

    return { provider, botNumber };
  },
};
