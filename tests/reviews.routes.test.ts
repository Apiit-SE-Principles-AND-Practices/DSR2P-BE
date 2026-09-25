import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: { findUnique: vi.fn() },
  menuItem: { findFirst: vi.fn() },
  review: { create: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const restaurantId = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const userId = "a1b2c3d4-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const token = signToken({ sub: userId, role: "Customer" });
const restaurant = { id: restaurantId };
const body = {
  restaurantId,
  foodQualityRating: 5,
  serviceRating: 4,
  miscRating: 3,
  reviewText: "Great food, quick service.",
};

describe("POST /reviews", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.findUnique.mockResolvedValue(restaurant);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/reviews").send(body);

    expect(res.status).toBe(401);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("submits the review as the logged-in user", async () => {
    prismaMock.review.create.mockResolvedValue({ id: 1, ...body, userId, status: "Pending" });

    const res = await request(app).post("/reviews").set("Authorization", `Bearer ${token}`).send(body);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Pending");
    expect(prismaMock.review.create).toHaveBeenCalledWith({ data: { ...body, userId } });
  });

  it("returns 404 for a restaurant that doesn't exist", async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/reviews").set("Authorization", `Bearer ${token}`).send(body);

    expect(res.status).toBe(404);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("returns 400 when itemId doesn't belong to that restaurant", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, itemId: 99 });

    expect(res.status).toBe(400);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it.each([0, 6])("returns 400 for a rating of %i (outside 1-5)", async (rating) => {
    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, foodQualityRating: rating });

    expect(res.status).toBe(400);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing reviewText", async () => {
    const { reviewText, ...rest } = body;

    const res = await request(app).post("/reviews").set("Authorization", `Bearer ${token}`).send(rest);

    expect(res.status).toBe(400);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });
});
