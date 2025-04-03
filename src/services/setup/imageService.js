import fs from "fs";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../../config/index.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caché de imágenes
const imagesCache = new Map();
// TTL para la caché (en milisegundos) - 1 hora por defecto
const CACHE_TTL = 60 * 60 * 1000;
// Timestamp de la última actualización de la caché
let lastImageCacheUpdate = 0;

export const imageService = {
  // Limpiar caché de imágenes
  clearCache() {
    imagesCache.clear();
    lastImageCacheUpdate = 0;
    logger.debug("Caché de imágenes limpiada");
  },

  // Forzar actualización de la caché
  async refreshCache(phoneNumber) {
    this.clearCache();
    return this.getImages(phoneNumber, true);
  },

  async getImages(phoneNumber, forceRefresh = false) {
    try {
      logger.debug(`Obteniendo imágenes para número: ${config.P_NUMBER}`);

      // Verificar si la caché aún es válida y si hay datos en caché
      const now = Date.now();
      if (
        !forceRefresh &&
        imagesCache.has(phoneNumber) &&
        now - lastImageCacheUpdate < CACHE_TTL
      ) {
        logger.debug(`Usando imágenes en caché para: ${phoneNumber}`);
        return imagesCache.get(phoneNumber);
      }

      logger.info("Obteniendo imágenes desde la API...");
      const response = await fetch(
        `${config.images_api_url}?phoneNumber=${config.P_NUMBER}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener imágenes: ${response.statusText}`);
      }

      const data = await response.json();
      logger.trace("Respuesta del servidor: " + JSON.stringify(data, null, 2));

      if (!data.success || !Array.isArray(data.images)) {
        logger.warn("No se encontraron imágenes");
        return [];
      }

      // Crear directorio temporal si no existe
      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Descargar y guardar las imágenes localmente
      const processedImages = await Promise.all(
        data.images.map(async (image) => {
          try {
            const tempPath = await this.downloadImage(image.url, image.name);
            return {
              ...image,
              localPath: tempPath,
            };
          } catch (error) {
            logger.error(`Error procesando imagen ${image.name}`, error);
            return null;
          }
        })
      );

      // Filtrar las imágenes que se descargaron correctamente
      const validImages = processedImages.filter((img) => img !== null);

      // Actualizar la caché
      imagesCache.set(phoneNumber, validImages);
      lastImageCacheUpdate = now;

      logger.info(`Imágenes procesadas: ${validImages.length}`);
      return validImages;
    } catch (error) {
      logger.error("Error en imageService", error);
      // Si hay un error, devolver la caché si existe
      if (imagesCache.has(phoneNumber)) {
        logger.info("Devolviendo caché de imágenes debido a error en la API");
        return imagesCache.get(phoneNumber);
      }
      return [];
    }
  },

  async downloadImage(url, filename) {
    try {
      logger.debug(`Descargando imagen: ${filename}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error descargando imagen: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const tempDir = path.join(__dirname, "../../temp");

      // Crear directorio temporal si no existe
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Limpiar el nombre del archivo y asegurar la extensión
      const cleanName = filename.replace(/[^a-zA-Z0-9]/g, "_");
      const tempPath = path.join(tempDir, `${cleanName}.jpeg`);

      fs.writeFileSync(tempPath, Buffer.from(buffer));
      logger.trace(`Imagen guardada en: ${tempPath}`);

      return tempPath;
    } catch (error) {
      logger.error("Error descargando imagen", error);
      throw error;
    }
  },

  async uploadImages(phoneNumber, files, names = []) {
    try {
      logger.info("Iniciando subida de imágenes...");
      const formData = new FormData();

      formData.append("phoneNumber", config.P_NUMBER);

      files.forEach((file, index) => {
        formData.append("files", file);
        if (names[index]) {
          formData.append("names", names[index]);
        }
      });

      const response = await fetch(config.images_api_url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al subir imágenes: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug("Respuesta de subida: " + JSON.stringify(data));

      if (!data.success) {
        logger.warn(`Error en la subida: ${data.error}`);
        return { success: false, error: data.error };
      }

      // Después de una subida exitosa, invalidar la caché
      this.clearCache();

      logger.info("Imágenes subidas exitosamente");
      return { success: true, urls: data.urls };
    } catch (error) {
      logger.error("Error subiendo imágenes", error);
      return { success: false, error: error.message };
    }
  },
};
