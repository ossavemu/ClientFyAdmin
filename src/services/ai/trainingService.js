import fs from "fs";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../../config/index.js";
import { logger } from "../setup/logger.js";
import { cacheService } from "./cacheService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mapa de extensiones a tipos MIME
const MIME_TYPES = {
  // Documentos
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
};

// Caché de archivos de entrenamiento
const trainingFilesCache = new Map();
// TTL para la caché (en milisegundos) - 1 hora por defecto
const CACHE_TTL = 60 * 60 * 1000;
// Timestamp de la última actualización de la caché
let lastCacheUpdate = 0;

// Palabras clave para detectar solicitudes de documentos
export const TRAINING_KEYWORDS = [
  "documentos",
  "archivos",
  "material",
  "manual",
  "manuales",
  "instructivo",
  "instructivos",
  "guía",
  "guias",
  "menu",
  "menú",
  "carta",
  "precios",
  "precio",
  "catalogo",
  "catálogo",
  "pdf",
  "documento",
  "archivo",
  "materiales",
  "presentación",
  "presentacion",
];

export const trainingService = {
  // Limpiar caché de archivos
  clearCache() {
    trainingFilesCache.clear();
    lastCacheUpdate = 0;
    // También limpiar el caché centralizado
    cacheService.training.clear();
    logger.debug("[TRAINING] 🧹 Caché de archivos de entrenamiento limpiada");
  },

  // Forzar actualización de la caché
  async refreshCache(phoneNumber) {
    logger.info(
      `[TRAINING] 🔄 Forzando actualización de caché para ${phoneNumber}`
    );
    this.clearCache();
    return this.getTrainingFiles(phoneNumber, true);
  },

  async getTrainingFiles(phoneNumber, forceRefresh = false) {
    try {
      // Usar config.P_NUMBER como clave de caché estándar para garantizar coherencia
      const cacheKey = config.P_NUMBER;

      logger.debug(
        `[TRAINING] Solicitud de archivos para ${phoneNumber} (clave caché: ${cacheKey})${
          forceRefresh ? " [forzando actualización]" : ""
        }`
      );

      // Verificar primero si los archivos están en el caché centralizado
      if (!forceRefresh && cacheService.training.has(cacheKey)) {
        const centralCachedFiles = cacheService.training.get(cacheKey);
        logger.info(
          `[TRAINING] ⚡ USANDO CACHÉ CENTRALIZADO: ${centralCachedFiles.length} archivos (desde getTrainingFiles)`
        );
        return centralCachedFiles;
      }

      // Si no están en el caché centralizado, verificar el caché local
      const now = Date.now();
      if (
        !forceRefresh &&
        trainingFilesCache.has(cacheKey) &&
        now - lastCacheUpdate < CACHE_TTL
      ) {
        const cachedFiles = trainingFilesCache.get(cacheKey);
        const cacheAge = Math.round((now - lastCacheUpdate) / 1000);
        logger.info(
          `[TRAINING] ⚡ USANDO CACHÉ LOCAL: ${cachedFiles.length} archivos (edad: ${cacheAge}s)`
        );

        // Actualizar también el caché centralizado
        cacheService.training.set(cacheKey, cachedFiles);
        logger.debug(
          `[TRAINING] Caché centralizado actualizado desde caché local`
        );

        return cachedFiles;
      }

      logger.info(
        `[TRAINING] 🔄 Obteniendo archivos desde la API externa (${config.training_files_url.substring(
          0,
          30
        )}...)`
      );
      const response = await fetch(
        `${config.training_files_url}?phoneNumber=${config.P_NUMBER}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener archivos: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.files)) {
        logger.warn(`[TRAINING] ⚠ API no retornó archivos válidos`);
        return [];
      }

      logger.debug(
        `[TRAINING] API retornó ${data.files.length} archivos para procesar`
      );

      // Crear directorio temporal si no existe
      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        logger.debug(`[TRAINING] Directorio temporal creado: ${tempDir}`);
      }

      // Procesar archivos y descargarlos localmente
      logger.debug(
        `[TRAINING] Iniciando descarga de ${data.files.length} archivos...`
      );
      const processedFiles = await Promise.all(
        data.files.map(async (file) => {
          try {
            const tempPath = await this.downloadAndProcessFile(
              file.url,
              file.name
            );
            return {
              ...file,
              localPath: tempPath.path,
              mimeType: tempPath.mimeType,
            };
          } catch (error) {
            logger.error(
              `[TRAINING] ❌ Error procesando archivo ${file.name}`,
              error
            );
            return null;
          }
        })
      );

      const validFiles = processedFiles.filter((file) => file !== null);

      // Actualizar la caché
      trainingFilesCache.set(cacheKey, validFiles);
      lastCacheUpdate = now;

      // Actualizar también el caché centralizado
      cacheService.training.set(cacheKey, validFiles);
      logger.debug(
        `[TRAINING] Caché centralizado actualizado desde API con ${validFiles.length} archivos`
      );

      logger.info(
        `[TRAINING] ✅ ${
          validFiles.length
        } archivos procesados y almacenados en caché (${
          data.files.length - validFiles.length
        } fallaron)`
      );
      return validFiles;
    } catch (error) {
      logger.error("[TRAINING] ❌ Error en servicio de archivos", error);
      // Si hay un error, intentar recuperar del caché centralizado primero
      if (cacheService.training.has(cacheKey)) {
        const centralCachedFiles = cacheService.training.get(cacheKey);
        logger.info(
          `[TRAINING] ⚠ Devolviendo ${centralCachedFiles.length} archivos de caché CENTRALIZADO debido a error en la API`
        );
        return centralCachedFiles;
      }
      // Si no hay caché centralizado, intentar con el caché local
      if (trainingFilesCache.has(cacheKey)) {
        const cachedFiles = trainingFilesCache.get(cacheKey);
        logger.info(
          `[TRAINING] ⚠ Devolviendo ${cachedFiles.length} archivos de caché LOCAL debido a error en la API`
        );
        return cachedFiles;
      }
      return [];
    }
  },

  async uploadTrainingFiles(phoneNumber, files, names = []) {
    try {
      logger.info(
        `[TRAINING] 📤 Iniciando subida de ${files.length} archivos para ${phoneNumber}...`
      );
      const formData = new FormData();

      formData.append("phoneNumber", config.P_NUMBER);

      files.forEach((file, index) => {
        formData.append("files", file);
        if (names[index]) {
          formData.append("names", names[index]);
        }
      });

      logger.debug(
        `[TRAINING] Enviando petición al servidor (${config.training_files_url})...`
      );
      const response = await fetch(config.training_files_url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al subir archivos: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug(
        `[TRAINING] Respuesta del servidor recibida: ${JSON.stringify(
          data
        ).substring(0, 100)}...`
      );

      if (!data.success) {
        logger.warn(`[TRAINING] ⚠ Error en la subida: ${data.error}`);
        return { success: false, error: data.error };
      }

      // Después de una subida exitosa, invalidar la caché
      this.clearCache();
      logger.debug(
        `[TRAINING] Caché de archivos invalidada después de la subida exitosa`
      );

      logger.info(
        `[TRAINING] ✅ ${files.length} archivos subidos exitosamente`
      );
      return { success: true, files: data.files };
    } catch (error) {
      logger.error(`[TRAINING] ❌ Error subiendo archivos`, error);
      return { success: false, error: error.message };
    }
  },

  async downloadAndProcessFile(url, filename) {
    try {
      const shortUrl = url.length > 40 ? url.substring(0, 37) + "..." : url;
      logger.debug(
        `[TRAINING] 📥 Descargando archivo: "${filename}" desde ${shortUrl}`
      );
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Error descargando: ${response.statusText}`);

      // Extraer extensión del Content-Type o de la URL
      const contentType = response.headers.get("content-type");
      const urlExt = path.extname(new URL(url).pathname);
      const mimeExt = this.getExtensionFromMime(contentType);
      const extension = urlExt || mimeExt || "";

      // Limpiar nombre y asegurar extensión
      const baseName = path.basename(filename, path.extname(filename));
      const cleanName = `${baseName.replace(/[^a-zA-Z0-9]/g, "_")}${extension}`;

      const buffer = await response.arrayBuffer();
      const tempDir = path.join(__dirname, "../../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filePath = path.join(tempDir, cleanName);
      fs.writeFileSync(filePath, Buffer.from(buffer));

      logger.trace(
        `[TRAINING] 📄 Archivo "${filename}" (${buffer.byteLength} bytes) guardado como: ${cleanName}`
      );

      return {
        path: filePath,
        mimeType: this.getMimeType(cleanName),
      };
    } catch (error) {
      logger.error(
        `[TRAINING] ❌ Error procesando archivo "${filename}"`,
        error
      );
      throw error;
    }
  },

  getExtensionFromMime(mimeType) {
    const mimeMap = {
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
      "text/plain": ".txt",
      // Agregar más tipos MIME según necesidad
    };
    return mimeMap[mimeType] || "";
  },

  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase().replace(".", "");
    return MIME_TYPES[ext] || "application/octet-stream";
  },

  // Método para verificar si un texto contiene palabras clave de documentos
  containsTrainingKeywords(text) {
    const normalizedText = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return TRAINING_KEYWORDS.some((keyword) =>
      normalizedText.includes(keyword.toLowerCase())
    );
  },
};
