import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { loginSchema, registerSchema } from "./auth.schemas";
import { loginUser, registerUser } from "./auth.service";

export const authRouter = Router();

// [DSR2P]-4-BE1 / [DSR2P]-4-BE2
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  })
);

// [DSR2P]-5-BE1
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.status(200).json(result);
  })
);
