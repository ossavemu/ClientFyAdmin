import fs from "fs";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../../config/index.js";

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
    console.log("Caché de archivos de entrenamiento limpiada");
  },

  // Forzar actualización de la caché
  async refreshCache(phoneNumber) {
    this.clearCache();
    return this.getTrainingFiles(phoneNumber, true);
  },

  async getTrainingFiles(phoneNumber, forceRefresh = false) {
    try {
      console.log("🔍 Obteniendo archivos para P_NUMBER:", config.P_NUMBER);

      // Verificar si la caché aún es válida y si hay datos en caché
      const now = Date.now();
      if (
        !forceRefresh &&
        trainingFilesCache.has(phoneNumber) &&
        now - lastCacheUpdate < CACHE_TTL
      ) {
        console.log("Usando archivos en caché para:", phoneNumber);
        return trainingFilesCache.get(phoneNumber);
      }

      console.log("Obteniendo archivos frescos desde la API...");
      const response = await fetch(
        `${config.training_files_url}?phoneNumber=${config.P_NUMBER}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener archivos: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.files)) {
        return [];
      }

      // Crear directorio temporal si no existe
      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Procesar archivos y descargarlos localmente
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
            console.error(`Error procesando archivo ${file.name}:`, error);
            return null;
          }
        })
      );

      const validFiles = processedFiles.filter((file) => file !== null);

      // Actualizar la caché
      trainingFilesCache.set(phoneNumber, validFiles);
      lastCacheUpdate = now;

      return validFiles;
    } catch (error) {
      console.error("Error en trainingService:", error);
      // Si hay un error, devolver la caché si existe
      if (trainingFilesCache.has(phoneNumber)) {
        console.log("Devolviendo caché debido a error en la API");
        return trainingFilesCache.get(phoneNumber);
      }
      return [];
    }
  },

  async uploadTrainingFiles(phoneNumber, files, names = []) {
    try {
      console.log("📤 Iniciando subida de archivos...");
      const formData = new FormData();

      formData.append("phoneNumber", config.P_NUMBER);

      files.forEach((file, index) => {
        formData.append("files", file);
        if (names[index]) {
          formData.append("names", names[index]);
        }
      });

      const response = await fetch(config.training_files_url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al subir archivos: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("📄 Respuesta de subida:", data);

      if (!data.success) {
        console.log("❌ Error en la subida:", data.error);
        return { success: false, error: data.error };
      }

      // Después de una subida exitosa, invalidar la caché
      this.clearCache();

      console.log("✅ Archivos subidos exitosamente");
      return { success: true, files: data.files };
    } catch (error) {
      console.error("❌ Error subiendo archivos:", error);
      return { success: false, error: error.message };
    }
  },

  async downloadAndProcessFile(url, filename) {
    try {
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

      return {
        path: filePath,
        mimeType: this.getMimeType(cleanName),
      };
    } catch (error) {
      console.error("Error procesando archivo:", error);
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
