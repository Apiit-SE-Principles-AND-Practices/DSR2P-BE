import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAdmin);

type StatusGroup = { status: string; _count: { _all: number } };

function statusCounts(groups: StatusGroup[]) {
  const byStatus = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  return {
    total: groups.reduce((sum, g) => sum + g._count._all, 0),
    pending: byStatus("Pending"),
    approved: byStatus("Approved"),
    rejected: byStatus("Rejected"),
  };
}

// [DSR2P]-35 — GET /admin/dashboard/stats
adminDashboardRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [restaurants, users, reviewGroups, commentGroups] = await Promise.all([
      prisma.restaurant.count(),
      prisma.user.count(),
      prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.comment.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    res.status(200).json({
      restaurants,
      users,
      reviews: statusCounts(reviewGroups),
      comments: statusCounts(commentGroups),
    });
  })
);
