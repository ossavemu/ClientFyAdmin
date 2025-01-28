import fetch from "node-fetch";

export async function getCalendarCredentials() {
  try {
    const response = await fetch(process.env.CALENDAR_CREDENTIALS_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();

    // Verificar que la respuesta tenga el formato esperado
    if (!data.success || !data.data) {
      throw new Error("Formato de respuesta inválido");
    }

    // Retornar solo los datos de las credenciales
    return data.data;
  } catch (error) {
    console.error("Error al obtener credenciales:", error);
    throw new Error("No se pudieron obtener las credenciales");
  }
}
