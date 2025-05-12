import { config } from '../../config/index.js'
import { prompt as defaultPrompt } from '../../prompt.js'
import { logger } from '../setup/logger.js'

export const getPrompt = async (phoneNumber) => {
  try {
    logger.debug('Iniciando obtención de prompt...')
    logger.trace(`Número original: ${phoneNumber}`)

    // Limpiar el número y mantener el prefijo del país
    const cleaned = phoneNumber.toString().replace(/\D/g, '')
    logger.trace(`Número limpio: ${cleaned}`)

    // Construir URL con el número completo incluyendo prefijo
    const url = `${config.prompt_api_url}?phoneNumber=${cleaned}`
    logger.trace(`URL: ${url}`)

    // Intentar obtener el prompt personalizado
    const response = await fetch(url)
    logger.debug(`Status de respuesta: ${response.status}`)

    // Loguear la respuesta completa para debug (sin el contenido del prompt)
    const data = await response.json()
    const dataWithoutPrompt = { ...data }
    if (dataWithoutPrompt.prompt) {
      dataWithoutPrompt.prompt = '[CONTENIDO OMITIDO]'
    }
    logger.trace('Respuesta: ' + JSON.stringify(dataWithoutPrompt))

    if (!response.ok) {
      if (response.status === 404) {
        logger.info(
          'No se encontró prompt personalizado, usando prompt por defecto'
        )
        return defaultPrompt
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    if (!data.success || !data.prompt) {
      logger.warn(
        'Respuesta no válida del servidor, usando prompt por defecto'
      )
      logger.trace(
        'Datos recibidos (sin prompt): ' + JSON.stringify(dataWithoutPrompt)
      )
      return defaultPrompt
    }

    logger.info('Prompt personalizado encontrado y aplicado')
    return data.prompt
  } catch (error) {
    logger.error('Error obteniendo prompt', error)
    logger.info('Usando prompt de respaldo con instrucciones de ventas')
    return defaultPrompt
  }
}

export const savePrompt = async (phoneNumber, promptText) => {
  try {
    logger.debug('Iniciando guardado de prompt...')

    // Limpiar el número
    const cleaned = phoneNumber.toString().replace(/\D/g, '')

    const response = await fetch(config.prompt_api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: cleaned,
        prompt: promptText,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    logger.info('Prompt guardado exitosamente')
    return data.success
  } catch (error) {
    logger.error('Error guardando prompt', error)
    throw error
  }
}
