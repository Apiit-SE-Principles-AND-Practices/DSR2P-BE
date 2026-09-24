import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import {
  createRestaurantSchema,
  idParamSchema,
  listRestaurantsQuerySchema,
  updateRestaurantSchema,
} from "./restaurants.schemas";

// Public reads, mounted at /restaurants.
export const restaurantsRouter = Router();

// [DSR2P]-9 — GET /restaurants?city= — newest first, optionally scoped to a city
restaurantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { city } = listRestaurantsQuerySchema.parse(req.query);
    const restaurants = await prisma.restaurant.findMany({
      where: city ? { city } : undefined,
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(restaurants);
  })
);

// GET /restaurants/:id
restaurantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");
    res.status(200).json(restaurant);
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
