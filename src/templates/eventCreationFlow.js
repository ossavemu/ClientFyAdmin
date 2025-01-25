import { addKeyword, EVENTS } from "@builderbot/bot";
import { wsUserService } from "../services/data/wsUserService.js";
import { emailInvite } from "../services/email.js";
import { createEvent } from "../services/features/calendar.js";
import { zoomInviteLink } from "../services/features/zoom.js";
import { typing } from "../services/setup/typing.js";

export const eventCreationFlow = addKeyword(EVENTS.ACTION).addAnswer(
  "Agendando la reunión...",
  null,
  async (ctx, ctxFn) => {
    try {
      const userInfo = await ctxFn.state.getMyState();
      const botNumber = process.env.P_NUMBER;
      console.log("Estado actual:", userInfo);

      const name = userInfo.name;
      const clientEmail = userInfo.email;
      const date = userInfo.date;
      const phoneNumber = ctx.from;

      const zoomLink = await zoomInviteLink(date, clientEmail);

      await emailInvite(clientEmail, name, date, zoomLink);

      const description = `${name} te invitó a una reunión. Link de zoom: ${
        zoomLink ?? ""
      } el usuario es ${clientEmail}`;

      const eventId = await createEvent(name, description, date, botNumber);

      if (eventId) {
        await wsUserService.createAgenda(
          phoneNumber,
          date,
          clientEmail,
          name,
          zoomLink
        );

        await wsUserService.logInteraction(
          phoneNumber,
          "text",
          "Agenda exitosa"
        );

        await typing(1, { ctx, ctxFn });
        return ctxFn.endFlow(
          "Agendado correctamente con tu correo electrónico. Tu enlace: " +
            zoomLink
        );
      }
    } catch (error) {
      await typing(1, { ctx, ctxFn });
      return ctxFn.endFlow(
        "Hubo un error al agendar la reunión. Por favor, intenta nuevamente."
      );
    } finally {
      await ctxFn.state.clear();
    }
  }
);
