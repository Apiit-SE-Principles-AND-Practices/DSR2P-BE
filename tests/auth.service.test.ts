import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/apiError";
import { verifyToken } from "../src/lib/jwt";

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), create: vi.fn() },
  role: { findUnique: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hashed-password"), compare: vi.fn() },
}));

import { registerUser } from "../src/modules/auth/auth.service";

const customerRole = { id: 1, name: "Customer", description: "" };
const input = { name: "Nimal Perera", email: "nimal@example.com", password: "Password123" };

function createdUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
    name: input.name,
    email: input.email,
    passwordHash: "hashed-password",
    roleId: customerRole.id,
    role: customerRole,
    language: "en",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findUnique.mockResolvedValue(customerRole);
    prismaMock.user.create.mockResolvedValue(createdUser());
  });

  it("creates the user as a Customer with a hashed password", async () => {
    await registerUser(input);

    expect(bcrypt.hash).toHaveBeenCalledWith("Password123", 12);
    expect(prismaMock.role.findUnique).toHaveBeenCalledWith({ where: { name: "Customer" } });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: "Nimal Perera",
        email: "nimal@example.com",
        passwordHash: "hashed-password",
        language: "en",
        roleId: 1,
      },
      include: { role: true },
    });
  });

  it("never stores the plaintext password", async () => {
    await registerUser(input);

    const { data } = prismaMock.user.create.mock.calls[0][0];
    expect(data).not.toHaveProperty("password");
    expect(data.passwordHash).not.toBe(input.password);
  });

  it("stores the chosen language", async () => {
    await registerUser({ ...input, language: "si" });

    expect(prismaMock.user.create.mock.calls[0][0].data.language).toBe("si");
  });

  it("returns a token for the new Customer and the user without the password hash", async () => {
    const result = await registerUser(input);

    expect(result.user).toEqual({
      id: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
      name: "Nimal Perera",
      email: "nimal@example.com",
      role: "Customer",
      language: "en",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(verifyToken(result.token)).toMatchObject({
      sub: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
      role: "Customer",
    });
  });

  it("checks for an existing email case-insensitively", async () => {
    await registerUser(input);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "nimal@example.com", mode: "insensitive" } },
      include: { role: true },
    });
  });

  it("rejects a duplicate email with 409 before hashing or saving", async () => {
    prismaMock.user.findFirst.mockResolvedValue(createdUser({ email: "Nimal@Example.com" }));

    const error = await registerUser(input).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "An account with this email already exists",
    });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("turns a unique-index violation from a concurrent registration into the same 409", async () => {
    prismaMock.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
        meta: { target: ["email"] },
      })
    );

    await expect(registerUser(input)).rejects.toMatchObject({
      status: 409,
      message: "An account with this email already exists",
    });
  });

  it("passes other database errors through unchanged", async () => {
    const dbError = new Error("connection lost");
    prismaMock.user.create.mockRejectedValue(dbError);

    await expect(registerUser(input)).rejects.toBe(dbError);
  });

  it("fails with a 500 and saves nothing if the Customer role is missing", async () => {
    prismaMock.role.findUnique.mockResolvedValue(null);

    await expect(registerUser(input)).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
