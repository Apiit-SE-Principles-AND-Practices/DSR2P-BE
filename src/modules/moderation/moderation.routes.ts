import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

export const moderationRouter = Router();
moderationRouter.use(requireAdmin);

// [DSR2P]-32 — GET /admin/moderation/queue — every Pending review and comment, oldest first.
moderationRouter.get(
  "/queue",
  asyncHandler(async (_req, res) => {
    const [reviews, comments] = await Promise.all([
      prisma.review.findMany({
        where: { status: "Pending" },
        orderBy: { createdAt: "asc" },
        include: { comments: true, response: true, images: true },
      }),
      prisma.comment.findMany({ where: { status: "Pending" }, orderBy: { createdAt: "asc" } }),
    ]);
    res.status(200).json({ reviews, comments });
  })
);
