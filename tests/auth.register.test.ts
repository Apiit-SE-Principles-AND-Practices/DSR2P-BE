import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), create: vi.fn() },
  role: { findUnique: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { createApp } from "../src/app";

const customerRole = { id: 1, name: "Customer", description: "" };
const body = { name: "Nimal Perera", email: "nimal@example.com", password: "Password123" };

describe("POST /auth/register", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findUnique.mockResolvedValue(customerRole);
    // Echo back what the service asked to insert, as the database would.
    prismaMock.user.create.mockImplementation(async ({ data }) => ({
      id: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
      createdAt: new Date(),
      role: customerRole,
      ...data,
    }));
  });

  it("returns 201 with a token and the public user", async () => {
    const res = await request(app).post("/auth/register").send({ ...body, language: "ta" });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toEqual({
      id: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
      name: "Nimal Perera",
      email: "nimal@example.com",
      role: "Customer",
      language: "ta",
    });
  });

  it("stores a real bcrypt hash and never returns it", async () => {
    const res = await request(app).post("/auth/register").send(body);

    const { passwordHash } = prismaMock.user.create.mock.calls[0][0].data;
    expect(passwordHash).not.toBe(body.password);
    expect(await bcrypt.compare(body.password, passwordHash)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("normalises the email before checking and saving it", async () => {
    await request(app).post("/auth/register").send({ ...body, email: "  Nimal@Example.COM " });

    expect(prismaMock.user.findFirst.mock.calls[0][0].where.email.equals).toBe("nimal@example.com");
    expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe("nimal@example.com");
  });

  it("always registers a Customer, even if the body asks for Admin", async () => {
    const res = await request(app).post("/auth/register").send({ ...body, role: "Admin", roleId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Customer");
    expect(prismaMock.user.create.mock.calls[0][0].data.roleId).toBe(1);
  });

  it("returns 409 for an email that's already registered, and saves nothing", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "existing", email: "nimal@example.com" });

    const res = await request(app).post("/auth/register").send(body);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "CONFLICT", message: "An account with this email already exists" },
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 with field-level errors, and never touches the database", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors).toMatchObject({
      name: ["Name is required"],
      email: ["Invalid email address"],
      password: expect.arrayContaining(["Password must be at least 8 characters"]),
    });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank password", async () => {
    const res = await request(app).post("/auth/register").send({ ...body, password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.password[0]).toBe("Password is required");
  });

  it("returns 400, not 500, for a name longer than the database column", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...body, name: "a".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.name).toEqual(["Name must be at most 100 characters"]);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't an object", async () => {
    const res = await request(app).post("/auth/register").send([]);

    expect(res.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
