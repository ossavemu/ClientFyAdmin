/**
 * Procesa un mensaje que puede ser de texto o de voz
 * @param {Object} ctx - Objeto de contexto del mensaje
 * @returns {Promise<string>} - El texto del mensaje o la transcripción de la nota de voz
 */
export async function processVoiceOrText(ctx) {
  // Si es una nota de voz, usa la transcripción del estado
  if (
    ctx.hasOwnProperty("_data") &&
    ctx._data.hasOwnProperty("type") &&
    ctx._data.type === "ptt"
  ) {
    const state =
      ctx.state && ctx.state.getMyState ? await ctx.state.getMyState() : {};
    return state?.voiceTranscript || "";
  }

  // Si es un mensaje de texto normal, devuelve el cuerpo del mensaje
  return ctx.body || "";
}
