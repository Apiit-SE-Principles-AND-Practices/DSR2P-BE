import { z } from "zod";

export const NAME_MAX = 50;

export const categoryIdParamSchema = z.object({
  id: z.coerce.number().int("Invalid category id").positive("Invalid category id"),
});

const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`);

// [DSR2P]-categories — POST /admin/categories
export const createCategorySchema = z.object({ name });

// PUT /admin/categories/:id
export const updateCategorySchema = z.object({ name });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
