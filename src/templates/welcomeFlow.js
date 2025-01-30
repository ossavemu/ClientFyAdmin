import { addKeyword, EVENTS } from "@builderbot/bot";
import fs from "fs";
import { config } from "../config/index.js";
import { chat } from "../services/ai/chatgpt.js";
import { trainingService } from "../services/ai/trainingService.js";
import { wsUserService } from "../services/data/wsUserService.js";
import { imageService } from "../services/setup/imageService.js";
import { typing } from "../services/setup/typing.js";
import { notifyNewUser } from "../web/server.js";
import {
  addMutedMessage,
  isMuted,
  registerMessageHandler,
} from "../web/socket.js";
import { dateFlow } from "./dateFlow.js";

export const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, ctxFn) => {
    try {
      const bodyText = ctx.body.toLowerCase().trim();
      const phoneNumber = ctx.from;
      const isFirstMessage = ctxFn.state.get("firstMessage") === undefined;
      if (isFirstMessage) await ctxFn.state.update({ firstMessage: false });

      // Registrar el handler para enviar mensajes
      registerMessageHandler(async (targetPhone, message) => {
        if (targetPhone === phoneNumber) {
          await typing(1, { ctx, ctxFn });
          await ctxFn.flowDynamic(message);
        }
      });

      // Verificar si el usuario está muteado usando el sistema en memoria
      if (isMuted(phoneNumber)) {
        // Guardar el mensaje para contexto futuro
        const state = await ctxFn.state.getMyState();
        addMutedMessage(phoneNumber, bodyText, state?.thread ?? null);
        // Si está muteado, permitir que el mensaje pase sin respuesta del bot
        return;
      }

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

      // Verificar si está solicitando documentos/archivos
      const isRequestingFiles =
        trainingService.containsTrainingKeywords(bodyText);

      if (isRequestingFiles) {
        await typing(1, { ctx, ctxFn });
        try {
          const files = await trainingService.getTrainingFiles(phoneNumber);

          if (files && files.length > 0) {
            await ctxFn.flowDynamic("Aquí tienes los documentos solicitados:");

            for (const file of files) {
              await typing(1, { ctx, ctxFn });
              if (!file.localPath) {
                console.error("Ruta local no válida:", file);
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
                console.error("Error enviando archivo:", fileError);
              } finally {
                // Limpiar archivo temporal
                if (fs.existsSync(file.localPath)) {
                  fs.unlinkSync(file.localPath);
                }
              }
            }
            return ctxFn.endFlow();
          } else {
            return ctxFn.endFlow(
              "Lo siento, no encontré documentos disponibles."
            );
          }
        } catch (error) {
          console.error("Error al obtener documentos:", error);
          return ctxFn.endFlow(
            "Lo siento, hubo un problema al obtener los documentos. Por favor, intenta más tarde."
          );
        }
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

            for (const image of images) {
              await typing(1, { ctx, ctxFn });
              if (!image.localPath) {
                console.error("Ruta local no válida:", image);
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
                console.error("Error enviando imagen:", imgError);
              } finally {
                // Limpiar archivo temporal
                if (fs.existsSync(image.localPath)) {
                  fs.unlinkSync(image.localPath);
                }
              }
            }
            return ctxFn.endFlow();
          } else {
            return ctxFn.endFlow(
              "Lo siento, no encontré imágenes disponibles."
            );
          }
        } catch (error) {
          console.error("Error al obtener imágenes:", error);
          return ctxFn.endFlow(
            "Lo siento, hubo un problema al obtener las imágenes. Por favor, intenta más tarde."
          );
        }
      }

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

      const response = await chat(
        ctx.body,
        botNumber,
        ctx.name,
        ctxFn.state.get("thread") ?? null
      );
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

      // Notificar al panel web sobre el nuevo usuario
      await notifyNewUser(phoneNumber, ctx.name);

      // Modificar la sección de estado
      const currentState = (await ctxFn.state.getMyState()) || {};

      if (!currentState.hasInteracted) {
        // Obtener opciones disponibles
        const hasDocuments =
          (await trainingService.getTrainingFiles(botNumber)).length > 0;
        const hasImages = (await imageService.getImages(botNumber)).length > 0;

        // Construir mensaje de opciones
        let optionsMessage = "";
        if (config.enableAppointments || hasDocuments || hasImages) {
          optionsMessage += "\n\nTambién puedes:";
          if (config.enableAppointments)
            optionsMessage +=
              "\n- Agendar citas usando palabras como 'cita' o 'reservar'";
          if (hasDocuments)
            optionsMessage +=
              "\n- Pedir documentos con términos como 'documento' o 'PDF'";
          if (hasImages)
            optionsMessage +=
              "\n- Solicitar imágenes usando 'fotos' o 'catálogo'";
        }

        // Enviar respuesta combinada
        await ctxFn.flowDynamic(`${response.response}${optionsMessage}`);

        // Actualizar estado
        await ctxFn.state.update({
          hasInteracted: true,
          thread: response.thread,
        });
      } else {
        await ctxFn.flowDynamic(response.response);
      }
    } catch (error) {
      console.error("Error en welcomeFlow:", error);
      return ctxFn.endFlow(
        "Lo siento, hubo un error. Por favor, intenta nuevamente."
      );
    }
  }
);
