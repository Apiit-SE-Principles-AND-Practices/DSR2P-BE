import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { uploadImages } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { uploadImage } from "../../lib/imageUpload";
import {
  createCommentSchema,
  createResponseSchema,
  createReviewSchema,
  rejectReviewSchema,
  reviewIdParamSchema,
  updateReviewSchema,
} from "./reviews.schemas";

export const reviewsRouter = Router();

// Admin-only moderation, mounted at /admin/reviews.
export const adminReviewsRouter = Router();
adminReviewsRouter.use(requireAdmin);

// [DSR2P]-21 — resize/compress/upload each attached photo, in parallel.
async function uploadReviewImages(files: Express.Multer.File[] | undefined) {
  return Promise.all((files ?? []).map((file) => uploadImage(file.buffer)));
}

// [DSR2P]-17/21 — POST /reviews submit(), multipart with optional "images" files.
// Always starts Pending; moderation approves/rejects it.
reviewsRouter.post(
  "/",
  requireAuth,
  uploadImages,
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

    const imageUrls = await uploadReviewImages(req.files as Express.Multer.File[]);
    const review = await prisma.review.create({
      data: {
        ...input,
        userId: req.user!.sub,
        images: { create: imageUrls.map((imageUrl) => ({ imageUrl })) },
      },
      include: { images: true },
    });
    res.status(201).json(review);
  })
);

// [DSR2P]-21 — PUT /reviews/:id edit(), own review only. multipart with optional
// "images" files, appended to any already on the review. Re-submitting resets
// status to Pending for re-moderation.
reviewsRouter.put(
  "/:id",
  requireAuth,
  uploadImages,
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const input = updateReviewSchema.parse(req.body);

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ApiError.notFound("Review not found");
    if (review.userId !== req.user!.sub) throw ApiError.forbidden();

    const imageUrls = await uploadReviewImages(req.files as Express.Multer.File[]);
    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...input,
        status: "Pending",
        ...(imageUrls.length > 0 && { images: { create: imageUrls.map((imageUrl) => ({ imageUrl })) } }),
      },
      include: { images: true },
    });
    res.status(200).json(updated);
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

// [DSR2P]-20 — POST /reviews/:id/response (Admin-only). UNIQUE(review_id) on responses
// means a second response for the same review 409s via the Prisma P2002 handler.
reviewsRouter.post(
  "/:id/response",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const { responseText } = createResponseSchema.parse(req.body);

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ApiError.notFound("Review not found");

    const response = await prisma.response.create({ data: { reviewId: id, responseText } });
    res.status(201).json(response);
  })
);

// [DSR2P]-46 — POST /reviews/:id/report. Bumps reportCount so the review surfaces
// in the moderation queue even if already Approved.
reviewsRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const review = await prisma.review.update({
      where: { id },
      data: { reportCount: { increment: 1 } },
    });
    res.status(200).json(review);
  })
);

// [DSR2P]-33 — PATCH /admin/reviews/:id/approve
adminReviewsRouter.patch(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const review = await prisma.review.update({
      where: { id },
      data: { status: "Approved", rejectionReason: null },
    });
    res.status(200).json(review);
  })
);

// [DSR2P]-33 — PATCH /admin/reviews/:id/reject
adminReviewsRouter.patch(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const { id } = reviewIdParamSchema.parse(req.params);
    const { reason } = rejectReviewSchema.parse(req.body);
    const review = await prisma.review.update({
      where: { id },
      data: { status: "Rejected", rejectionReason: reason },
    });
    res.status(200).json(review);
  })
);
