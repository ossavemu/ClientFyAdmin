import { addKeyword, EVENTS } from '@builderbot/bot'
import { readFileSync } from 'fs'
import { simpleChat } from '../services/ai/simplegpt.js'
import {
  getNextAvailableSlot,
  isDateAvailable,
  listAvailableSlots,
} from '../services/features/calendar.js'
import { typing } from '../services/setup/typing.js'
import { iso2text } from '../utils/iso2text.js'
import { processVoiceOrText } from '../utils/processVoiceOrText.js'
import { text2iso } from '../utils/text2iso.js'
import { formFlow } from './formFlow.js'

const promptBase = readFileSync('./calendar-prompt.txt', 'utf8')

const getNext5AvailableSlots = async (botNumber) => {
  try {
    const currentDate = new Date()
    // Añadir una hora a la fecha actual
    currentDate.setHours(currentDate.getHours() + 1)
    currentDate.setMinutes(0, 0, 0) // Resetear minutos y segundos

    const endDate = new Date(currentDate)
    endDate.setDate(endDate.getDate() + 30) // Buscar en los próximos 30 días

    const slots = await listAvailableSlots(botNumber, currentDate, endDate)

    // Filtrar slots que:
    // 1. Sean futuros (más de una hora desde ahora)
    // 2. Estén realmente disponibles
    const validSlots = []

    for (const slot of slots) {
      if (validSlots.length >= 5) break

      const slotDate = new Date(slot.start)

      // Verificar que el slot sea futuro
      if (slotDate <= currentDate) continue

      // Verificar disponibilidad real
      const isSlotAvailable = await isDateAvailable(slotDate, botNumber)

      if (isSlotAvailable) {
        validSlots.push(slot)
      }
    }

    if (validSlots.length === 0) {
      throw new Error('No hay slots disponibles en el futuro próximo')
    }

    return validSlots
  } catch (error) {
    console.error('Error en getNext5AvailableSlots:', error)
    throw error
  }
}

const formatAvailableSlots = async (slots) => {
  if (!slots || slots.length === 0) {
    return 'Lo siento, no hay turnos disponibles en este momento.'
  }

  let message = 'Los próximos turnos disponibles son:\n\n'
  for (let i = 0; i < slots.length; i++) {
    const date = new Date(slots[i].start)

    // Convertir hora militar a formato 12 horas
    let hours = date.getHours()
    const ampm = hours >= 12 ? 'de la tarde' : 'de la mañana'
    hours = hours % 12
    hours = hours || 12 // la hora '0' debe ser '12'

    const formattedDate = date.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Bogota',
    })

    // Combinar la fecha formateada con la hora en formato 12 horas
    message += `${i + 1}. ${formattedDate} a las ${hours} ${ampm}\n`
  }
  message +=
    '\nPor favor, indica la fecha y hora que prefieres (puedes decir el número de la opción o especificar otra fecha).'
  return message
}

const getOptionFromText = (text) => {
  // Normalizar el texto: quitar acentos, convertir a minúsculas
  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Mapeo de palabras a números
  const numberWords = {
    primer: 1,
    primero: 1,
    primera: 1,
    uno: 1,
    segund: 2,
    segundo: 2,
    segunda: 2,
    dos: 2,
    tercer: 3,
    tercero: 3,
    tercera: 3,
    tres: 3,
    cuart: 4,
    cuarto: 4,
    cuarta: 4,
    cuatro: 4,
    quint: 5,
    quinto: 5,
    quinta: 5,
    cinco: 5,
  }

  // Buscar coincidencias en el texto
  for (const [word, number] of Object.entries(numberWords)) {
    if (
      normalizedText.includes(word) ||
      normalizedText.includes(`opcion ${number}`)
    ) {
      return number
    }
  }

  // Si no se encuentra coincidencia, intentar extraer un número directo
  const numericMatch = normalizedText.match(/\d+/)
  if (numericMatch) {
    const number = parseInt(numericMatch[0])
    if (number >= 1 && number <= 5) {
      return number
    }
  }

  return null
}

