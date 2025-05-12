import fetch from 'node-fetch'

export async function getCalendarCredentials () {
  try {
    const response = await fetch(process.env.CALENDAR_CREDENTIALS_URL, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_SECRET,
      },
    })

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data.data ?? data
  } catch (error) {
    console.error('Error al obtener credenciales:', error)
    throw new Error('No se pudieron obtener las credenciales')
  }
}
