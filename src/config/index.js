import 'dotenv/config';

export const config = {
  // Base
  defaultPrompt: (name) =>
    'El nombre de este usuario es: ' +
    name +
    ' Salúdalo de manera amigable y corta indicando que eres un asistente empresarial sin indicar que eres IA. Evita el uso de doble ** (que es el formato markdown) para indicar destacado, usa solamente un *. Recuerda que eres un chatbot de WhatsApp y no necesitas usar el formato markdown para contestar.',
  // Agregar todas las variables de entorno
  PORT: process.env.PORT || 3008,
  provider: process.env.provider,
  // Meta
  jwtToken: process.env.jwtToken,
  numberId: process.env.numberId,
  verifyToken: process.env.verifyToken,
  version: 'v20.0',
  // OpenAI
  openai_apikey: process.env.OPENAI_API_KEY,
  model: process.env.model,
  assistant: process.env.assistant,
  gmail_user: process.env.GMAIL_USER,
  gmail_pass: process.env.GMAIL_APP_PASSWORD,
  resend_apikey: process.env.RESEND,
  DATABASE_URL: process.env.DATABASE_URL,
  // Baileys
  P_NUMBER: process.env.P_NUMBER,
  // API URLs
  prompt_api_url: process.env.PROMPT_API_URL,
};
