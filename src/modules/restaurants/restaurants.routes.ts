import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { uploadImage as uploadImageMiddleware } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { uploadImage } from "../../lib/imageUpload";
import {
  calculateAveragePricesFor,
  calculateAverageRatingsFor,
  priceRangeForBand,
  withRatingAndPriceBand,
} from "../../lib/ratings";
import {
  createRestaurantSchema,
  idParamSchema,
  listReviewsQuerySchema,
  listRestaurantsQuerySchema,
  searchRestaurantsQuerySchema,
  updateRestaurantSchema,
} from "./restaurants.schemas";
import { createMenuItemSchema, restaurantItemParamsSchema, updateMenuItemSchema } from "./menu-items.schemas";
import type { Prisma } from "@prisma/client";

// Public reads, mounted at /restaurants.
export const restaurantsRouter = Router();

const withCategories = { categories: { include: { category: true } } } as const;

// RestaurantCategory join rows -> a flat Category[], the shape callers actually want.
function flattenCategories<T extends { categories: { category: unknown }[] }>(restaurant: T) {
  const { categories, ...rest } = restaurant;
  return { ...rest, categories: categories.map((c) => c.category) };
}

// [DSR2P]-9 — GET /restaurants?city=&page=&pageSize= — newest first, optionally scoped to a city
restaurantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { city, page, pageSize } = listRestaurantsQuerySchema.parse(req.query);
    const where = city ? { city } : undefined;
    const [total, rows] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withCategories,
      }),
    ]);
    const data = rows.map(flattenCategories);
    res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  })
);

// [DSR2P]-11 — GET /restaurants/search?categoryId=&itemCategoryId=&diet=&spice=&price=&city=&page=&pageSize=
restaurantsRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { city, categoryId, itemCategoryId, diet, spice, price, sort, page, pageSize } =
      searchRestaurantsQuerySchema.parse(req.query);
    const menuItemFilter: Prisma.MenuItemWhereInput = {
      ...(itemCategoryId && { categoryId: itemCategoryId }),
      ...(diet === "Vegetarian" && { isVegetarian: true }),
      ...(diet === "Vegan" && { isVegan: true }),
      ...(diet === "Halal" && { isHalal: true }),
      ...(spice && { spiceLevel: spice }),
      ...(price && { priceLkr: priceRangeForBand(price) }),
    };
    const where: Prisma.RestaurantWhereInput = {
      ...(city && { city }),
      ...(categoryId && { categories: { some: { categoryId } } }),
      ...(Object.keys(menuItemFilter).length > 0 && { menuItems: { some: menuItemFilter } }),
    };

    if (!sort) {
      const [total, rows] = await Promise.all([
        prisma.restaurant.count({ where }),
        prisma.restaurant.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: withCategories,
        }),
      ]);
      const data = await withRatingAndPriceBand(prisma, rows.map(flattenCategories));
      res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
      return;
    }

    // Rating/price are computed, not stored, so sorting by them means pulling every
    // match, ranking in memory, then paginating — fine at this dataset's scale.
    const all = await prisma.restaurant.findMany({ where, include: withCategories });
    const ids = all.map((r) => r.id);
    const sortValues =
      sort === "rating" ? await calculateAverageRatingsFor(prisma, ids) : await calculateAveragePricesFor(prisma, ids);
    const direction = sort === "rating" ? -1 : 1; // best-rated first; cheapest first
    all.sort((a, b) => {
      const av = sortValues.get(a.id);
      const bv = sortValues.get(b.id);
      if (av === undefined || bv === undefined) return av === bv ? 0 : av === undefined ? 1 : -1;
      return (av - bv) * direction;
    });
    const total = all.length;
    const rows = all.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    const data = await withRatingAndPriceBand(prisma, rows.map(flattenCategories));
    res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  })
);

// GET /restaurants/:id
restaurantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const restaurant = await prisma.restaurant.findUnique({ where: { id }, include: withCategories });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");
    const [data] = await withRatingAndPriceBand(prisma, [flattenCategories(restaurant)]);
    res.status(200).json(data);
  })
);

