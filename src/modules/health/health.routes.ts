import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { prisma } from "../../lib/prisma";

export const healthRouter = Router();

// GET /health — returns 200 once DB connectivity is confirmed.
healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  })
);
