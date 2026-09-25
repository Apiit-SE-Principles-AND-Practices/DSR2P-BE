import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { createReviewSchema } from "./reviews.schemas";

export const reviewsRouter = Router();

// [DSR2P]-17 — POST /reviews submit(). Always starts Pending; moderation approves/rejects it.
reviewsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createReviewSchema.parse(req.body);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: input.restaurantId } });
    if (!restaurant) throw ApiError.notFound("Restaurant not found");

    if (input.itemId !== undefined) {
      const item = await prisma.menuItem.findFirst({
        where: { id: input.itemId, restaurantId: input.restaurantId },
      });
      if (!item) throw ApiError.badRequest("itemId does not belong to this restaurant");
    }

    const review = await prisma.review.create({
      data: { ...input, userId: req.user!.sub },
    });
    res.status(201).json(review);
  })
);
