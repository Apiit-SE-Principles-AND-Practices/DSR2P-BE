import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { JwtRole, signToken } from "../../lib/jwt";
import { ApiError } from "../../lib/apiError";
import { LoginInput, RegisterInput } from "./auth.schemas";

const SALT_ROUNDS = 12;
const DEFAULT_ROLE: JwtRole = "Customer";

// [DSR2P]-4-BE1 — validate, hash password, insert with role = Customer.
export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // [DSR2P]-4-BE2 — clear 409 on duplicate email, never a generic 500.
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      language: input.language ?? "en",
      role: { connect: { name: DEFAULT_ROLE } },
    },
    include: { role: true },
  });

  const token = signToken({ sub: user.id, role: user.role.name as JwtRole });
  return { token, user: toPublicUser(user) };
}

// [DSR2P]-5-BE1 — generic auth error on failure, no user-enumeration.
export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = signToken({ sub: user.id, role: user.role.name as JwtRole });
  return { token, user: toPublicUser(user) };
}

// Password hash is never returned by any endpoint (NFR-06).
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: { name: string };
  language: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    language: user.language,
  };
}
