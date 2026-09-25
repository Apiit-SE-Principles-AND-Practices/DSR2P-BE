import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: { findUnique: vi.fn() },
  menuItem: { findFirst: vi.fn() },
  review: { create: vi.fn(), findUnique: vi.fn() },
  comment: { create: vi.fn() },
  response: { create: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const restaurantId = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const userId = "a1b2c3d4-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const token = signToken({ sub: userId, role: "Customer" });
const adminToken = signToken({ sub: "admin-id", role: "Admin" });
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

describe("POST /reviews/:id/comments", () => {
  const app = createApp();
  const review = { id: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.review.findUnique.mockResolvedValue(review);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/reviews/1/comments").send({ commentText: "Agreed!" });

    expect(res.status).toBe(401);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it("comments as the logged-in user", async () => {
    prismaMock.comment.create.mockResolvedValue({
      id: 1,
      reviewId: 1,
      userId,
      commentText: "Agreed!",
      status: "Pending",
    });

    const res = await request(app)
      .post("/reviews/1/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ commentText: "Agreed!" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Pending");
    expect(prismaMock.comment.create).toHaveBeenCalledWith({
      data: { reviewId: 1, commentText: "Agreed!", userId },
    });
  });

  it("returns 404 for a review that doesn't exist", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/reviews/1/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ commentText: "Agreed!" });

    expect(res.status).toBe(404);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it("returns 400 for blank commentText", async () => {
    const res = await request(app)
      .post("/reviews/1/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ commentText: "  " });

    expect(res.status).toBe(400);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed review id, not 500", async () => {
    const res = await request(app)
      .post("/reviews/not-a-number/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ commentText: "Agreed!" });

    expect(res.status).toBe(400);
    expect(prismaMock.review.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /reviews/:id/response", () => {
  const app = createApp();
  const review = { id: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.review.findUnique.mockResolvedValue(review);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/reviews/1/response").send({ responseText: "Thanks!" });

    expect(res.status).toBe(401);
    expect(prismaMock.response.create).not.toHaveBeenCalled();
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .post("/reviews/1/response")
      .set("Authorization", `Bearer ${token}`)
      .send({ responseText: "Thanks!" });

    expect(res.status).toBe(403);
    expect(prismaMock.response.create).not.toHaveBeenCalled();
  });

  it("creates the response for an Admin", async () => {
    prismaMock.response.create.mockResolvedValue({ id: 1, reviewId: 1, responseText: "Thanks!" });

    const res = await request(app)
      .post("/reviews/1/response")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ responseText: "Thanks!" });

    expect(res.status).toBe(201);
    expect(prismaMock.response.create).toHaveBeenCalledWith({ data: { reviewId: 1, responseText: "Thanks!" } });
  });

  it("returns 409 when the review already has a response", async () => {
    prismaMock.response.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
      })
    );

    const res = await request(app)
      .post("/reviews/1/response")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ responseText: "Thanks!" });

    expect(res.status).toBe(409);
  });

  it("returns 404 for a review that doesn't exist", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/reviews/1/response")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ responseText: "Thanks!" });

    expect(res.status).toBe(404);
    expect(prismaMock.response.create).not.toHaveBeenCalled();
  });

  it("returns 400 for blank responseText", async () => {
    const res = await request(app)
      .post("/reviews/1/response")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ responseText: "  " });

    expect(res.status).toBe(400);
    expect(prismaMock.response.create).not.toHaveBeenCalled();
  });
});
