import { addKeyword, EVENTS } from "@builderbot/bot";
import { config } from "../config/index.js";
import { chat } from "../services/ai/chatgpt.js";
import { trainingService } from "../services/ai/trainingService.js";
import { wsUserService } from "../services/data/wsUserService.js";
import { imageService } from "../services/setup/imageService.js";
import { logger } from "../services/setup/logger.js";
import { typing } from "../services/setup/typing.js";
import { notifyNewUser } from "../web/server.js";
import {
  addMutedMessage,
  isMuted,
  registerMessageHandler,
} from "../web/socket.js";
import {
  documentConfirmationFlow,
  imageConfirmationFlow,
} from "./confirmationFlows.js";
import { dateFlow } from "./dateFlow.js";

// Caché simple para deduplicación de mensajes recientes
const recentMessages = new Map();
const DEDUPLICATION_WINDOW_MS = 2000; // Ignorar mensajes idénticos dentro de 2 segundos

function deduplicateMessage(ctx) {
  const currentTime = Date.now();
  const lastMessageTime = recentMessages.get(ctx.from);
  if (
    lastMessageTime &&
    currentTime - lastMessageTime < DEDUPLICATION_WINDOW_MS
  ) {
    logger.warn(
      `[DEDUPLICATE] Mensaje duplicado ignorado de ${ctx.from} (dentro de ${DEDUPLICATION_WINDOW_MS}ms)`
    );
    return true;
  }
  recentMessages.set(ctx.from, currentTime);
  if (Math.random() < 0.1) {
    const cutoff = currentTime - DEDUPLICATION_WINDOW_MS * 10;
    for (const [key, time] of recentMessages.entries()) {
      if (time < cutoff) recentMessages.delete(key);
    }
  }
  return false;
}

async function handleSchedule(ctx, ctxFn, bodyText, isFirstMessage) {
  const keywordsSchedule = ["agendar", "cita"];
  const words = bodyText.split(/\s+/);
  const isScheduleRequest = keywordsSchedule.some((keyword) =>
    words.includes(keyword)
  );
  if (!isScheduleRequest) return false;
  const virtualEnabled = config.enableVirtualAppointments;
  const inPersonEnabled = config.enableInPersonAppointments;
  if (!virtualEnabled && !inPersonEnabled) {
    await typing(1, { ctx, ctxFn });
    return ctxFn.endFlow(
      "Lo siento, el servicio de citas no está disponible en este momento."
    );
  }
  if (virtualEnabled && !inPersonEnabled) {
    await ctxFn.state.update({ appointmentType: "virtual" });
    await typing(1, { ctx, ctxFn });
    return ctxFn.gotoFlow(dateFlow);
  }
  if (!virtualEnabled && inPersonEnabled) {
    await ctxFn.state.update({ appointmentType: "inPerson" });
    await typing(1, { ctx, ctxFn });
    return ctxFn.gotoFlow(dateFlow);
  }
  await typing(1, { ctx, ctxFn });
  await ctxFn.flowDynamic(
    "¿Qué tipo de cita prefieres?\n1. Virtual (por videollamada)\n2. Presencial"
  );
  await ctxFn.state.update({
    waitingForAppointmentType: true,
    lastMessage: bodyText,
  });
  return true;
}

async function handleAppointmentType(ctx, ctxFn, bodyText) {
  const state = await ctxFn.state.getMyState();
  if (!state?.waitingForAppointmentType) return false;
  const response = bodyText.toLowerCase();
  let appointmentType = null;
  if (
    response.includes("1") ||
    response.includes("virtual") ||
    response.includes("video")
  )
    appointmentType = "virtual";
  else if (response.includes("2") || response.includes("presencial"))
    appointmentType = "inPerson";
  if (appointmentType) {
    await ctxFn.state.update({
      appointmentType,
      waitingForAppointmentType: false,
      body: state.lastMessage,
    });
    await typing(1, { ctx, ctxFn });
    return ctxFn.gotoFlow(dateFlow);
  } else {
    await typing(1, { ctx, ctxFn });
    await ctxFn.flowDynamic(
      "Por favor, selecciona una opción válida:\n1. Virtual (por videollamada)\n2. Presencial"
    );
    return true;
  }
}

async function handleDocumentRequest(ctx, ctxFn, bodyText) {
  const isRequestingFiles = trainingService.containsTrainingKeywords(bodyText);
  if (!isRequestingFiles) return false;
  await typing(1, { ctx, ctxFn });
  return ctxFn.gotoFlow(documentConfirmationFlow);
}

async function handleImageRequest(ctx, ctxFn, bodyText) {
  const imageKeywords = [
    "imagen",
    "imágenes",
    "fotos",
    "foto",
    "galería",
    "ver imágenes",
    "ver fotos",
    "muéstrame",
    "catalogo",
    "catálogo",
  ];
  const isRequestingImages = imageKeywords.some((keyword) =>
    bodyText.includes(keyword)
  );
  if (!isRequestingImages) return false;
  await typing(1, { ctx, ctxFn });
  return ctxFn.gotoFlow(imageConfirmationFlow);
}