export const confirmationFlow = addKeyword(EVENTS.ACTION).addAnswer(
  'Confirmas la fecha propuesta? Responde unicamente con un "si o no"',
  { capture: true },
  async (ctx, ctxFn) => {
    try {
      // Palabras clave para respuestas afirmativas
      const affirmativeKeywords = [
        'si',
        'sí',
        'yes',
        'claro',
        'dale',
        'por supuesto',
        'puedo',
        'confirmo',
        'ok',
        'okay',
        'vale',
      ]

      // Palabras clave para respuestas negativas
      const negativeKeywords = [
        'no',
        'nop',
        'nope',
        'nel',
        'ne',
        'negativo',
        'imposible',
        'cancelo',
      ]

      const messageText = await processVoiceOrText(ctxFn.provider, ctx)
      console.log('Mensaje recibido en confirmación:', messageText)

      const normalizedText = String(messageText)
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      console.log('Texto normalizado:', normalizedText)

      // Verificar respuesta afirmativa
      const isAffirmativeAnswer = affirmativeKeywords.some(
        (keyword) =>
          normalizedText.includes(keyword) &&
          !normalizedText.startsWith('no ') &&
          !normalizedText.includes('no puedo')
      )

      // Verificar respuesta negativa
      const isNegativeAnswer = negativeKeywords.some((keyword) =>
        normalizedText.includes(keyword)
      )

      console.log('¿Es respuesta afirmativa?:', isAffirmativeAnswer)
      console.log('¿Es respuesta negativa?:', isNegativeAnswer)

      // Si la respuesta no es clara, volver a preguntar
      if (!isAffirmativeAnswer && !isNegativeAnswer) {
        await typing(1, { ctx, ctxFn })
        await ctxFn.flowDynamic(
          'No entendí tu respuesta. Por favor, responde solo con "si" o "no"'
        )
        return ctxFn.fallBack()
      }

      if (isAffirmativeAnswer) {
        await typing(1, { ctx, ctxFn })
        return ctxFn.gotoFlow(formFlow)
      } else {
        await typing(1, { ctx, ctxFn })
        return ctxFn.endFlow(
          'Reserva cancelada. Vuelve a solicitar de nuevo una reserva'
        )
      }
    } catch (error) {
      console.error('Error en confirmationFlow:', error)
      return ctxFn.endFlow(
        'Hubo un error procesando tu respuesta. Por favor, intenta nuevamente.'
      )
    }
  }
)

