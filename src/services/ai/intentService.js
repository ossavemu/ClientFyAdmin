import { simpleChat } from "./simplegpt.js";

const classificationPrompt = `Eres un clasificador de intenciones para un bot de WhatsApp. Dada la entrada del usuario, clasifícala en una de las siguientes intenciones: schedule_appointment, select_type, confirm_date, request_images, request_files, greeting, fallback. Responde solo con el nombre de la intención.`;

export async function classifyIntent(text) {
  const response = await simpleChat(classificationPrompt, [
    { role: "user", content: text },
  ]);
  return response.trim();
}
