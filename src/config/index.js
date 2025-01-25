import "dotenv/config";

export const config = {
  // Base
  defaultPrompt: (userName) => `
    Eres un asesor comercial profesional y carismático. Tu objetivo es ayudar a ${
      userName || "nuestro cliente"
    } 
    a encontrar los productos o servicios perfectos para sus necesidades.

    Directrices de comportamiento:
    1. Sé cordial y profesional en todo momento
    2. Muestra entusiasmo genuino por nuestros productos/servicios
    3. Escucha activamente las necesidades del cliente
    4. Ofrece soluciones personalizadas
    5. Mantén un tono conversacional pero profesional
    6. Busca oportunidades para destacar el valor de nuestros productos/servicios
    7. Responde preguntas de manera clara y concisa
    8. Guía la conversación hacia una venta potencial de manera natural

    Cuando saludes por primera vez:
    - Preséntate de manera profesional
    - Menciona brevemente nuestra propuesta de valor
    - Muestra disponibilidad para ayudar
    - Haz una pregunta abierta para iniciar la conversación

    En cada interacción:
    - Personaliza las respuestas según el contexto
    - Mantén el enfoque en las necesidades del cliente
    - Sé proactivo en ofrecer información relevante
    - Busca oportunidades para agendar una cita o demostración
  `,
  // Agregar todas las variables de entorno
  PORT: process.env.PORT || 3008,
  WEB_PORT: process.env.WEB_PORT || 5432,
  provider: process.env.PROVIDER,
  // Meta
  jwtToken: process.env.jwtToken,
  numberId: process.env.numberId,
  verifyToken: process.env.verifyToken,
  version: "v20.0",
  // OpenAI
  openai_apikey: process.env.OPENAI_API_KEY,
  model: process.env.model,
  assistant: process.env.assistant,
  gmail_user: process.env.GMAIL_USER,
  gmail_pass: process.env.GMAIL_APP_PASSWORD,
  resend_apikey: process.env.RESEND,
  DATABASE_URL: process.env.DATABASE_URL,
  // Baileys
  P_NUMBER: process.env.P_NUMBER || "bot_baileys_default",
  // API URLs
  prompt_api_url: process.env.PROMPT_API_URL,
  images_api_url:
    process.env.IMAGES_API_URL || "http://localhost:3000/api/images",
  test_phone_number: "529874561230", // Número de prueba para imágenes
  // Agregar URL para archivos de entrenamiento
  training_files_url:
    process.env.TRAINING_FILES_URL ||
    "http://localhost:3000/api/training-files",
  // Características configurables
  enableAppointments: process.env.ENABLE_APPOINTMENTS,
  enableAutoInvite: process.env.ENABLE_AUTO_INVITE,
  // Turso config
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,

  // Agregar configuración base para calendarios
  calendar: {
    timeZone: "America/Cancun",
    rangeLimit: {
      days: [1, 2, 3, 4, 5], // Lunes a Viernes
      startHour: 9,
      endHour: 18,
    },
    standardDuration: 1,
    dateLimit: 30,
  },

  // Validar que P_NUMBER esté presente
  validateConfig() {
    if (!this.P_NUMBER) {
      throw new Error("P_NUMBER es requerido en las variables de ambiente");
    }
    // Solo validar que sea un número válido
    if (!this.P_NUMBER.match(/^\d+$/)) {
      throw new Error(`P_NUMBER debe ser un número válido: ${this.P_NUMBER}`);
    }
  },
};

// Ejecutar validación al importar
config.validateConfig();
