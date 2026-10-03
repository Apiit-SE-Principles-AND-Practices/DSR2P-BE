import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { commentIdParamSchema, rejectCommentSchema } from "./comments.schemas";

// Logged-in user actions, mounted at /comments.
export const commentsRouter = Router();

// [DSR2P]-46 — POST /comments/:id/report. Bumps reportCount so the comment
// surfaces in the moderation queue even if already Approved.
commentsRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = commentIdParamSchema.parse(req.params);
    const comment = await prisma.comment.update({
      where: { id },
      data: { reportCount: { increment: 1 } },
    });
    res.status(200).json(comment);
  })
);

// Admin-only moderation, mounted at /admin/comments.
export const adminCommentsRouter = Router();
adminCommentsRouter.use(requireAdmin);

// [DSR2P]-34 — PATCH /admin/comments/:id/approve
adminCommentsRouter.patch(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const { id } = commentIdParamSchema.parse(req.params);
    const comment = await prisma.comment.update({
      where: { id },
      data: { status: "Approved", rejectionReason: null },
    });
    res.status(200).json(comment);
  })
);

// [DSR2P]-34 — PATCH /admin/comments/:id/reject
adminCommentsRouter.patch(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const { id } = commentIdParamSchema.parse(req.params);
    const { reason } = rejectCommentSchema.parse(req.body);
    const comment = await prisma.comment.update({
      where: { id },
      data: { status: "Rejected", rejectionReason: reason },
    });
    res.status(200).json(comment);
  })
);
