import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { toPublicUser } from "../auth/auth.service";

export const usersRouter = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  language: z.enum(["en", "si", "ta"]).optional(),
});

// [DSR2P]-6-BE1 — PATCH /users/me — updateProfile(name, language)
usersRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: input,
      include: { role: true },
    });
    res.status(200).json(toPublicUser(user));
  })
);
