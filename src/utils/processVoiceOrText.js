/**
 * Procesa un mensaje que puede ser de texto o de voz
 * @param {Object} ctx - Objeto de contexto del mensaje
 * @returns {Promise<string>} - El texto del mensaje o la transcripción de la nota de voz
 */
import { logger } from '../services/setup/logger.js'

export const processVoiceOrText = async (provider, message) => {
  try {
    let userResponse = ''
    // Check if the message has audio or text content
    if (Object.prototype.hasOwnProperty.call(message, 'audio')) {
      if (Object.prototype.hasOwnProperty.call(message, 'caption')) {
        userResponse = message.caption // Use caption if available
      } else {
        // Si es una nota de voz, usa la transcripción del estado
        if (
          Object.prototype.hasOwnProperty.call(message, '_data') &&
          message._data && // Ensure _data exists before accessing its properties
          Object.prototype.hasOwnProperty.call(message._data, 'type') &&
          message._data.type === 'ptt'
        ) {
          const state =
            message.state && message.state.getMyState
              ? await message.state.getMyState()
              : {}
          userResponse = state?.voiceTranscript || ''
        }
      }
    } else {
      // Si es un mensaje de texto normal, devuelve el cuerpo del mensaje
      userResponse = message.body || ''
    }
    return userResponse
  } catch (error) {
    logger.error('Error processing voice or text:', error)
    return ''
  }
}
