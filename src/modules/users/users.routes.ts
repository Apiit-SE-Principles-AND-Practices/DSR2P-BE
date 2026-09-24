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
