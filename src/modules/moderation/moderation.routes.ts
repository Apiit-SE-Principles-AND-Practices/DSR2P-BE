import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

export const moderationRouter = Router();
moderationRouter.use(requireAdmin);

// [DSR2P]-32/46 — GET /admin/moderation/queue — every Pending review/comment, oldest
// first, plus any already-Approved one that's been reported (reportCount > 0).
const needsModeration = { OR: [{ status: "Pending" as const }, { reportCount: { gt: 0 } }] };

moderationRouter.get(
  "/queue",
  asyncHandler(async (_req, res) => {
    const [reviews, comments] = await Promise.all([
      prisma.review.findMany({
        where: needsModeration,
        orderBy: { createdAt: "asc" },
        include: { comments: true, response: true, images: true },
      }),
      prisma.comment.findMany({ where: needsModeration, orderBy: { createdAt: "asc" } }),
    ]);
    res.status(200).json({ reviews, comments });
  })
);
