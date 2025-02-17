import nodemailer from "nodemailer";
import { Resend } from "resend";
import { config } from "../../config/index.js";

const resend = new Resend(config.resend_apikey);
const COMPANY_NAME = config.company_name || "Clínica Dental";
const COMPANY_ADDRESS = config.company_address || "Dirección no especificada";

export const emailLogger = async (
  name,
  zoomLink,
  date,
  clientEmail,
  isVirtual
) => {
  try {
    const emailInvite = await resend.emails.send({
      from: `${COMPANY_NAME} Logger <onboarding@resend.dev>`,
      to: "clientfy0@gmail.com",
      subject: `Registro de Nueva Cita ${isVirtual ? "Virtual" : "Presencial"}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Nueva Cita Registrada</h2>
          <p><strong>Detalles de la cita:</strong></p>
          <ul>
            <li><strong>Cliente:</strong> ${name}</li>
            <li><strong>Email del cliente:</strong> ${clientEmail}</li>
            <li><strong>Tipo de cita:</strong> ${
              isVirtual ? "Virtual" : "Presencial"
            }</li>
            <li><strong>Fecha de creación del evento:</strong> ${new Date().toLocaleString(
              "es-ES",
              {
                dateStyle: "full",
                timeStyle: "short",
              }
            )}</li>
            <li><strong>Fecha de la cita:</strong> ${date}</li>
            ${
              isVirtual
                ? `<li><strong>Link de Zoom:</strong> ${zoomLink}</li>`
                : `<li><strong>Ubicación:</strong> ${COMPANY_ADDRESS}</li>`
            }
          </ul>
          <p>Este es un mensaje automático de registro - No responder</p>
        </div>
      `,
    });
    console.log("Log de cita enviado:", emailInvite);
    return true;
  } catch (error) {
    console.error("Error en emailLogger:", error);
    return false;
  }
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: config.gmail_user,
    pass: config.gmail_pass,
  },
});

export const emailInvite = async (clientEmail, name, date, zoomLink) => {
  try {
    const isVirtual = !!zoomLink;
    date = new Date(date).toLocaleString("es-ES", {
      dateStyle: "full",
      timeStyle: "short",
    });
    await emailLogger(name, zoomLink, date, clientEmail, isVirtual);

    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hola ${name},</h2>
        <p>Te confirmamos tu cita ${
          isVirtual ? "virtual" : "presencial"
        } con ${COMPANY_NAME}. Aquí están los detalles:</p>
        <p><strong>Fecha de la cita:</strong> ${date}</p>
        ${
          isVirtual
            ? `<p><strong>Enlace de Zoom:</strong> <a href="${zoomLink}" style="color: #1a73e8;">${zoomLink}</a></p>`
            : `<p><strong>Ubicación:</strong> ${COMPANY_ADDRESS}</p><p>Te esperamos en nuestra ubicación en la fecha y hora acordada.</p>`
        }
        <p>¡Gracias por confiar en nosotros!</p>
        <p>Saludos,<br>${COMPANY_NAME}</p>
      </div>
    `;

    // Si el proveedor es meta, usar Resend
    if (config.provider === "meta") {
      await resend.emails.send({
        from: `${COMPANY_NAME} <onboarding@resend.dev>`,
        to: clientEmail,
        subject: `Confirmación de Cita ${
          isVirtual ? "Virtual" : "Presencial"
        } - ${COMPANY_NAME}`,
        html: emailTemplate,
      });
    } else {
      // Para otros proveedores, usar nodemailer con Gmail
      await transporter.sendMail({
        from: `"${COMPANY_NAME}" <${config.gmail_user}>`,
        to: clientEmail,
        subject: `Confirmación de Cita ${
          isVirtual ? "Virtual" : "Presencial"
        } - ${COMPANY_NAME}`,
        html: emailTemplate,
      });
    }
  } catch (error) {
    console.error("Error enviando email:", error);
    throw new Error("No se pudo enviar el email de invitación");
  }
};
