import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import {
  calculateAveragePricesFor,
  calculateAverageRatingsFor,
  priceRangeForBand,
  withRatingAndPriceBand,
} from "../../lib/ratings";
import {
  createRestaurantSchema,
  idParamSchema,
  listRestaurantsQuerySchema,
  searchRestaurantsQuerySchema,
  updateRestaurantSchema,
} from "./restaurants.schemas";
import type { Prisma } from "@prisma/client";

// Public reads, mounted at /restaurants.
export const restaurantsRouter = Router();

// [DSR2P]-9 — GET /restaurants?city=&page=&pageSize= — newest first, optionally scoped to a city
restaurantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { city, page, pageSize } = listRestaurantsQuerySchema.parse(req.query);
    const where = city ? { city } : undefined;
    const [total, data] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  })
);

// [DSR2P]-11 — GET /restaurants/search?category=&diet=&spice=&price=&city=&page=&pageSize=
restaurantsRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { city, category, diet, spice, price, sort, page, pageSize } = searchRestaurantsQuerySchema.parse(
      req.query
    );
    const menuItemFilter: Prisma.MenuItemWhereInput = {
      ...(diet === "Vegetarian" && { isVegetarian: true }),
      ...(diet === "Vegan" && { isVegan: true }),
      ...(diet === "Halal" && { isHalal: true }),
      ...(spice && { spiceLevel: spice }),
      ...(price && { priceLkr: priceRangeForBand(price) }),
    };
    const where: Prisma.RestaurantWhereInput = {
      ...(city && { city }),
      ...(category && { category }),
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
        }),
      ]);
      const data = await withRatingAndPriceBand(prisma, rows);
      res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
      return;
    }

    // Rating/price are computed, not stored, so sorting by them means pulling every
    // match, ranking in memory, then paginating — fine at this dataset's scale.
    const all = await prisma.restaurant.findMany({ where });
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
    const data = await withRatingAndPriceBand(prisma, rows);
    res.status(200).json({ data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  })
);

// GET /restaurants/:id
restaurantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");
    const [data] = await withRatingAndPriceBand(prisma, [restaurant]);
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

// Admin-only writes, mounted at /admin/restaurants.
export const adminRestaurantsRouter = Router();
adminRestaurantsRouter.use(requireAdmin);

// [DSR2P]-29-BE1 — POST /admin/restaurants
adminRestaurantsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createRestaurantSchema.parse(req.body);
    const restaurant = await prisma.restaurant.create({ data: input });
    res.status(201).json(restaurant);
  })
);

// PUT /admin/restaurants/:id
adminRestaurantsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateRestaurantSchema.parse(req.body);
    const restaurant = await prisma.restaurant.update({ where: { id }, data: input });
    res.status(200).json(restaurant);
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
