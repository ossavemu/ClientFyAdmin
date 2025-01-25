const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message) => {
    console.log(`[${getTimestamp()}] ✅ INFO: ${message}`);
  },

  error: (message, error = null) => {
    console.error(`[${getTimestamp()}] ❌ ERROR: ${message}`);
    if (error) {
      console.error(error);
    }
  },

  warn: (message) => {
    console.warn(`[${getTimestamp()}] ⚠️ WARN: ${message}`);
  },

  debug: (message) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[${getTimestamp()}] 🔍 DEBUG: ${message}`);
    }
  },
};
