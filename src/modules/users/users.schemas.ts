import { z } from "zod";
import { NAME_MAX } from "../auth/auth.schemas";

// [DSR2P]-6-BE1 — PATCH /users/me — updateProfile(name, language).
// Both fields are optional (a caller may update just one), but the body must
// change at least one of them, and an empty/whitespace-only name is rejected
// the same way registration rejects one.
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be blank")
      .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`)
      .optional(),
    language: z.enum(["en", "si", "ta"]).optional(),
  })
  .refine((data) => data.name !== undefined || data.language !== undefined, {
    message: "Provide at least a name or a language to update",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