export const dateFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    'Perfecto, ¿cuál es la fecha en la que quieres reservar?',
    null,
    async (ctx, ctxFn) => {
      try {
        const botNumber = process.env.P_NUMBER
        const availableSlots = await getNext5AvailableSlots(botNumber)
        const formattedMessage = await formatAvailableSlots(availableSlots)
        await ctxFn.flowDynamic(formattedMessage)
      } catch (error) {
        console.error('Error al obtener slots disponibles:', error)
        await ctxFn.flowDynamic(
          'Lo siento, hubo un error al obtener los turnos disponibles. ' +
            'Por favor, especifica directamente la fecha y hora que prefieres.'
        )
      }
    }
  )
  .addAnswer(
    'Revisando disponibilidad...',
    { capture: true },
    async (ctx, ctxFn) => {
      const botNumber = process.env.P_NUMBER
      const currentState = ctxFn.state.getMyState() || {}
      const partialDateInfo = currentState.partialDateInfo
      const currentDate = new Date()
      currentDate.setHours(currentDate.getHours() + 1)
      currentDate.setMinutes(0, 0, 0)

      // Use ctx directly as processVoiceOrText expects the full context object
      const messageText = await processVoiceOrText(ctxFn.provider, ctx)
      console.log('Mensaje procesado:', messageText) // Log after processing
      console.log('Estado actual:', currentState)

      // Ensure messageText is a string before normalization
      const normalizedText = String(messageText || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '') // Correct diacritic regex
        .trim()

      // Check for "salir" command first
      if (normalizedText === 'salir') {
        await typing(1, { ctx, ctxFn })
        await ctxFn.state.update({ partialDateInfo: null }) // Clear state on exit
        return ctxFn.endFlow(
          'Entendido. Si deseas intentar agendar de nuevo, solo tienes que pedirlo. ¿Hay algo más en lo que pueda ayudarte?'
        )
      }

      // Handle case where processVoiceOrText failed and returned empty string
      if (!messageText) {
        await typing(1, { ctx, ctxFn })
        await ctxFn.flowDynamic(
          "Hubo un problema procesando tu mensaje. Por favor, intenta de nuevo o escribe 'salir' para terminar."
        )
        return ctxFn.fallBack() // Stay in the same step
      }

      let solicitedDate
      let selectedSlot

      // --- Inicio: Lógica mejorada para fecha/hora ---

      // 1. Intentar obtener opción numérica
      const selectedOption = getOptionFromText(messageText) // Use original messageText here
      console.log('Opción detectada:', selectedOption)

      if (selectedOption !== null) {
        try {
          const availableSlots = await getNext5AvailableSlots(botNumber)
          selectedSlot = availableSlots[selectedOption - 1]
          if (selectedSlot) {
            solicitedDate = selectedSlot.start
            console.log('Fecha seleccionada por opción:', solicitedDate)
            await ctxFn.state.update({ partialDateInfo: null }) // Clear partial info if option is chosen
          } else {
            await typing(1, { ctx, ctxFn })
            await ctxFn.flowDynamic(
              'La opción seleccionada no es válida. Por favor, elige un número de la lista o especifica una fecha y hora.'
            )
            return ctxFn.fallBack()
          }
        } catch (error) {
          console.error('Error al obtener slot por opción:', error)
          await typing(1, { ctx, ctxFn })
          await ctxFn.flowDynamic(
            'Hubo un problema al procesar la opción seleccionada. Intenta especificar la fecha y hora directamente.'
          )
          return ctxFn.fallBack()
        }
      }

      // 2. Si no es opción, intentar parsear fecha/hora completa del mensaje actual
      if (!solicitedDate) {
        const parsedFullDate = await text2iso(messageText)
        if (parsedFullDate && parsedFullDate !== 'false') {
          solicitedDate = parsedFullDate
          console.log(
            'Fecha completa parseada del mensaje actual:',
            solicitedDate
          )
          await ctxFn.state.update({ partialDateInfo: null }) // Clear partial info
        }
      }

      // 3. Si no hay fecha completa aún y hay información parcial guardada (fecha)
      //    e intentar parsear solo la hora del mensaje actual
      if (!solicitedDate && partialDateInfo && partialDateInfo.date) {
        // Intenta combinar la fecha guardada con la hora del mensaje actual
        // NOTA: text2iso podría necesitar ser más inteligente o necesitar una función helper
        // para combinar una fecha base con una hora relativa.
        // Por ahora, intentaremos pasar la fecha base como contexto a text2iso.
        console.log(
          `Intentando combinar fecha guardada ${partialDateInfo.date} con hora ${messageText}`
        )
        const combinedDate = await text2iso(
          `${partialDateInfo.date} ${messageText}`
        ) // Intento simple de combinar

        if (combinedDate && combinedDate !== 'false') {
          solicitedDate = combinedDate
          console.log(
            'Fecha combinada (estado + mensaje actual):',
            solicitedDate
          )
          await ctxFn.state.update({ partialDateInfo: null }) // Clear partial info
        } else {
          console.log('No se pudo combinar fecha guardada con hora actual.')
          // Podríamos añadir lógica para detectar explícitamente si el mensaje SÓLO contiene una hora
          // usando regex, pero por simplicidad, si la combinación falla, pedimos de nuevo.
        }
      }

      // 4. Si aún no hay fecha completa, intentar parsear solo la fecha del mensaje actual
      if (!solicitedDate) {
        // Necesitamos una forma de saber si text2iso puede detectar *solo* una fecha.
        // Asumamos que si text2iso(messageText + " 12:00") funciona pero text2iso(messageText) no,
        // es probablemente solo una fecha. Esto es una heurística y puede fallar.
        // Una mejor solución sería una función parseDatePart(text).
        const potentialDate = await text2iso(`${messageText} 12:00`) // Heurística: Añadir hora neutra
        if (potentialDate && potentialDate !== 'false') {
          // Verificamos que no sea igual al intento original por si acaso
          const originalAttempt = await text2iso(messageText)
          if (!originalAttempt || originalAttempt === 'false') {
            console.log(
              `Mensaje parece ser solo una fecha: ${messageText}. Guardando en estado.`
            )
            // Extraer solo la parte YYYY-MM-DD
            const datePart = potentialDate.split('T')[0]
            await ctxFn.state.update({ partialDateInfo: { date: datePart } })
            await typing(1, { ctx, ctxFn })
            await ctxFn.flowDynamic(
              'Entendido, ¿a qué hora quieres la reserva?'
            )
            return ctxFn.fallBack() // Esperar la hora
          }
        }
      }

      // 5. Si después de todo esto, no tenemos fecha completa, fallamos.
      if (!solicitedDate || solicitedDate === 'false') {
        await typing(1, { ctx, ctxFn })
        // Si había info parcial, indicamos que falta la otra parte.
        if (partialDateInfo && partialDateInfo.date) {
          await ctxFn.flowDynamic(
            'No entendí la hora. Por favor, indica la hora para el día ' +
              partialDateInfo.date +
              ' o escribe "salir".'
          )
        } else {
          await ctxFn.flowDynamic(
            "No pude entender la fecha solicitada. Por favor, intenta de nuevo especificando día y hora (ej. 'mañana a las 3pm') o elige una opción de la lista, o escribe 'salir'."
          )
        }
        return ctxFn.fallBack() // Pedir de nuevo
      }

      // --- Fin: Lógica mejorada ---

      console.log('Fecha solicitada final para verificar:', solicitedDate)

      const dateAvailable = await isDateAvailable(solicitedDate, botNumber)

      console.log('Fecha disponible:', dateAvailable)

      // Rest of the logic for handling available/unavailable dates...
      if (dateAvailable === false) {
        const nextDateAvailable = await getNextAvailableSlot(
          solicitedDate,
          botNumber
        )

        if (!nextDateAvailable) {
          await ctxFn.state.update({ partialDateInfo: null }) // Clear state
          return ctxFn.endFlow(
            'No hay fechas disponibles próximas. Por favor, intenta con otra fecha.'
          )
        }

        console.log('Siguiente disponible:', nextDateAvailable)

        const isoString = nextDateAvailable.start.toISOString()
        const dateString = await iso2text(isoString)

        const messages = [{ role: 'user', content: messageText }]
        const response = await simpleChat(
          promptBase +
            '\\nHoy es el día:\\n' + // Escaped newline
            currentDate +
            '\\nLa fecha solicitada es:\\n' + // Escaped newline
            solicitedDate +
            '\\nLa disponibilidad de esa fecha es: false. El proximo espacio disponible que tienes que ofrecer es ' + // Escaped newline
            dateString +
            ' Da la fecha siempre en Español',
          messages
        )
        await ctxFn.flowDynamic(response)
        await ctxFn.state.update({
          date: nextDateAvailable.start,
          partialDateInfo: null,
        })
        await typing(1, { ctx, ctxFn })
        return ctxFn.gotoFlow(confirmationFlow)
      } else {
        // Fecha SÍ disponible: Construir mensaje de confirmación directamente
        await ctxFn.state.update({ date: solicitedDate, partialDateInfo: null }) // Guardar fecha final y limpiar parcial

        const dateToConfirm = new Date(solicitedDate)

        // Obtener la hora en la zona horaria de Bogotá para el cálculo de am/pm
        const bogotaHourOptions = {
          hour: 'numeric',
          timeZone: 'America/Bogota',
          hour12: false,
        }
        const hoursInBogota = parseInt(
          new Intl.DateTimeFormat('es-ES', bogotaHourOptions).format(
            dateToConfirm
          )
        )

        const ampm = hoursInBogota >= 12 ? 'de la tarde' : 'de la mañana'
        let displayHours = hoursInBogota % 12
        displayHours = displayHours || 12 // la hora '0' o '12' debe ser '12'

        // Formatear la parte de la fecha (día, DD de mes de AAAA)
        const datePartOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'America/Bogota', // Asegurar consistencia de zona horaria
        }
        const datePart = dateToConfirm.toLocaleString('es-ES', datePartOptions)

        const formattedDateString = `${datePart} a las ${displayHours} ${ampm}`

        const confirmationMsg = `La fecha solicitada está disponible. El turno sería el ${formattedDateString}.`

        await ctxFn.flowDynamic(confirmationMsg) // Enviar mensaje directo
        await typing(1, { ctx, ctxFn })
        return ctxFn.gotoFlow(confirmationFlow) // Ir a la confirmación si/no
      }
    }
  )
