import fetch from 'node-fetch';

export async function getCalendarCredentials() {
  try {
    const response = await fetch(process.env.CALENDAR_CREDENTIALS_URL);
    if (!response.ok) {
      throw new Error('No se pudieron obtener las credenciales');
    }
    return await response.json();
  } catch (error) {
    console.error('Error al obtener credenciales:', error);
    throw error;
  }
}
