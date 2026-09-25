import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { createCommentSchema, createReviewSchema, reviewIdParamSchema } from "./reviews.schemas";

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

// [DSR2P]-19 — POST /reviews/:id/comments. Always starts Pending; moderation approves/rejects it.
reviewsRouter.post(
  "/:id/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const { commentText } = createCommentSchema.parse(req.body);

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ApiError.notFound("Review not found");

    const comment = await prisma.comment.create({
      data: { reviewId: id, commentText, userId: req.user!.sub },
    });
    res.status(201).json(comment);
  })
);
