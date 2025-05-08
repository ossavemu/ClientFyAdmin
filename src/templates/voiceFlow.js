import { addKeyword, EVENTS } from "@builderbot/bot";
import { config } from "../config/index.js";
import { chat } from "../services/ai/chatgpt.js";
import { trainingService } from "../services/ai/trainingService.js";
import { voice2text } from "../services/ai/voicegpt.js";
import { wsUserService } from "../services/data/wsUserService.js";
import { logger } from "../services/setup/logger.js";
import { typing } from "../services/setup/typing.js";
import { downloadFile, downloadFileBaileys } from "../utils/downloader.js";
import { removeFile } from "../utils/remover.js";
import {
  documentConfirmationFlow,
  imageConfirmationFlow,
} from "./confirmationFlows.js";
import { dateFlow } from "./dateFlow.js";

const voiceFlow = addKeyword(EVENTS.VOICE_NOTE).addAction(
  async (ctx, ctxFn) => {
    let filePath;
    try {
      const phoneNumber = ctx.from;

      // Determinar qué número de bot usar basado en el provider
      const botNumber =
        config.provider === "meta" ? config.numberId : config.P_NUMBER;

      if (!botNumber) {
        logger.error("Error: botNumber no está definido");
        return ctxFn.endFlow(
          "Lo siento, hay un problema con la configuración del bot. Por favor, contacta al administrador."
        );
      }

      // Registrar o actualizar usuario
      await wsUserService.createOrUpdateUser(phoneNumber, ctx.name);

      if (config.provider === "meta") {
        filePath = await downloadFile(ctx.url, config.jwtToken);
      } else if (config.provider === "baileys") {
        filePath = await downloadFileBaileys(ctx);
      }

      const transcript = await voice2text(filePath.filePath);

      // Registrar la interacción de voz
      await wsUserService.logInteraction(phoneNumber, "voice", transcript);

      await typing(1, { ctx, ctxFn });
      await ctxFn.state.update({ voiceTranscript: transcript });

      const keywordsSchedule = [
        "agendar",
        "cita",
        "reservar",
        "reunión",
        "turno",
        "hoy",
        "mañana",
      ];

      const isSchedule = keywordsSchedule.some((keyword) =>
        transcript.toLowerCase().includes(keyword)
      );

      if (isSchedule) {
        // Verificar qué tipos de citas están habilitados
        const virtualEnabled = config.enableVirtualAppointments;
        const inPersonEnabled = config.enableInPersonAppointments;

        if (!virtualEnabled && !inPersonEnabled) {
          await typing(1, { ctx, ctxFn });
          return ctxFn.endFlow(
            "Lo siento, el servicio de citas no está disponible en este momento."
          );
        }

        // Si solo un tipo está habilitado, usar ese directamente
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

        // Si ambos tipos están habilitados, preguntar al usuario
        await typing(1, { ctx, ctxFn });
        await ctxFn.flowDynamic(
          "¿Qué tipo de cita prefieres?\n1. Virtual (por videollamada)\n2. Presencial"
        );

        // Esperar respuesta del usuario
        await ctxFn.state.update({
          waitingForAppointmentType: true,
          lastMessage: transcript,
        });
        return;
      }

      // Manejar la respuesta del tipo de cita si estamos esperando por ella
      const state = await ctxFn.state.getMyState();
      if (state?.waitingForAppointmentType) {
        const response = transcript.toLowerCase();
        let appointmentType = null;

        if (
          response.includes("1") ||
          response.includes("virtual") ||
          response.includes("video")
        ) {
          appointmentType = "virtual";
        } else if (response.includes("2") || response.includes("presencial")) {
          appointmentType = "inPerson";
        }

        if (appointmentType) {
          await ctxFn.state.update({
            appointmentType,
            waitingForAppointmentType: false,
            voiceTranscript: state.lastMessage, // Restaurar el mensaje original
          });
          await typing(1, { ctx, ctxFn });
          return ctxFn.gotoFlow(dateFlow);
        } else {
          await typing(1, { ctx, ctxFn });
          await ctxFn.flowDynamic(
            "Por favor, selecciona una opción válida:\n1. Virtual (por videollamada)\n2. Presencial"
          );
          return;
        }
      }

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
        transcript.toLowerCase().includes(keyword)
      );

      if (isRequestingImages) {
        await typing(1, { ctx, ctxFn });
        // Redirigir al flujo de confirmación para imágenes
        return ctxFn.gotoFlow(imageConfirmationFlow);
      }

      // Verificar si está solicitando documentos/archivos
      const isRequestingFiles =
        trainingService.containsTrainingKeywords(transcript);

      if (isRequestingFiles) {
        await typing(1, { ctx, ctxFn });
        // Redirigir al flujo de confirmación para documentos
        return ctxFn.gotoFlow(documentConfirmationFlow);
      }

      const thread = state?.thread ?? null;

      // Pasar el botNumber correctamente a la función chat
      const response = await chat(transcript, botNumber, ctx.name, thread);

      await typing(1, { ctx, ctxFn });
      await ctxFn.state.update({ thread: response.thread });
      return ctxFn.endFlow(response.response);
    } catch (error) {
      logger.error("Error en voiceFlow", error);
      return ctxFn.endFlow("Hubo un error procesando tu mensaje de voz");
    } finally {
      if (filePath) {
        if (filePath.filePath) removeFile(filePath.filePath);
        if (filePath.fileOldPath) removeFile(filePath.fileOldPath);
      }
    }
  }
);

export { voiceFlow };
