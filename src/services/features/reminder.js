import { utils } from "@builderbot/bot";
import { schedule } from "node-cron";
import { config } from "../../config/index.js";
import { getPrompt } from "../ai/promptService.js";
import { simpleChat } from "../ai/simplegpt.js";
import { wsUserService } from "../data/wsUserService.js";

export const reminder = async (adapterProvider) => {
  // Envío de mensajes de enganche cada 12 horas
  schedule("0 */12 * * *", async () => {
    if (!config.enableAutoInvite) {
      console.log(
        "ℹ️ Auto-invite deshabilitado, saltando mensajes de enganche"
      );
      return;
    }

    console.log("🔄 Iniciando envío de mensajes de enganche");

    try {
      // Obtener usuarios calientes
      const hotUsers = await wsUserService.getHotUsers();

      if (!hotUsers.length) {
        console.log("ℹ️ No hay usuarios calientes para enviar mensajes");
        return;
      }

      // Obtener el prompt del negocio
      const businessPrompt = await getPrompt(config.P_NUMBER);

      for (const user of hotUsers) {
        try {
          const count =
            await wsUserService.countEngagementMessagesSinceLastUser(
              user.phone_number
            );
          if (count >= 4) {
            console.log(
              `ℹ️ Usuario ${user.phone_number} ya recibió 4 mensajes de enganche desde su último mensaje, saltando.`
            );
            continue;
          }
          // Obtener historial reciente de conversaciones del usuario
          const recentHistory = await wsUserService.getRecentHistory(
            user.phone_number
          );

          // Crear contexto para el mensaje
          const context = recentHistory.map((h) => ({
            role: h.provider === "bot" ? "assistant" : "user",
            content: h.message_content,
          }));

          // Prompt para generar mensaje de enganche
          const engagementPrompt = `
            ${businessPrompt}

            Instrucciones específicas:
            1. Genera un mensaje corto y atractivo para re-enganchar al cliente
            2. Usa el contexto de sus conversaciones previas para personalizar el mensaje
            3. El mensaje debe ser natural y no parecer automatizado
            4. Incluye una pregunta o call-to-action sutil
            5. Mantén el mensaje en menos de 3 líneas
            6. No menciones que eres una IA o bot

            Contexto de conversaciones previas con el cliente:
            ${JSON.stringify(context)}
          `;

          // Generar mensaje personalizado
          const message = await simpleChat(engagementPrompt, []);

          // Enviar mensaje
          await adapterProvider.sendMessage(user.phone_number, message, {});

          // Registrar la interacción
          await wsUserService.logInteraction(
            user.phone_number,
            "text",
            message,
            "bot"
          );

          // Esperar 5 segundos entre mensajes
          await utils.delay(5000);
        } catch (error) {
          console.error(
            `❌ Error enviando mensaje a ${user.phone_number}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("❌ Error en el envío de mensajes de enganche:", error);
    }
  });

  // Recordatorios de citas: verificar cada hora
  schedule("0 * * * *", async () => {
    if (!config.enableAppointments) {
      console.log("ℹ️ Recordatorios de citas deshabilitados");
      return;
    }

    console.log("🔔 Verificando próximas citas para enviar recordatorios");

    try {
      const upcomingAppointments =
        await wsUserService.getUpcomingAppointments();

      for (const appointment of upcomingAppointments) {
        try {
          const appointmentTime = new Date(appointment.scheduled_at);
          const now = new Date();

          // Calcular diferencia en horas
          const hoursUntilAppointment = Math.round(
            (appointmentTime - now) / (1000 * 60 * 60)
          );

          // Obtener hora actual
          const currentHour = now.getHours();

          // Verificar si es momento de enviar recordatorio
          const shouldSendReminder =
            // Día anterior a las 6am
            (hoursUntilAppointment <= 42 &&
              hoursUntilAppointment > 41 &&
              currentHour === 6) ||
            // Día anterior a las 8pm
            (hoursUntilAppointment <= 28 &&
              hoursUntilAppointment > 27 &&
              currentHour === 20) ||
            // Día de la cita a las 6am
            (hoursUntilAppointment <= 18 &&
              hoursUntilAppointment > 17 &&
              currentHour === 6) ||
            // Una hora antes de la cita
            (hoursUntilAppointment <= 1 && hoursUntilAppointment > 0);

          if (shouldSendReminder) {
            let reminderType = "";
            if (hoursUntilAppointment > 40) reminderType = "día anterior 6am";
            else if (hoursUntilAppointment > 26)
              reminderType = "día anterior 8pm";
            else if (hoursUntilAppointment > 16) reminderType = "mismo día 6am";
            else reminderType = "una hora antes";

            const reminderMessage = `
¡Hola! 👋 Te recordamos que tienes una cita programada:

📅 Fecha: ${appointmentTime.toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
⏰ Hora: ${appointmentTime.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
${appointment.zoom_link ? `🔗 Link de Zoom: ${appointment.zoom_link}` : ""}
`;

            await adapterProvider.sendMessage(
              appointment.phone_number,
              reminderMessage,
              {}
            );

            await wsUserService.logInteraction(
              appointment.phone_number,
              "text",
              `Recordatorio de cita enviado (${reminderType})`,
              "bot"
            );
          }
        } catch (msgError) {
          console.error(
            `❌ Error al enviar recordatorio a ${appointment.phone_number}:`,
            msgError
          );
        }
      }
    } catch (error) {
      console.error("❌ Error al procesar recordatorios de citas:", error);
    }
  });
};
