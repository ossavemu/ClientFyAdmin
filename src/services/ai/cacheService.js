import { logger } from "../setup/logger.js";

// Caches centralizados compartidos entre módulos
const globalCache = {
  // Asistentes
  assistantIds: new Map(),
  // Archivos de entrenamiento
  trainingFiles: new Map(),
  // Imágenes
  images: new Map(),
  // Vector stores
  vectorStores: new Map(),
  // Threads de conversación
  threads: new Map(),
};

// Servicio centralizado de caché
export const cacheService = {
  // Métodos para archivos de entrenamiento
  training: {
    get(botNumber) {
      if (globalCache.trainingFiles.has(botNumber)) {
        const files = globalCache.trainingFiles.get(botNumber);
        logger.debug(
          `[CACHE] ⚡ Recuperados ${files.length} archivos de entrenamiento de caché global`
        );
        return files;
      }
      return null;
    },

    set(botNumber, files) {
      globalCache.trainingFiles.set(botNumber, files);
      logger.debug(
        `[CACHE] 💾 Almacenados ${files.length} archivos de entrenamiento en caché global`
      );
      return files;
    },

    has(botNumber) {
      return globalCache.trainingFiles.has(botNumber);
    },

    clear(botNumber) {
      if (botNumber) {
        globalCache.trainingFiles.delete(botNumber);
        logger.debug(
          `[CACHE] 🧹 Caché de archivos limpiada para bot ${botNumber}`
        );
      } else {
        globalCache.trainingFiles.clear();
        logger.debug(`[CACHE] 🧹 Caché de archivos limpiada completamente`);
      }
    },
  },

  // Métodos para asistentes
  assistants: {
    get(botNumber) {
      return globalCache.assistantIds.get(botNumber);
    },

    set(botNumber, assistantId) {
      globalCache.assistantIds.set(botNumber, assistantId);
      logger.debug(
        `[CACHE] 💾 Asistente ${assistantId} almacenado en caché para bot ${botNumber}`
      );
      return assistantId;
    },

    has(botNumber) {
      return globalCache.assistantIds.has(botNumber);
    },
  },

  // Métodos para imágenes
  images: {
    get(botNumber) {
      return globalCache.images.get(botNumber);
    },

    set(botNumber, images) {
      globalCache.images.set(botNumber, images);
      logger.debug(
        `[CACHE] 💾 ${images.length} imágenes almacenadas en caché para bot ${botNumber}`
      );
      return images;
    },

    has(botNumber) {
      return globalCache.images.has(botNumber);
    },
  },

  // Métodos para vector stores
  vectorStores: {
    get(botNumber) {
      return globalCache.vectorStores.get(botNumber);
    },

    set(botNumber, vectorStoreId) {
      globalCache.vectorStores.set(botNumber, vectorStoreId);
      logger.debug(
        `[CACHE] 💾 Vector store ${vectorStoreId} almacenado en caché para bot ${botNumber}`
      );
      return vectorStoreId;
    },

    has(botNumber) {
      return globalCache.vectorStores.has(botNumber);
    },
  },

  // Métodos para threads
  threads: {
    get(key) {
      return globalCache.threads.get(key);
    },

    set(key, thread) {
      globalCache.threads.set(key, thread);
      logger.debug(
        `[CACHE] 💾 Thread ${thread.id} almacenado en caché con clave ${key}`
      );
      return thread;
    },

    has(key) {
      return globalCache.threads.has(key);
    },
  },
};

// Exportar directamente para casos de uso avanzados
export const rawCache = globalCache;
