import { createBot, MemoryDB as Database } from '@builderbot/bot'
import fs from 'fs'
import OpenAI from 'openai'
import { config } from './config/index.js'
import { assistantService } from './services/ai/assistantService.js'
import { cacheService } from './services/ai/cacheService.js'
import { cacheVectorStore, vectorStoreCache } from './services/ai/chatgpt.js'
import { trainingService } from './services/ai/trainingService.js'
import { databaseService } from './services/data/databaseService.js'
import { reminder } from './services/features/reminder.js'
import { botService } from './services/setup/botService.js'
import { imageService } from './services/setup/imageService.js'
import { logger } from './services/setup/logger.js'
import { providerService } from './services/setup/providerService.js'
import templates from './templates/index.js'
import { webServer } from './web/server.js'

// Inicializar OpenAI una sola vez
const openai = new OpenAI({ apiKey: config.openai_apikey })

// Función para precargar recursos de AI de manera optimizada
const preloadAIResources = async (botNumber) => {
  try {
    logger.info('🚀 [INIT] Precargando recursos de IA...')

    // Verificar si los recursos ya están en caché
    if (cacheService.assistants.has(botNumber)) {
      logger.info(`✅ [INIT] Usando recursos en caché para el bot ${botNumber}`)
      return {
        assistantId: cacheService.assistants.get(botNumber),
        trainingFiles: cacheService.training.get(botNumber) || [],
        images: cacheService.images.get(botNumber) || [],
      }
    }

    // Obtener el asistente (o crearlo si no existe)
    const assistantId = await assistantService.getOrCreateAssistant(
      botNumber,
      config.provider
    )
    cacheService.assistants.set(botNumber, assistantId)
    logger.info(`✅ [INIT] Asistente cargado con ID: ${assistantId}`)

    // Precargar archivos de entrenamiento - hacer esto de manera asíncrona
    logger.info(
      '🔄 [INIT] Iniciando precarga de archivos para entrenamiento...'
    )
    const trainingFilesPromise = trainingService
      .getTrainingFiles(botNumber)
      .then((files) => {
        // Usar config.P_NUMBER como clave de caché para garantizar consistencia
        logger.debug(
          `📦 [INIT] Almacenando ${files.length} archivos en caché centralizado con clave: ${config.P_NUMBER}`
        )
        cacheService.training.set(config.P_NUMBER, files)
        logger.info(
          `📚 [INIT] Archivos de entrenamiento precargados: ${files.length}`
        )
        return files
      })

    // Precargar imágenes - hacer esto de manera asíncrona
    logger.info('🔄 [INIT] Iniciando precarga de imágenes...')
    const imagesPromise = imageService.getImages(botNumber).then((images) => {
      cacheService.images.set(botNumber, images)
      logger.info(`🖼️ [INIT] Imágenes precargadas: ${images.length}`)
      return images
    })

    // Esperar a que ambas operaciones terminen
    const [trainingFiles, images] = await Promise.all([
      trainingFilesPromise,
      imagesPromise,
    ])

    // Crear el vector store con los archivos de entrenamiento si no existe en cache
    if (trainingFiles.length > 0 && !vectorStoreCache.has(botNumber)) {
      // Crear el vector store en segundo plano
      logger.info(
        '🔄 [INIT] Iniciando creación de vector store en segundo plano...'
      )
      createVectorStore(botNumber, trainingFiles, assistantId).catch((error) =>
        logger.error(
          '❌ [INIT] Error creando vector store en segundo plano:',
          error
        )
      )
    } else {
      logger.info(
        `ℹ️ [INIT] ${
          vectorStoreCache.has(botNumber)
            ? 'Vector store ya existe'
            : 'No hay archivos de entrenamiento disponibles'
        }`
      )
    }

    logger.info('✅ [INIT] Precarga de recursos completada con éxito')
    return { assistantId, trainingFiles, images }
  } catch (error) {
    logger.error('❌ [INIT] Error precargando recursos de IA:', error)
    return { assistantId: null, trainingFiles: [], images: [] }
  }
}

