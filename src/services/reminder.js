import { utils } from '@builderbot/bot';
import { schedule } from 'node-cron';

export const reminder = (adapterDB, adapterProvider) =>
  schedule('*/10 * * * *', async () => {
    // Expresión cron para cada 10 minutos
    console.log(
      '📅 Ejecutando tarea programada: Enviar mensajes de agradecimiento cada 10 minutos'
    );

    try {
      const users = await adapterDB.getAll();

      // Definir una lista de mensajes de agradecimiento
      const thankYouMessages = [
        '¡Gracias por ser parte de nuestra comunidad!',
        'Agradecemos tu interacción.',
        '¡Gracias por tu apoyo continuo!',
        'Tu presencia significa mucho para nosotros.',
        '¡Gracias por estar con nosotros!',
      ];

      for (const user of users) {
        // Seleccionar un mensaje de agradecimiento aleatorio
        const randomMessage =
          thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];

        try {
          // Enviar el mensaje al usuario
          await adapterProvider.sendMessage(user.number, randomMessage, {});
          console.log(
            `✅ Mensaje enviado a ${user.number}: "${randomMessage}"`
          );

          // Esperar 5 segundos antes de enviar el siguiente mensaje para evitar sobrecargas
          await utils.delay(5000);
        } catch (msgError) {
          console.error(
            `❌ Error al enviar mensaje a ${user.number}:`,
            msgError
          );
        }
      }
    } catch (error) {
      console.error(
        '❌ Error en la tarea programada de agradecimiento:',
        error
      );
    }
  });
