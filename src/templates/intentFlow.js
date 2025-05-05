import { addKeyword, EVENTS } from "@builderbot/bot";
import { classifyIntent } from "../services/ai/intentService.js";
import { processVoiceOrText } from "../utils/processVoiceOrText.js";
import { confirmationFlow, dateFlow } from "./dateFlow.js";
import { eventCreationFlow } from "./eventCreationFlow.js";
import { formFlow } from "./formFlow.js";
import { voiceFlow } from "./voiceFlow.js";

export const intentFlow = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, ctxFn) => {
    const text = await processVoiceOrText(ctx);
    const intent = await classifyIntent(text);
    switch (intent) {
      case "greeting":
        return;
      case "schedule_appointment":
        return ctxFn.gotoFlow(dateFlow);
      case "select_type":
        return ctxFn.gotoFlow(dateFlow);
      case "confirm_date":
        return ctxFn.gotoFlow(confirmationFlow);
      case "request_images":
        return ctxFn.gotoFlow(voiceFlow);
      case "request_files":
        return ctxFn.gotoFlow(formFlow);
      case "event_creation":
        return ctxFn.gotoFlow(eventCreationFlow);
      default:
        return ctxFn.fallBack();
    }
  }
);
