import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  comment: { update: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });

describe("PATCH /admin/comments/:id/approve", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).patch("/admin/comments/1/approve");

    expect(res.status).toBe(401);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app).patch("/admin/comments/1/approve").set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("approves for an Admin, clearing any rejectionReason", async () => {
    prismaMock.comment.update.mockResolvedValue({ id: 1, status: "Approved", rejectionReason: null });

    const res = await request(app).patch("/admin/comments/1/approve").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Approved");
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "Approved", rejectionReason: null },
    });
  });

  it("returns 404 for a comment that doesn't exist", async () => {
    prismaMock.comment.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: Prisma.prismaVersion.client,
      })
    );

    const res = await request(app).patch("/admin/comments/1/approve").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id, not 500", async () => {
    const res = await request(app).patch("/admin/comments/not-a-number/approve").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /admin/comments/:id/reject", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).patch("/admin/comments/1/reject").send({ reason: "Off-topic" });

    expect(res.status).toBe(401);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .patch("/admin/comments/1/reject")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Off-topic" });

    expect(res.status).toBe(403);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("rejects for an Admin, storing the reason", async () => {
    prismaMock.comment.update.mockResolvedValue({ id: 1, status: "Rejected", rejectionReason: "Off-topic" });

    const res = await request(app)
      .patch("/admin/comments/1/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Off-topic" });

    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Off-topic");
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "Rejected", rejectionReason: "Off-topic" },
    });
  });

  it("returns 400 for a blank reason", async () => {
    const res = await request(app)
      .patch("/admin/comments/1/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "   " });

    expect(res.status).toBe(400);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("returns 404 for a comment that doesn't exist", async () => {
    prismaMock.comment.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: Prisma.prismaVersion.client,
      })
    );

    const res = await request(app)
      .patch("/admin/comments/1/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Off-topic" });

    expect(res.status).toBe(404);
  });
});
