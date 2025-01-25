import { addKeyword, EVENTS } from "@builderbot/bot";
import fs from "fs";
import { config } from "../config/index.js";
import { chat } from "../services/chatgpt.js";
import { imageService } from "../services/imageService.js";
import { typing } from "../services/typing.js";
import { wsUserService } from "../services/wsUserService.js";
import { dateFlow } from "./dateFlow.js";

const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(async (ctx, ctxFn) => {
  try {
    const bodyText = ctx.body.toLowerCase().trim();
    const phoneNumber = ctx.from;

    // Registrar o actualizar usuario
    await wsUserService.createOrUpdateUser(phoneNumber, ctx.name);

    // Registrar la interacción
    await wsUserService.logInteraction(phoneNumber, "text", bodyText);

    // Verificar si es un usuario "caliente"
    const hotUsers = await wsUserService.getHotUsers();
    const isHotUser = hotUsers.some(
      (user) => user.phone_number === phoneNumber
    );

    if (isHotUser) {
      console.log("Usuario caliente detectado:", phoneNumber);
    }

    const days = [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
      "domingo",
    ];

    const keywordsSchedule = [
      "agendar",
      "cita",
      "reservar",
      "reunión",
      "turno",
      "hoy",
      "mañana",
      ...days,
    ];

    const isScheduleRequest = keywordsSchedule.some(
      (keyword) => bodyText.includes(keyword) || !isNaN(Number(keyword))
    );

    if (isScheduleRequest) {
      if (!config.enableAppointments) {
        await typing(1, { ctx, ctxFn });
        return ctxFn.endFlow(
          "Lo siento, el servicio de citas no está disponible en este momento."
        );
      }
      await typing(1, { ctx, ctxFn });
      return ctxFn.gotoFlow(dateFlow);
    }

    // Palabras clave relacionadas con imágenes
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

    if (isRequestingImages) {
      await typing(1, { ctx, ctxFn });
      try {
        const images = await imageService.getImages(phoneNumber);

        if (images && images.length > 0) {
          await ctxFn.flowDynamic("Aquí tienes las imágenes solicitadas:");

          // Enviar cada imagen
          for (const image of images) {
            await typing(1, { ctx, ctxFn });
            await ctxFn.flowDynamic([
              {
                body: image.name,
                media: image.url,
              },
            ]);
          }
          return ctxFn.endFlow();
        } else {
          return ctxFn.endFlow("Lo siento, no encontré imágenes disponibles.");
        }
      } catch (error) {
        console.error("Error al obtener imágenes:", error);
        return ctxFn.endFlow(
          "Lo siento, hubo un problema al obtener las imágenes. Por favor, intenta más tarde."
        );
      }
    }

    const state = await ctxFn.state.getMyState();
    const thread = state?.thread ?? null;

    await typing(1, { ctx, ctxFn });

    // Determinar qué número de bot usar basado en el provider
    const botNumber =
      config.provider === "meta" ? config.numberId : config.P_NUMBER;

    if (!botNumber) {
      console.error("Error: botNumber no está definido");
      return ctxFn.endFlow(
        "Lo siento, hay un problema con la configuración del bot. Por favor, contacta al administrador."
      );
    }

    const response = await chat(ctx.body, botNumber, ctx.name, thread);
    await ctxFn.state.update({ thread: response.thread });

    // Si hay un archivo para enviar (quitamos la verificación de enableAutoInvite)
    if (response.media) {
      await typing(1, { ctx, ctxFn });
      try {
        await ctxFn.flowDynamic([
          {
            body: response.response,
            media: response.media.path,
            filename: response.media.filename,
            mimeType: response.media.mimetype,
          },
        ]);
      } catch (error) {
        console.error("Error enviando archivo:", error);
        return ctxFn.endFlow(
          "Lo siento, hubo un error al enviar el archivo. Por favor, intenta nuevamente."
        );
      } finally {
        // Limpiar archivo temporal
        if (response.media.path && fs.existsSync(response.media.path)) {
          fs.unlinkSync(response.media.path);
        }
      }
      return ctxFn.endFlow();
    }

    return ctxFn.endFlow(response.response);
  } catch (error) {
    console.error("Error en welcomeFlow:", error);
    return ctxFn.endFlow(
      "Lo siento, hubo un error. Por favor, intenta nuevamente."
    );
  }
});

export { welcomeFlow };
