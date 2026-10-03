import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  review: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });

describe("GET /admin/moderation/queue", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).get("/admin/moderation/queue");

    expect(res.status).toBe(401);
    expect(prismaMock.review.findMany).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .get("/admin/moderation/queue")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(prismaMock.review.findMany).not.toHaveBeenCalled();
  });

  it("returns Pending-or-reported reviews and comments, oldest first, for an Admin", async () => {
    const reviews = [{ id: 1, status: "Pending" }];
    const comments = [{ id: 2, status: "Approved", reportCount: 3 }];
    prismaMock.review.findMany.mockResolvedValue(reviews);
    prismaMock.comment.findMany.mockResolvedValue(comments);

    const res = await request(app)
      .get("/admin/moderation/queue")
      .set("Authorization", `Bearer ${adminToken}`);

    const expectedWhere = { OR: [{ status: "Pending" }, { reportCount: { gt: 0 } }] };
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reviews, comments });
    expect(prismaMock.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere, orderBy: { createdAt: "asc" } })
    );
    expect(prismaMock.comment.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: { createdAt: "asc" },
    });
  });
});
