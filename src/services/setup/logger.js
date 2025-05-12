const getTimestamp = () => new Date().toISOString()

// Niveles de log para controlar la verbosidad
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
}

// Definir el nivel de log actual basado en variables de entorno
// Por defecto en producción solo muestra hasta INFO (2)
// En desarrollo muestra hasta TRACE (4)
const getCurrentLogLevel = () => {
  const envLogLevel = process.env.LOG_LEVEL
    ? parseInt(process.env.LOG_LEVEL)
    : null
  if (envLogLevel !== null && !isNaN(envLogLevel)) {
    return envLogLevel
  }
  return process.env.NODE_ENV === 'production'
    ? LOG_LEVELS.INFO
    : LOG_LEVELS.TRACE
}

// Obtener el nivel de log actual
const currentLogLevel = getCurrentLogLevel()

export const logger = {
  error: (message, error = null) => {
    // Errores siempre se muestran en cualquier nivel
    console.error(`[${getTimestamp()}] ❌ ERROR: ${message}`)
    if (error) {
      console.error(error)
    }
  },

  warn: (message) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(`[${getTimestamp()}] ⚠️ WARN: ${message}`)
    }
  },

  info: (message) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`[${getTimestamp()}] ✅ INFO: ${message}`)
    }
  },

  debug: (message) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.debug(`[${getTimestamp()}] 🔍 DEBUG: ${message}`)
    }
  },

  trace: (message) => {
    if (currentLogLevel >= LOG_LEVELS.TRACE) {
      console.debug(`[${getTimestamp()}] 🔎 TRACE: ${message}`)
    }
  },

  // Método para establecer el nivel de log dinámicamente
  setLogLevel: (level) => {
    if (Object.values(LOG_LEVELS).includes(level)) {
      process.env.LOG_LEVEL = level.toString()
    } else {
      console.error(
        `[${getTimestamp()}] ❌ ERROR: Nivel de log inválido: ${level}`
      )
    }
  },

  // Exponer los niveles de log para uso externo
  levels: LOG_LEVELS,
}
