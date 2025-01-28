import { addKeyword, EVENTS } from "@builderbot/bot";
import fs from "fs";
import { config } from "../config/index.js";
import { chat } from "../services/ai/chatgpt.js";
import { trainingService } from "../services/ai/trainingService.js";
import { voice2text } from "../services/ai/voicegpt.js";
import { wsUserService } from "../services/data/wsUserService.js";
import { imageService } from "../services/setup/imageService.js";
import { typing } from "../services/setup/typing.js";
import { downloadFile, downloadFileBaileys } from "../utils/downloader.js";
import { removeFile } from "../utils/remover.js";
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
        console.error("Error: botNumber no está definido");
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
        await typing(1, { ctx, ctxFn });
        return ctxFn.gotoFlow(dateFlow);
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

      // Verificar si está solicitando documentos/archivos
      const isRequestingFiles =
        trainingService.containsTrainingKeywords(transcript);

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

      const state = await ctxFn.state.getMyState();
      const thread = state?.thread ?? null;

      // Pasar el botNumber correctamente a la función chat
      const response = await chat(transcript, botNumber, ctx.name, thread);

      await typing(1, { ctx, ctxFn });
      await ctxFn.state.update({ thread: response.thread });
      return ctxFn.endFlow(response.response);
    } catch (error) {
      console.error("Error en voiceFlow:", error);
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
