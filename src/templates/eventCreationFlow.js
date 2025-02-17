import { addKeyword, EVENTS } from "@builderbot/bot";
import { config } from "../config/index.js";
import { wsUserService } from "../services/data/wsUserService.js";
import { createEvent } from "../services/features/calendar.js";
import { emailInvite } from "../services/features/email.js";
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
      const appointmentType = userInfo.appointmentType || "inPerson";

      let zoomLink = null;
      // Solo generar link de Zoom si es cita virtual
      if (appointmentType === "virtual") {
        zoomLink = await zoomInviteLink(date, clientEmail);
      }

      // Enviar email con o sin link de Zoom según el tipo de cita
      await emailInvite(clientEmail, name, date, zoomLink);

      const description = `${name} - Cita ${
        appointmentType === "virtual" ? "Virtual" : "Presencial"
      }${
        zoomLink
          ? `\nLink de zoom: ${zoomLink}`
          : `\nUbicación: ${config.company_address}`
      }\nEmail: ${clientEmail}`;

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
        const confirmationMessage =
          appointmentType === "virtual"
            ? `Agendado correctamente. Tu enlace de Zoom: ${zoomLink}`
            : `Agendado correctamente. Te esperamos en ${config.company_address} en la fecha y hora acordada.`;

        return ctxFn.endFlow(confirmationMessage);
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
