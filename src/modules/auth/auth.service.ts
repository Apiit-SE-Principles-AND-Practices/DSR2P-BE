import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { JwtRole, signToken } from "../../lib/jwt";
import { ApiError } from "../../lib/apiError";
import { LoginInput, RegisterInput } from "./auth.schemas";

const SALT_ROUNDS = 12;
const DEFAULT_ROLE: JwtRole = "Customer";

const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists";

// Emails are compared case-insensitively so accounts created before emails were
// lowercased on registration still match.
function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { role: true },
  });
}

// [DSR2P]-4-BE1 — validate, hash password, insert with role = Customer.
// Input has already passed registerSchema (validation happens before anything is saved).
export async function registerUser(input: RegisterInput) {
  if (await findUserByEmail(input.email)) {
    // [DSR2P]-4-BE2 — clear 409 on duplicate email, never a generic 500.
    throw ApiError.conflict(DUPLICATE_EMAIL_MESSAGE);
  }

  const role = await prisma.role.findUnique({ where: { name: DEFAULT_ROLE } });
  if (!role) {
    throw ApiError.internal(`Role "${DEFAULT_ROLE}" is missing from the roles table`);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        language: input.language ?? "en",
        roleId: role.id,
      },
      include: { role: true },
    });
  } catch (err) {
    // Two concurrent registrations for the same email: the unique index rejects
    // the second one after the check above passed for both.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict(DUPLICATE_EMAIL_MESSAGE);
    }
    throw err;
  }

  const token = signToken({ sub: user.id, role: user.role.name as JwtRole });
  return { token, user: toPublicUser(user) };
}

// [DSR2P]-5-BE1 — generic auth error on failure, no user-enumeration.
export async function loginUser(input: LoginInput) {
  const user = await findUserByEmail(input.email);
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