// Función para crear vector store en segundo plano
const createVectorStore = async (botNumber, trainingFiles, assistantId) => {
  logger.info('🧠 [VECTORSTORE] Iniciando creación de vector store...')
  try {
    // Subir archivos a OpenAI para el vector store - solo los que existen
    const validFiles = trainingFiles.filter(
      (file) => file.localPath && fs.existsSync(file.localPath)
    )
    logger.debug(
      `[VECTORSTORE] Procesando ${validFiles.length} archivos válidos de ${trainingFiles.length} disponibles`
    )

    const filePromises = validFiles.map(async (file) => {
      try {
        const uploadedFile = await openai.files.create({
          file: fs.createReadStream(file.localPath),
          purpose: 'assistants',
        })
        logger.trace(
          `[VECTORSTORE] Archivo "${file.name}" subido con ID: ${uploadedFile.id}`
        )
        return uploadedFile.id
      } catch (err) {
        logger.error(
          `[VECTORSTORE] ❌ Error subiendo archivo "${file.name}"`,
          err
        )
        return null
      }
    })

    const fileIds = (await Promise.all(filePromises)).filter(
      (id) => id !== null
    )

    if (fileIds.length > 0) {
      logger.info(
        `[VECTORSTORE] Creando vector store con ${fileIds.length} archivos...`
      )
      // Crear vector store
      const vectorStore = await openai.beta.vectorStores.create({
        name: `VectorStore-${botNumber}-${Date.now()}`,
        file_ids: fileIds,
      })

      // Actualizar el assistant con el vector store
      logger.debug(
        `[VECTORSTORE] Actualizando asistente ${assistantId} con vector store ${vectorStore.id}`
      )
      await openai.beta.assistants.update(assistantId, {
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.id],
          },
        },
      })

      // Almacenar el vector store en la caché para uso futuro
      cacheVectorStore(botNumber, vectorStore.id)
      logger.info(
        `✅ [VECTORSTORE] Vector store creado con éxito: ${vectorStore.id}`
      )
    } else {
      logger.warn(
        '⚠ [VECTORSTORE] No se pudieron procesar archivos para el vector store'
      )
    }
  } catch (error) {
    logger.error('❌ [VECTORSTORE] Error creando vector store:', error)
  }
}

const main = async () => {
  try {
    logger.info('Iniciando aplicación...')

    // Iniciar servicios en paralelo para ahorrar tiempo de inicio
    const initPromises = [
      // Verificar conexión a base de datos
      databaseService
        .testConnection()
        .then(() => logger.info('Conexión a base de datos establecida'))
        .catch((error) => {
          logger.error('Error conectando a base de datos:', error)
          throw error
        }),

      // Obtener provider y registrar bot
      (async () => {
        const { provider: adapterProvider, botNumber } =
          providerService.getProvider()
        await databaseService.registerBot(botNumber, config.provider)
        return { adapterProvider, botNumber }
      })(),
    ]

    // Esperar a que se completen las operaciones críticas
    const [, { adapterProvider, botNumber }] = await Promise.all(initPromises)

    // Precargar recursos de IA en segundo plano
    preloadAIResources(botNumber).catch((error) =>
      logger.error('Error precargando recursos de IA:', error)
    )

    // Iniciar el bot
    const adapterDB = new Database()
    const { httpServer } = await createBot({
      flow: templates,
      provider: adapterProvider,
      database: adapterDB,
    })

    // Iniciar servicios de forma asíncrona
    const startServices = async () => {
      try {
        // Iniciar servidor HTTP
        httpServer(config.PORT)
        logger.info(`Servidor iniciado en puerto ${config.PORT}`)

        // Iniciar servicio de recordatorios
        reminder(adapterProvider)
        logger.info('Servicio de recordatorios iniciado')

        // Iniciar panel web
        webServer.listen(config.WEB_PORT, () => {
          logger.info(`Panel web iniciado en puerto ${config.WEB_PORT}`)
        })

        // Iniciar verificación de estado del bot
        botService.startStatusCheck()
        logger.info('Bot y servicios iniciados correctamente')
      } catch (error) {
        logger.error('Error iniciando servicios:', error)
      }
    }

    // Iniciar servicios
    startServices()
  } catch (error) {
    logger.error('Error crítico iniciando aplicación:', error)
    process.exit(1)
  }
}

// Si estamos ejecutando en producción, manejar excepciones no capturadas
if (process.env.NODE_ENV === 'production') {
  // Manejar excepciones no capturadas para evitar caídas del servidor
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada:', error)
    // No cerramos el proceso, solo registramos el error
  })

  // Manejar rechazos de promesas no capturados
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Rechazo de promesa no manejado:', reason)
    // No cerramos el proceso, solo registramos el error
  })
}

main()
