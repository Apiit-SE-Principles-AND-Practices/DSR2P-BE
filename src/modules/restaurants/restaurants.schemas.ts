import { z } from "zod";

// Column limits from the restaurants table.
export const NAME_MAX = 150;
export const CATEGORY_MAX = 50;
export const ADDRESS_MAX = 255;
export const IMAGE_URL_MAX = 255;

const cityEnum = z.enum(["Colombo", "Kandy", "Galle"]);

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid restaurant id"),
});

const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`);
const category = z
  .string()
  .trim()
  .min(1, "Category is required")
  .max(CATEGORY_MAX, `Category must be at most ${CATEGORY_MAX} characters`);
const address = z
  .string()
  .trim()
  .min(1, "Address is required")
  .max(ADDRESS_MAX, `Address must be at most ${ADDRESS_MAX} characters`);
const imageUrl = z
  .string()
  .trim()
  .url("Invalid image URL")
  .max(IMAGE_URL_MAX, `Image URL must be at most ${IMAGE_URL_MAX} characters`)
  .optional();

// [DSR2P]-29-BE1 — POST /admin/restaurants
export const createRestaurantSchema = z.object({ name, city: cityEnum, category, address, imageUrl });

// PUT /admin/restaurants/:id — partial, but must change something.
export const updateRestaurantSchema = z
  .object({
    name: name.optional(),
    city: cityEnum.optional(),
    category: category.optional(),
    address: address.optional(),
    imageUrl,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_MAX = 100;

// GET /restaurants?city=&page=&pageSize=
export const listRestaurantsQuerySchema = z.object({
  city: cityEnum.optional(),
  page: z.coerce.number().int("page must be a whole number").min(1, "page must be at least 1").default(1),
  pageSize: z.coerce
    .number()
    .int("pageSize must be a whole number")
    .min(1, "pageSize must be at least 1")
    .max(PAGE_SIZE_MAX, `pageSize must be at most ${PAGE_SIZE_MAX}`)
    .default(DEFAULT_PAGE_SIZE),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
