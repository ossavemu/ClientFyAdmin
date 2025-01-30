import { z } from "zod";

export const wsUserSchema = z
  .object({
    phone_number: z
      .string()
      .transform((val) => {
        // Limpiar y formatear el número
        const cleaned = val.replace(/\D/g, "");
        return cleaned.startsWith("57") ? cleaned : `57${cleaned}`;
      })
      .refine(
        (val) => val.length >= 12,
        "El número de teléfono debe tener al menos 12 dígitos (incluyendo el prefijo 57)"
      )
      .refine(
        (val) => /^57[0-9]{10,}$/.test(val),
        "El número debe comenzar con 57 seguido de al menos 10 dígitos"
      ),

    name: z
      .string()
      .transform((val) => (val || "").trim()) // Limpiar espacios
      .default(""), // Valor por defecto

    interaction_count: z.number().int().min(1).default(1),

    last_interaction: z.date().default(() => new Date()),

    created_at: z.date().default(() => new Date()),
  })
  .superRefine((data, ctx) => {
    // Validación cruzada después de procesar todos los campos
    let finalName = data.name;

    // Si el nombre es inválido, usar el phone_number
    if (finalName.length < 2) {
      finalName = data.phone_number;
    }

    // Aplicar validaciones al nombre final
    if (finalName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 2,
        type: "string",
        inclusive: true,
        message: "El nombre debe tener al menos 2 caracteres",
      });
    }

    if (finalName.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: "string",
        inclusive: true,
        message: "El nombre no puede exceder 100 caracteres",
      });
    }

    // Devolver los datos modificados
    return { ...data, name: finalName };
  });

export const historicSchema = z
  .object({
    phone_number: z.string(),
    bot_number: z.string().optional(),
    message_type: z.string(),
    message_content: z.string(),
    provider: z.string(),
  })
  .transform((data) => {
    // Si el provider no es "user", bot_number es requerido
    if (data.provider !== "user" && !data.bot_number) {
      throw new Error("bot_number es requerido cuando provider no es 'user'");
    }
    // Si es un mensaje de usuario, usar el número del bot actual
    if (data.provider === "user" && !data.bot_number) {
      data.bot_number = process.env.P_NUMBER;
    }
    return data;
  });
