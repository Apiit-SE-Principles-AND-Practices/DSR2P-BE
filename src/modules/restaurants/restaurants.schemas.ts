import { z } from "zod";

// Column limits from the restaurants table.
export const NAME_MAX = 150;
export const ADDRESS_MAX = 255;
export const IMAGE_URL_MAX = 255;

const cityEnum = z.enum(["Colombo", "Kandy", "Galle"]);
const dietEnum = z.enum(["Vegetarian", "Vegan", "Halal"]);
export const spiceEnum = z.enum(["None", "Mild", "Medium", "Hot", "Extra_Hot"]);
const priceBandEnum = z.enum(["Budget", "Moderate", "Premium"]);
const sortEnum = z.enum(["rating", "price"]);
const moderationStatusEnum = z.enum(["Approved", "Rejected", "Pending"]);
const reviewSortEnum = z.enum(["newest", "oldest"]);

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid restaurant id"),
});

const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`);
const categoryIds = z
  .array(z.coerce.number().int().positive())
  .min(1, "At least one category is required");
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
export const createRestaurantSchema = z.object({ name, city: cityEnum, categoryIds, address, imageUrl });

// PUT /admin/restaurants/:id — partial, but must change something. categoryIds,
// when given, replaces the full set rather than merging with the existing one.
export const updateRestaurantSchema = z
  .object({
    name: name.optional(),
    city: cityEnum.optional(),
    categoryIds: categoryIds.optional(),
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

// [DSR2P]-11 — GET /restaurants/search?categoryId=&itemCategoryId=&diet=&spice=&price=&city=&page=&pageSize=
export const searchRestaurantsQuerySchema = z.object({
  city: cityEnum.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  itemCategoryId: z.coerce.number().int().positive().optional(),
  diet: dietEnum.optional(),
  spice: spiceEnum.optional(),
  price: priceBandEnum.optional(),
  sort: sortEnum.optional(),
  page: listRestaurantsQuerySchema.shape.page,
  pageSize: listRestaurantsQuerySchema.shape.pageSize,
});

// [DSR2P]-16 — GET /restaurants/:id/reviews?status=&sort= — defaults to Approved, newest first
export const listReviewsQuerySchema = z.object({
  status: moderationStatusEnum.default("Approved"),
  sort: reviewSortEnum.default("newest"),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
export type SearchRestaurantsQuery = z.infer<typeof searchRestaurantsQuerySchema>;
