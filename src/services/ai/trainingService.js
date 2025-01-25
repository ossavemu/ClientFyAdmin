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

  // Imágenes
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",

  // Audio
  aac: "audio/aac",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  amr: "audio/amr",

  // Video
  mp4: "video/mp4",
  "3gp": "video/3gpp",
};

export const trainingService = {
  async getTrainingFiles(phoneNumber) {
    try {
      const numberToUse = config.test_phone_number;
      const response = await fetch(
        `${config.training_files_url}?phoneNumber=${numberToUse}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener archivos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.files;
    } catch (error) {
      console.error("Error en trainingService:", error);
      throw error;
    }
  },

  async downloadAndProcessFile(url, filename) {
    try {
      console.log("📥 Descargando archivo desde:", url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error descargando archivo: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const tempDir = path.join(__dirname, "../../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Obtener la extensión del archivo original
      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const mimeType = MIME_TYPES[ext] || "text/plain"; // Por defecto text/plain

      // Mantener la extensión original del archivo
      const tempFile = path.join(tempDir, `${filename}`);
      fs.writeFileSync(tempFile, Buffer.from(buffer));

      console.log("✅ Archivo guardado en:", tempFile);
      console.log("📎 Tipo MIME:", mimeType);

      return {
        path: tempFile,
        mimeType: mimeType,
      };
    } catch (error) {
      console.error("Error procesando archivo:", error);
      throw error;
    }
  },
};
