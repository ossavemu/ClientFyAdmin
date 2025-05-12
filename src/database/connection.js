import { createClient } from '@libsql/client'
import { config } from '../config/index.js'
import { logger } from '../services/setup/logger.js'

if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) {
  throw new Error('Missing Turso configuration. Please check your .env file')
}

// Configuración de la conexión
const DB_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 segundo
  CONNECTION_TIMEOUT: 10000, // 10 segundos
  IDLE_TIMEOUT: 60000, // 1 minuto
}

// Cliente único para toda la aplicación
let tursoClient = null

// Cache para optimizar consultas frecuentes
const queryCache = new Map()
const CACHE_TTL = 60000 // 1 minuto de tiempo de vida para la caché

async function getClient () {
  if (!tursoClient) {
    logger.debug('Creando nueva conexión a Turso DB')
    tursoClient = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
      timeout: DB_CONFIG.CONNECTION_TIMEOUT,
    })
  }
  return tursoClient
}

// Función para limpiar la caché periódicamente
function setupCacheCleaner () {
  // Limpiar cada 5 minutos
  setInterval(() => {
    const now = Date.now()
    let expiredCount = 0

    for (const [key, { timestamp }] of queryCache.entries()) {
      if (now - timestamp > CACHE_TTL) {
        queryCache.delete(key)
        expiredCount++
      }
    }

    if (expiredCount > 0) {
      logger.debug(
        `Limpiadas ${expiredCount} entradas expiradas de la caché de consultas`
      )
    }
  }, 300000) // 5 minutos
}

// Configurar limpiador de caché
setupCacheCleaner()

async function executeWithRetry (operation, retries = DB_CONFIG.MAX_RETRIES) {
  try {
    const client = await getClient()
    return await operation(client)
  } catch (error) {
    if (
      retries > 0 &&
      (error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout'))
    ) {
      logger.warn(
        `Error de conexión, reintentando (${retries} intentos restantes)...`
      )
      await new Promise((resolve) =>
        setTimeout(resolve, DB_CONFIG.RETRY_DELAY)
      )
      tursoClient = null // Reset client on error
      return executeWithRetry(operation, retries - 1)
    }
    throw error
  }
}

// Función para determinar si una consulta es cacheable
function isCacheableQuery (query) {
  // Las consultas SELECT son generalmente cacheables
  return (
    query.trim().toLowerCase().startsWith('select') &&
    // No cachear consultas con datos sensibles o tablas que cambian frecuentemente
    !query.includes('user_sessions') &&
    !query.includes('chat_state')
  )
}

// Generar clave de caché para una consulta
function getCacheKey (query, args) {
  return `${query}:${JSON.stringify(args)}`
}

export const db = {
  sql: async (strings, ...values) => {
    const query = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? '?' : '')
    }, '')

    // Filtrar valores indefinidos
    const args = values.filter((v) => v !== undefined)

    // Verificar si la consulta puede ser cacheada
    const cacheable = isCacheableQuery(query)

    if (cacheable) {
      const cacheKey = getCacheKey(query, args)

      // Comprobar caché
      if (queryCache.has(cacheKey)) {
        const cachedResult = queryCache.get(cacheKey)

        // Verificar si la caché aún es válida
        if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
          logger.debug('Usando resultado en caché para consulta')
          return cachedResult.data
        }

        // Si la caché expiró, eliminarla
        queryCache.delete(cacheKey)
      }
    }

    return executeWithRetry(async (client) => {
      try {
        const startTime = Date.now()
        const result = await client.execute({
          sql: query,
          args,
        })
        const endTime = Date.now()

        // Registrar consultas lentas (más de 500ms)
        if (endTime - startTime > 500) {
          logger.warn(
            `Consulta lenta (${endTime - startTime}ms): ${query.substring(
              0,
              100
            )}...`
          )
        }

        // Si es cacheable, guardar en caché
        if (cacheable) {
          const cacheKey = getCacheKey(query, args)
          queryCache.set(cacheKey, {
            data: result.rows || [],
            timestamp: Date.now(),
          })
        }

        return result.rows || []
      } catch (error) {
        logger.error('Error ejecutando consulta:', error)
        throw error
      }
    })
  },

  async testConnection () {
    return executeWithRetry(async (client) => {
      try {
        const result = await client.execute({
          sql: 'SELECT 1 as test',
          args: [],
        })
        return result?.rows?.length > 0
      } catch (error) {
        logger.error('Error de conexión a base de datos:', error)
        return false
      }
    })
  },

  // Método para cerrar la conexión explícitamente si es necesario
  async close () {
    if (tursoClient) {
      try {
        await tursoClient.close()
        tursoClient = null
        // Limpiar caché de consultas
        queryCache.clear()
        logger.info('Conexión a base de datos cerrada correctamente')
      } catch (error) {
        logger.error('Error cerrando conexión a base de datos:', error)
      }
    }
  },

  // Método para limpiar la caché de consultas
  clearCache () {
    const size = queryCache.size
    queryCache.clear()
    logger.info(`Caché de consultas limpiada (${size} entradas)`)
  },
}

// Manejar el cierre de conexión al terminar el proceso
process.on('SIGINT', async () => {
  await db.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await db.close()
  process.exit(0)
})