// [DSR2P]-15 — GET /restaurants/:id/menu
restaurantsRouter.get(
  "/:id/menu",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");
    const menu = await prisma.menuItem.findMany({ where: { restaurantId: id }, orderBy: { name: "asc" } });
    res.status(200).json(menu);
  })
);

// [DSR2P]-16 — GET /restaurants/:id/reviews?status=&sort= with nested comments/response.
// [DSR2P]-33 audit — this route is public (no requireAuth), so only an Admin may ask for
// a status other than Approved; anyone else's status= is ignored, never trusted from the client.
// No review_likes table yet (schema.prisma is introspected from the live DB and doesn't
// have one), so likes aren't nested here — add once that table exists.
restaurantsRouter.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { status, sort } = listReviewsQuerySchema.parse(req.query);
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");
    const effectiveStatus = req.user?.role === "Admin" ? status : "Approved";
    const reviews = await prisma.review.findMany({
      where: { restaurantId: id, status: effectiveStatus },
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      include: { comments: true, response: true },
    });
    res.status(200).json(reviews);
  })
);

// Admin-only writes, mounted at /admin/restaurants.
export const adminRestaurantsRouter = Router();
adminRestaurantsRouter.use(requireAdmin);

// [DSR2P]-29-BE1 — POST /admin/restaurants
adminRestaurantsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { categoryIds, ...input } = createRestaurantSchema.parse(req.body);
    const restaurant = await prisma.restaurant.create({
      data: { ...input, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
      include: withCategories,
    });
    res.status(201).json(flattenCategories(restaurant));
  })
);

// PUT /admin/restaurants/:id — categoryIds, when given, replaces the full set.
adminRestaurantsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { categoryIds, ...input } = updateRestaurantSchema.parse(req.body);
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...input,
        ...(categoryIds && {
          categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
        }),
      },
      include: withCategories,
    });
    res.status(200).json(flattenCategories(restaurant));
  })
);

// DELETE /admin/restaurants/:id — cascades to its menu items and reviews (schema onDelete: Cascade)
adminRestaurantsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await prisma.restaurant.delete({ where: { id } });
    res.status(204).send();
  })
);

async function requireRestaurant(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw ApiError.notFound("Restaurant not found");
}

// MenuItem's only unique key is its own id, so "scoped to this restaurant" needs an
// existence check before update/delete, not a compound where clause.
async function requireMenuItem(restaurantId: string, itemId: number) {
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) throw ApiError.notFound("Menu item not found");
}

// [DSR2P]-30 — POST /admin/restaurants/:id/menu-items (multipart: fields + optional "image" file)
adminRestaurantsRouter.post(
  "/:id/menu-items",
  uploadImageMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = createMenuItemSchema.parse(req.body);
    await requireRestaurant(id);

    const imageUrl = req.file ? await uploadImage(req.file.buffer) : undefined;
    const item = await prisma.menuItem.create({ data: { ...input, restaurantId: id, imageUrl } });
    res.status(201).json(item);
  })
);

// PUT /admin/restaurants/:id/menu-items/:itemId
adminRestaurantsRouter.put(
  "/:id/menu-items/:itemId",
  uploadImageMiddleware,
  asyncHandler(async (req, res) => {
    const { id, itemId } = restaurantItemParamsSchema.parse(req.params);
    const input = updateMenuItemSchema.parse(req.body);
    await requireMenuItem(id, itemId);

    const imageUrl = req.file ? await uploadImage(req.file.buffer) : undefined;
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { ...input, imageUrl },
    });
    res.status(200).json(item);
  })
);

// DELETE /admin/restaurants/:id/menu-items/:itemId
adminRestaurantsRouter.delete(
  "/:id/menu-items/:itemId",
  asyncHandler(async (req, res) => {
    const { id, itemId } = restaurantItemParamsSchema.parse(req.params);
    await requireMenuItem(id, itemId);
    await prisma.menuItem.delete({ where: { id: itemId } });
    res.status(204).send();
  })
);
