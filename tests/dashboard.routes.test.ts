import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: { count: vi.fn() },
  user: { count: vi.fn() },
  review: { groupBy: vi.fn() },
  comment: { groupBy: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });

describe("GET /admin/dashboard/stats", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).get("/admin/dashboard/stats");

    expect(res.status).toBe(401);
    expect(prismaMock.restaurant.count).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app).get("/admin/dashboard/stats").set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(prismaMock.restaurant.count).not.toHaveBeenCalled();
  });

  it("returns counts broken down by moderation status for an Admin", async () => {
    prismaMock.restaurant.count.mockResolvedValue(12);
    prismaMock.user.count.mockResolvedValue(50);
    prismaMock.review.groupBy.mockResolvedValue([
      { status: "Approved", _count: { _all: 8 } },
      { status: "Pending", _count: { _all: 2 } },
    ]);
    prismaMock.comment.groupBy.mockResolvedValue([{ status: "Rejected", _count: { _all: 3 } }]);

    const res = await request(app).get("/admin/dashboard/stats").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      restaurants: 12,
      users: 50,
      reviews: { total: 10, pending: 2, approved: 8, rejected: 0 },
      comments: { total: 3, pending: 0, approved: 0, rejected: 3 },
    });
  });

  it("returns zeroed counts when there is no data", async () => {
    prismaMock.restaurant.count.mockResolvedValue(0);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.review.groupBy.mockResolvedValue([]);
    prismaMock.comment.groupBy.mockResolvedValue([]);

    const res = await request(app).get("/admin/dashboard/stats").set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.reviews).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
    expect(res.body.comments).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
  });
});
