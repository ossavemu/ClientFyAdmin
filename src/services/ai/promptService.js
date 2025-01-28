import { config } from "../../config/index.js";
import { prompt as defaultPrompt } from "../../prompt.js";

export const getPrompt = async (phoneNumber) => {
  try {
    console.log("🔍 Iniciando obtención de prompt...");
    console.log("📞 Número original:", phoneNumber);

    // Limpiar el número y mantener el prefijo del país
    const cleaned = phoneNumber.toString().replace(/\D/g, "");
    console.log("📱 Número limpio:", cleaned);

    // Construir URL con el número completo incluyendo prefijo
    const url = `${config.prompt_api_url}?phoneNumber=${cleaned}`;
    console.log("🌐 URL:", url);

    // Intentar obtener el prompt personalizado
    const response = await fetch(url);
    console.log("📥 Status de respuesta:", response.status);

    // Loguear la respuesta completa para debug
    const data = await response.json();
    console.log("📄 Respuesta completa:", data);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          "No se encontró prompt personalizado, usando prompt por defecto"
        );
        console.log("Prompt por defecto:", defaultPrompt);
        return defaultPrompt;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!data.success || !data.prompt) {
      console.log(
        "Respuesta no válida del servidor, usando prompt por defecto"
      );
      console.log("Datos recibidos:", data);
      return defaultPrompt;
    }

    console.log("✅ Prompt personalizado encontrado:", data.prompt);
    return data.prompt;
  } catch (error) {
    console.log("❌ Error obteniendo prompt:", error);
    console.log("Usando prompt de respaldo con instrucciones de ventas");
    return defaultPrompt;
  }
};

export const savePrompt = async (phoneNumber, promptText) => {
  try {
    console.log("💾 Iniciando guardado de prompt...");

    // Limpiar el número
    const cleaned = phoneNumber.toString().replace(/\D/g, "");

    const response = await fetch(config.prompt_api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: cleaned,
        prompt: promptText,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.log("Error guardando prompt:", error);
    throw error;
  }
};
