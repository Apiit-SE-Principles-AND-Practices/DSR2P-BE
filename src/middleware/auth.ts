import { NextFunction, Request, Response } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";
import { ApiError } from "../lib/apiError";

// Extends Express's Request with the three auth states this API distinguishes:
// anonymous (Guest, req.user undefined), Customer, Admin.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Populates req.user from a Bearer token if present, but never blocks the
// request — routes that are open to Guests still run.
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    try {
      req.user = verifyToken(token);
    } catch {
      // invalid/expired token: treat as anonymous rather than erroring here
    }
  }
  next();
}

// [DSR2P]-7-BE1 — blocks Guests from login-required actions on the server,
// not just in the UI.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(ApiError.unauthorized("Log in to continue"));
  }
  next();
}

// [DSR2P]-7-BE2 — Admin-only routes (restaurant/menu management, moderation, responses).
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(ApiError.unauthorized("Log in to continue"));
  }
  if (req.user.role !== "Admin") {
    return next(ApiError.forbidden());
  }
  next();
}
