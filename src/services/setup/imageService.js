import fetch from "node-fetch";
import { config } from "../../config/index.js";

export const imageService = {
  async getImages(phoneNumber) {
    try {
      // Usar el número de prueba configurado
      const numberToUse = config.test_phone_number;

      const response = await fetch(
        `${config.images_api_url}?phoneNumber=${numberToUse}`
      );

      if (!response.ok) {
        throw new Error(`Error al obtener imágenes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.images;
    } catch (error) {
      console.error("Error en imageService:", error);
      throw error;
    }
  },
};
