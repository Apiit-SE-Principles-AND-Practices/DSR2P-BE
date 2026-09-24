import jwt from "jsonwebtoken";

// Matches roles.name in the database.
export type JwtRole = "Customer" | "Admin";

export interface JwtPayload {
  sub: string; // user id
  role: JwtRole;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";

export function signToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
