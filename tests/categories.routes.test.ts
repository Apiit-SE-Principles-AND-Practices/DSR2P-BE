import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  category: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });
const category = { id: 1, name: "Breakfast" };
const notFoundError = new Prisma.PrismaClientKnownRequestError("Record not found", {
  code: "P2025",
  clientVersion: Prisma.prismaVersion.client,
});

describe("GET /categories", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("returns every category, alphabetical, no auth required", async () => {
    prismaMock.category.findMany.mockResolvedValue([category]);

    const res = await request(app).get("/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([category]);
    expect(prismaMock.category.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });
});

describe("POST /admin/categories", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).post("/admin/categories").send({ name: "Breakfast" });

    expect(res.status).toBe(401);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .post("/admin/categories")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Breakfast" });

    expect(res.status).toBe(403);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("creates the category for an Admin", async () => {
    prismaMock.category.create.mockResolvedValue(category);

    const res = await request(app)
      .post("/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Breakfast" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(category);
    expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: "Breakfast" } });
  });

  it("returns 400 for a blank name", async () => {
    const res = await request(app)
      .post("/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "  " });

    expect(res.status).toBe(400);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate name", async () => {
    prismaMock.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
      })
    );

    const res = await request(app)
      .post("/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Breakfast" });

    expect(res.status).toBe(409);
  });
});

describe("PUT /admin/categories/:id", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("blocks a Customer", async () => {
    const res = await request(app)
      .put("/admin/categories/1")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: "Brunch" });

    expect(res.status).toBe(403);
    expect(prismaMock.category.update).not.toHaveBeenCalled();
  });

  it("renames the category for an Admin", async () => {
    prismaMock.category.update.mockResolvedValue({ id: 1, name: "Brunch" });

    const res = await request(app)
      .put("/admin/categories/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Brunch" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Brunch");
    expect(prismaMock.category.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: "Brunch" } });
  });

  it("returns 404 for a category that doesn't exist", async () => {
    prismaMock.category.update.mockRejectedValue(notFoundError);

    const res = await request(app)
      .put("/admin/categories/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Brunch" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id, not 500", async () => {
    const res = await request(app)
      .put("/admin/categories/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Brunch" });

    expect(res.status).toBe(400);
    expect(prismaMock.category.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/categories/:id", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("blocks a Customer", async () => {
    const res = await request(app).delete("/admin/categories/1").set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(prismaMock.category.delete).not.toHaveBeenCalled();
  });

  it("deletes for an Admin", async () => {
    const res = await request(app).delete("/admin/categories/1").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns 404 for a category that doesn't exist", async () => {
    prismaMock.category.delete.mockRejectedValue(notFoundError);

    const res = await request(app).delete("/admin/categories/1").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