async function handleNormalConversation(
  ctx,
  ctxFn,
  bodyText,
  phoneNumber,
  isFirstMessage
) {
  await typing(1, { ctx, ctxFn });
  const botNumber =
    config.provider === "meta" ? config.numberId : config.P_NUMBER;
  if (!botNumber) {
    logger.error("Error: botNumber no está definido");
    return ctxFn.endFlow(
      "Lo siento, hay un problema con la configuración del bot. Por favor, contacta al administrador."
    );
  }
  await notifyNewUser(phoneNumber, ctx.name);
  let isFirstInteraction = isFirstMessage;
  try {
    const previousInteractions = await wsUserService.getInteractionHistory(
      phoneNumber
    );
    if (previousInteractions && previousInteractions.length > 1)
      isFirstInteraction = false;
  } catch (error) {
    logger.error(
      `[WELCOME] Error verificando interacciones previas: ${error.message}`
    );
  }
  const response = await chat(ctx.body, botNumber, ctx.name, null);
  await ctxFn.state.update({ thread: response.thread });
  if (isFirstInteraction) {
    const hasDocuments =
      (await trainingService.getTrainingFiles(botNumber)).length > 0;
    const hasImages = (await imageService.getImages(botNumber)).length > 0;
    let optionsMessage = "";
    const virtualEnabled = config.enableVirtualAppointments;
    const inPersonEnabled = config.enableInPersonAppointments;
    const appointmentsEnabled = virtualEnabled || inPersonEnabled;
    if (appointmentsEnabled || hasDocuments || hasImages) {
      optionsMessage += "\n\nTambién puedes:";
      if (appointmentsEnabled) {
        let citasMessage = "\n•⁠  ⁠Agendar citas";
        if (virtualEnabled && inPersonEnabled)
          citasMessage += " (virtuales o presenciales)";
        else if (virtualEnabled) citasMessage += " virtuales";
        else if (inPersonEnabled) citasMessage += " presenciales";
        citasMessage += " usando palabras como 'cita' o 'reservar'";
        optionsMessage += citasMessage;
      }
      if (hasDocuments)
        optionsMessage +=
          "\n•⁠  ⁠Pedir documentos con términos como 'documento' o 'PDF'";
      if (hasImages)
        optionsMessage +=
          "\n•⁠  ⁠Solicitar imágenes usando 'fotos' o 'catálogo'";
    }
    await ctxFn.flowDynamic(`${response.response}${optionsMessage}`);
    await ctxFn.state.update({ hasInteracted: true, thread: response.thread });
  } else {
    await ctxFn.flowDynamic(response.response);
  }
  return true;
}

export const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, ctxFn) => {
    try {
      if (deduplicateMessage(ctx)) return;
      const bodyText = ctx.body.toLowerCase().trim();
      const phoneNumber = ctx.from;
      const isFirstMessage = ctxFn.state.get("firstMessage") === undefined;
      if (isFirstMessage) await ctxFn.state.update({ firstMessage: false });
      logger.info(
        `[WELCOME] Procesando mensaje de ${phoneNumber}: "${bodyText.substring(
          0,
          50
        )}..."`
      );
      registerMessageHandler(async (targetPhone, message) => {
        if (targetPhone === phoneNumber) {
          await typing(1, { ctx, ctxFn });
          await ctxFn.flowDynamic(message);
        }
      });
      if (isMuted(phoneNumber)) {
        const state = await ctxFn.state.getMyState();
        addMutedMessage(phoneNumber, bodyText, state?.thread ?? null);
        return;
      }
      await wsUserService.createOrUpdateUser(phoneNumber, ctx.name);
      await wsUserService.logInteraction(phoneNumber, "text", bodyText);
      const hotUsers = await wsUserService.getHotUsers();
      const isHotUser = hotUsers.some(
        (user) => user.phone_number === phoneNumber
      );
      if (isHotUser) logger.info("Usuario caliente detectado:", phoneNumber);
      logger.debug(`[DEBUG] bodyText antes de handleSchedule: '${bodyText}'`);
      if (await handleSchedule(ctx, ctxFn, bodyText, isFirstMessage)) {
        logger.debug(
          `[DEBUG] handleSchedule activado para bodyText: '${bodyText}'`
        );
        return;
      }
      logger.debug(
        `[DEBUG] bodyText antes de handleAppointmentType: '${bodyText}'`
      );
      if (await handleAppointmentType(ctx, ctxFn, bodyText)) {
        logger.debug(
          `[DEBUG] handleAppointmentType activado para bodyText: '${bodyText}'`
        );
        return;
      }
      logger.debug(
        `[DEBUG] bodyText antes de handleDocumentRequest: '${bodyText}'`
      );
      if (await handleDocumentRequest(ctx, ctxFn, bodyText)) {
        logger.debug(
          `[DEBUG] handleDocumentRequest activado para bodyText: '${bodyText}'`
        );
        return;
      }
      logger.debug(
        `[DEBUG] bodyText antes de handleImageRequest: '${bodyText}'`
      );
      if (await handleImageRequest(ctx, ctxFn, bodyText)) {
        logger.debug(
          `[DEBUG] handleImageRequest activado para bodyText: '${bodyText}'`
        );
        return;
      }
      logger.debug(
        `[DEBUG] bodyText antes de handleNormalConversation: '${bodyText}'`
      );
      await handleNormalConversation(
        ctx,
        ctxFn,
        bodyText,
        phoneNumber,
        isFirstMessage
      );
    } catch (error) {
      logger.error("Error en welcomeFlow:", error);
      return ctxFn.endFlow(
        "Lo siento, hubo un error. Por favor, intenta nuevamente."
      );
    }
  }
);
