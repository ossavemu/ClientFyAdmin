import fs from "fs";
import fetch from "node-fetch";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const imageService = {
  async getImages(phoneNumber) {
    try {
      console.log("🔍 Obteniendo imágenes para P_NUMBER:", config.P_NUMBER);
      const response = await fetch(
        `${config.images_api_url}?phoneNumber=${config.P_NUMBER}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener imágenes: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("📄 Respuesta del servidor:", JSON.stringify(data, null, 2));

      if (!data.success || !Array.isArray(data.images)) {
        console.log("⚠️ No se encontraron imágenes");
        return [];
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
            console.error(`Error procesando imagen ${image.name}:`, error);
            return null;
          }
        })
      );

      // Filtrar las imágenes que se descargaron correctamente
      const validImages = processedImages.filter((img) => img !== null);

      console.log("✅ Imágenes procesadas:", validImages.length);
      return validImages;
    } catch (error) {
      console.error("❌ Error en imageService:", error);
      return [];
    }
  },

  async downloadImage(url, filename) {
    try {
      console.log("📥 Descargando imagen:", filename);
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
      console.log("✅ Imagen guardada en:", tempPath);

      return tempPath;
    } catch (error) {
      console.error("❌ Error descargando imagen:", error);
      throw error;
    }
  },

  async uploadImages(phoneNumber, files, names = []) {
    try {
      console.log("📤 Iniciando subida de imágenes...");
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
      console.log("📄 Respuesta de subida:", data);

      if (!data.success) {
        console.log("❌ Error en la subida:", data.error);
        return { success: false, error: data.error };
      }

      console.log("✅ Imágenes subidas exitosamente");
      return { success: true, urls: data.urls };
    } catch (error) {
      console.error("❌ Error subiendo imágenes:", error);
      return { success: false, error: error.message };
    }
  },
};
