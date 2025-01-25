import "dotenv/config";

export const config = {
  // Base
  defaultPrompt: (name) => `
Eres un asistente virtual de WhatsApp especializado en ventas y atención al cliente.
${name ? `El nombre de este usuario es: ${name}.` : ""}
Instrucciones:
- Saluda de manera amigable y corta
- Evita mencionar que eres una IA
- Usa un asterisco (*) para énfasis, no doble asterisco
- Sé conciso y directo en tus respuestas
- Mantén un tono profesional pero amigable
`,
  // Agregar todas las variables de entorno
  PORT: process.env.PORT || 3008,
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
