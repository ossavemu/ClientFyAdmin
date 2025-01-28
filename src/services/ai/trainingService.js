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
  "información",
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
  "info",
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
      console.log("📄 Respuesta del servidor:", JSON.stringify(data, null, 2));

      if (!data.success) {
        console.log("❌ Error en la respuesta del servidor:", data.error);
        return [];
      }

      // Descargar y guardar los archivos localmente
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

      // Filtrar los archivos que se descargaron correctamente
      const validFiles = processedFiles.filter((file) => file !== null);

      console.log("✅ Archivos procesados:", validFiles.length);
      return validFiles;
    } catch (error) {
      console.error("❌ Error en trainingService:", error);
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
      console.log("📥 Descargando archivo:", filename);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error descargando archivo: ${response.statusText}`);
      }

      // Extraer la extensión de la URL
      const urlPath = new URL(url).pathname;
      const extension = path.extname(urlPath); // Esto obtendrá .pdf de la URL

      const buffer = await response.arrayBuffer();
      const tempDir = path.join(__dirname, "../../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Agregar la extensión al nombre del archivo si no la tiene
      const filenameWithExt = filename.includes(".")
        ? filename
        : `${filename}${extension}`;

      const tempPath = path.join(tempDir, filenameWithExt);

      fs.writeFileSync(tempPath, Buffer.from(buffer));
      console.log("✅ Archivo guardado en:", tempPath);

      return {
        path: tempPath,
        mimeType: this.getMimeType(filenameWithExt),
      };
    } catch (error) {
      console.error("❌ Error procesando archivo:", error);
      throw error;
    }
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
