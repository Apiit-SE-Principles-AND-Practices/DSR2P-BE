import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn() },
  review: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const customerRole = { id: 1, name: "Customer", description: "" };
const userId = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const token = signToken({ sub: userId, role: "Customer" });

function storedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    name: "Nimal Perera",
    email: "nimal@example.com",
    role: customerRole,
    language: "en",
    ...overrides,
  };
}

describe("PATCH /users/me", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).patch("/users/me").send({ name: "New Name" });

    expect(res.status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid token the same way as no token", async () => {
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ name: "New Name" });

    expect(res.status).toBe(401);
  });

  it("updates the name and returns the public profile", async () => {
    prismaMock.user.update.mockResolvedValue(storedUser({ name: "New Name" }));

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: userId,
      name: "New Name",
      email: "nimal@example.com",
      role: "Customer",
      language: "en",
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "New Name", language: undefined },
      include: { role: true },
    });
  });

  it("updates only the language, leaving the name untouched", async () => {
    prismaMock.user.update.mockResolvedValue(storedUser({ language: "ta" }));

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ language: "ta" });

    expect(res.status).toBe(200);
    expect(res.body.language).toBe("ta");
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: undefined, language: "ta" },
      include: { role: true },
    });
  });

  it("updates the user identified by the token, regardless of any id in the body", async () => {
    prismaMock.user.update.mockResolvedValue(storedUser());

    await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name", id: "someone-elses-id" });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: userId } })
    );
  });

  it("never returns the password hash", async () => {
    prismaMock.user.update.mockResolvedValue({ ...storedUser(), passwordHash: "hashed" });

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("returns 400 and never touches the database for an empty body", async () => {
    const res = await request(app).patch("/users/me").set("Authorization", `Bearer ${token}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank name", async () => {
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.name[0]).toBe("Name cannot be blank");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400, not 500, for a name longer than the database column", async () => {
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "a".repeat(101) });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an unsupported language", async () => {
    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ language: "EN" });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 if the account behind the token no longer exists", async () => {
    prismaMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("An operation failed because it depends on one or more records that were required but not found.", {
        code: "P2025",
        clientVersion: Prisma.prismaVersion.client,
      })
    );

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /users/me/reviews", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).get("/users/me/reviews");

    expect(res.status).toBe(401);
    expect(prismaMock.review.findMany).not.toHaveBeenCalled();
  });

  it("returns the logged-in user's reviews, any status, newest first", async () => {
    const reviews = [{ id: 1, userId, status: "Rejected" }];
    prismaMock.review.findMany.mockResolvedValue(reviews);

    const res = await request(app).get("/users/me/reviews").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(reviews);
    expect(prismaMock.review.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { comments: true, response: true },
    });
  });
});

describe("GET /users/me/comments", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).get("/users/me/comments");

    expect(res.status).toBe(401);
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled();
  });

  it("returns the logged-in user's comments, any status, newest first", async () => {
    const comments = [{ id: 1, userId, status: "Pending" }];
    prismaMock.comment.findMany.mockResolvedValue(comments);

    const res = await request(app).get("/users/me/comments").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(comments);
    expect(prismaMock.comment.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  });
});
