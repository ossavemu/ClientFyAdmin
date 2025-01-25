import { config } from "../../config/index.js";
import { prompt as defaultPrompt } from "../../prompt.js";

export const getPrompt = async (phoneNumber) => {
  try {
    console.log("🔍 Iniciando obtención de prompt...");
    console.log("📞 Número original:", phoneNumber);

    // Limpiar el número
    const cleaned = phoneNumber.toString().replace(/\D/g, "");
    console.log("📱 Número limpio:", cleaned);

    // Detectar país (asumimos Colombia si empieza con 57)
    const countryCode = cleaned.startsWith("57") ? "CO" : "UNKNOWN";
    console.log("🌍 País detectado:", countryCode);

    // Obtener el número sin prefijo de país
    const numberWithoutPrefix = cleaned.startsWith("57")
      ? cleaned.substring(2)
      : cleaned;
    console.log("📱 Número sin prefijo:", numberWithoutPrefix);

    // Construir URL
    const url = `${config.prompt_api_url}/${numberWithoutPrefix}`;
    console.log("🌐 URL:", url);

    // Intentar obtener el prompt personalizado
    const response = await fetch(url);
    console.log("📥 Status de respuesta:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    console.log("Error obteniendo prompt:", error);
    console.log("Usando prompt de respaldo con instrucciones de ventas");
    return defaultPrompt;
  }
};
