import { createProvider } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MetaProvider } from "@builderbot/provider-meta";
import { config } from "../config/index.js";

const providerMeta = createProvider(MetaProvider, {
  jwtToken: config.jwtToken,
  numberId: config.numberId,
  verifyToken: config.verifyToken,
  version: config.version,
});

const providerBaileys = createProvider(BaileysProvider);

export { providerBaileys, providerMeta };
