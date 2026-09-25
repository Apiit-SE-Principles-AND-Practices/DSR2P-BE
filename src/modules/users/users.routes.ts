import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { toPublicUser } from "../auth/auth.service";
import { updateProfileSchema } from "./users.schemas";

export const usersRouter = Router();

// [DSR2P]-6-BE1 — PATCH /users/me — updateProfile(name, language)
usersRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { name: input.name, language: input.language },
      include: { role: true },
    });
    res.status(200).json(toPublicUser(user));
  })
);

// [DSR2P]-18 — GET /users/me/reviews — own reviews, every status, with rejectionReason.
usersRouter.get(
  "/me/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      include: { comments: true, response: true },
    });
    res.status(200).json(reviews);
  })
);

// [DSR2P]-18 — GET /users/me/comments — own comments, every status.
usersRouter.get(
  "/me/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const comments = await prisma.comment.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(comments);
  })
);
