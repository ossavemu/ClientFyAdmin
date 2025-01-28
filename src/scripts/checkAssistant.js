import OpenAI from "openai";
import { config } from "../config/index.js";
import { db } from "../database/connection.js";

const openai = new OpenAI({
  apiKey: config.openai_apikey,
});

async function checkAssistant() {
  try {
    // Obtener el ID del asistente de la base de datos para el número de Meta
    const result = await db.sql`
      SELECT assistant_id 
      FROM bot_assistants 
      WHERE bot_number = ${config.numberId}
    `;

    if (result.length === 0) {
      console.log("No se encontró ningún asistente para este número de bot");
      return;
    }

    const assistantId = result[0].assistant_id;
    console.log("ID del asistente encontrado:", assistantId);

    // Obtener detalles del asistente
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    console.log(
      "\nDetalles del asistente:",
      JSON.stringify(assistant, null, 2)
    );

    // Obtener archivos adjuntos
    const files = await openai.beta.assistants.files.list(assistantId);
    console.log("\nArchivos adjuntos:", JSON.stringify(files.data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkAssistant();
