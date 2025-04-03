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
  async getTrainingFiles(phoneNumber) {
    try {
      console.log("🔍 Obteniendo archivos para P_NUMBER:", config.P_NUMBER);
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

      return processedFiles.filter((file) => file !== null);
    } catch (error) {
      console.error("Error en trainingService:", error);
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
