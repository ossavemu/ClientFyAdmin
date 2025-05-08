import { addKeyword, EVENTS } from "@builderbot/bot";
import fs from "fs";
import { trainingService } from "../services/ai/trainingService.js";
import { imageService } from "../services/setup/imageService.js";
import { logger } from "../services/setup/logger.js";
import { typing } from "../services/setup/typing.js";
import { processVoiceOrText } from "../utils/processVoiceOrText.js";

// Confirmación general que aceptará si/no
export const generalConfirmationFlow = addKeyword(EVENTS.ACTION).addAnswer(
  '¿Quieres continuar con esta acción? Responde con un "si" o "no"',
  { capture: true },
  async (ctx, ctxFn) => {
    try {
      const affirmativeKeywords = [
        "si",
        "sí",
        "yes",
        "claro",
        "dale",
        "por supuesto",
        "puedo",
        "confirmo",
        "ok",
        "okay",
        "vale",
      ];

      const negativeKeywords = [
        "no",
        "nop",
        "nope",
        "nel",
        "ne",
        "negativo",
        "imposible",
        "cancelo",
      ];

      const messageText = await processVoiceOrText(ctx);
      logger.info("Mensaje recibido en confirmación general:", messageText);

      const normalizedText = String(messageText)
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      logger.info("Texto normalizado:", normalizedText);

      const isAffirmativeAnswer = affirmativeKeywords.some(
        (keyword) =>
          normalizedText.includes(keyword) &&
          !normalizedText.startsWith("no ") &&
          !normalizedText.includes("no puedo")
      );

      const isNegativeAnswer = negativeKeywords.some((keyword) =>
        normalizedText.includes(keyword)
      );

      if (!isAffirmativeAnswer && !isNegativeAnswer) {
        await typing(1, { ctx, ctxFn });
        await ctxFn.flowDynamic(
          'No entendí tu respuesta. Por favor, responde solo con "si" o "no"'
        );
        return ctxFn.fallBack();
      }

      // Obtener el tipo de acción almacenado en el estado
      const state = await ctxFn.state.getMyState();
      const actionType = state?.confirmationAction;
      const phoneNumber = ctx.from;

      if (isAffirmativeAnswer) {
        await typing(1, { ctx, ctxFn });

        if (actionType === "images") {
          return processImagesRequest(phoneNumber, ctx, ctxFn);
        } else if (actionType === "documents") {
          return processDocumentsRequest(phoneNumber, ctx, ctxFn);
        } else {
          return ctxFn.endFlow("No se pudo determinar la acción a realizar.");
        }
      } else {
        await typing(1, { ctx, ctxFn });
        return ctxFn.endFlow("Acción cancelada. ¿En qué más puedo ayudarte?");
      }
    } catch (error) {
      logger.error("Error en generalConfirmationFlow:", error);
      return ctxFn.endFlow(
        "Hubo un error procesando tu respuesta. Por favor, intenta nuevamente."
      );
    }
  }
);

// Función para procesar solicitud de imágenes
async function processImagesRequest(phoneNumber, ctx, ctxFn) {
  try {
    const images = await imageService.getImages(phoneNumber);

    if (images && images.length > 0) {
      await ctxFn.flowDynamic("Aquí tienes las imágenes solicitadas:");

      for (const image of images) {
        await typing(1, { ctx, ctxFn });
        if (!image.localPath) {
          logger.warn(
            `Ruta local no válida para imagen: ${image.name || "desconocida"}`
          );
          continue;
        }

        try {
          await ctxFn.flowDynamic([
            {
              body: image.name || "Imagen",
              media: image.localPath,
            },
          ]);
        } catch (imgError) {
          logger.error("Error enviando imagen", imgError);
        }
      }
      return ctxFn.endFlow();
    } else {
      return ctxFn.endFlow("Lo siento, no encontré imágenes disponibles.");
    }
  } catch (error) {
    logger.error("Error al obtener imágenes", error);
    return ctxFn.endFlow(
      "Lo siento, hubo un problema al obtener las imágenes. Por favor, intenta más tarde."
    );
  }
}

// Función para procesar solicitud de documentos
async function processDocumentsRequest(phoneNumber, ctx, ctxFn) {
  try {
    const files = await trainingService.getTrainingFiles(phoneNumber);

    if (files && files.length > 0) {
      await ctxFn.flowDynamic("Aquí tienes los documentos solicitados:");

      for (const file of files) {
        await typing(1, { ctx, ctxFn });
        if (!file.localPath) {
          logger.error("Ruta local no válida:", file);
          continue;
        }

        try {
          await ctxFn.flowDynamic([
            {
              body: file.name || "Documento",
              media: file.localPath,
              mimeType: file.mimeType,
            },
          ]);
        } catch (fileError) {
          logger.error("Error enviando archivo:", fileError);
        } finally {
          // Limpiar archivo temporal
          if (fs.existsSync(file.localPath)) {
            fs.unlinkSync(file.localPath);
          }
        }
      }
      return ctxFn.endFlow();
    } else {
      return ctxFn.endFlow("Lo siento, no encontré documentos disponibles.");
    }
  } catch (error) {
    logger.error("Error al obtener documentos:", error);
    return ctxFn.endFlow(
      "Lo siento, hubo un problema al obtener los documentos. Por favor, intenta más tarde."
    );
  }
}

// Flujo específico para confirmar solicitud de imágenes
export const imageConfirmationFlow = addKeyword(EVENTS.ACTION).addAnswer(
  "¿Quieres que te muestre las imágenes disponibles?",
  null,
  async (ctx, ctxFn) => {
    await ctxFn.state.update({ confirmationAction: "images" });
    await typing(1, { ctx, ctxFn });
    return ctxFn.gotoFlow(generalConfirmationFlow);
  }
);

// Flujo específico para confirmar solicitud de documentos
export const documentConfirmationFlow = addKeyword(EVENTS.ACTION).addAnswer(
  "¿Quieres que te envíe los documentos disponibles?",
  null,
  async (ctx, ctxFn) => {
    await ctxFn.state.update({ confirmationAction: "documents" });
    await typing(1, { ctx, ctxFn });
    return ctxFn.gotoFlow(generalConfirmationFlow);
  }
);
