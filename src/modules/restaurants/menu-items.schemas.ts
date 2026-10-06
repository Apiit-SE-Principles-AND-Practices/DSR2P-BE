import { z } from "zod";
import { spiceEnum } from "./restaurants.schemas";

export const NAME_MAX = 150;

export const restaurantItemParamsSchema = z.object({
  id: z.string().uuid("Invalid restaurant id"),
  itemId: z.coerce.number().int("Invalid menu item id").positive("Invalid menu item id"),
});

const name = z.string().trim().min(1, "Name is required").max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`);
// Mirrors the DB CHECK constraint (menu_items_price_lkr_check): price >= 0.
const priceLkr = z.coerce.number().min(0, "Price must be at least 0");
// z.coerce.boolean() would turn the string "false" into true; multipart fields
// arrive as strings, so compare explicitly instead.
const bool = z.union([z.boolean(), z.enum(["true", "false"])]).transform((v) => v === true || v === "true");
const categoryId = z.coerce.number().int().positive();

// [DSR2P]-30 — POST /admin/restaurants/:id/menu-items (multipart: fields + optional image)
export const createMenuItemSchema = z.object({
  name,
  priceLkr,
  categoryId,
  isVegetarian: bool.optional().default(false),
  isVegan: bool.optional().default(false),
  isHalal: bool.optional().default(false),
  spiceLevel: spiceEnum.optional().default("None"),
});

// PUT /admin/restaurants/:id/menu-items/:itemId — partial, but must change something.
export const updateMenuItemSchema = z
  .object({
    name: name.optional(),
    priceLkr: priceLkr.optional(),
    categoryId: categoryId.optional(),
    isVegetarian: bool.optional(),
    isVegan: bool.optional(),
    isHalal: bool.optional(),
    spiceLevel: spiceEnum.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
