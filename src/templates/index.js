import { createFlow } from '@builderbot/bot'
import {
  documentConfirmationFlow,
  generalConfirmationFlow,
  imageConfirmationFlow,
} from './confirmationFlows.js'
import { confirmationFlow, dateFlow } from './dateFlow.js'
import { eventCreationFlow } from './eventCreationFlow.js'
import { formFlow } from './formFlow.js'
import { voiceFlow } from './voiceFlow.js'
import { welcomeFlow } from './welcomeFlow.js'

export default createFlow([
  welcomeFlow,
  voiceFlow,
  formFlow,
  confirmationFlow,
  dateFlow,
  eventCreationFlow,
  imageConfirmationFlow,
  documentConfirmationFlow,
  generalConfirmationFlow,
])

export {
  confirmationFlow,
  dateFlow,
  documentConfirmationFlow,
  formFlow,
  generalConfirmationFlow,
  imageConfirmationFlow,
  voiceFlow,
  welcomeFlow,
}
