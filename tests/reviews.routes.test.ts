import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: { findUnique: vi.fn() },
  menuItem: { findFirst: vi.fn() },
  review: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  comment: { create: vi.fn() },
  response: { create: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

const uploadImageMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/imageUpload", () => ({ uploadImage: uploadImageMock }));

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
    expect(prismaMock.review.create).toHaveBeenCalledWith({
      data: { ...body, userId, images: { create: [] } },
      include: { images: true },
    });
  });

  it("uploads attached images and links them to the review", async () => {
    uploadImageMock.mockResolvedValue("https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg");
    prismaMock.review.create.mockResolvedValue({ id: 1, ...body, userId, status: "Pending" });

    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${token}`)
      .field("restaurantId", body.restaurantId)
      .field("foodQualityRating", String(body.foodQualityRating))
      .field("serviceRating", String(body.serviceRating))
      .field("miscRating", String(body.miscRating))
      .field("reviewText", body.reviewText)
      .attach("images", Buffer.from("fake-bytes"), "photo.png");

    expect(res.status).toBe(201);
    expect(uploadImageMock).toHaveBeenCalledWith(expect.any(Buffer));
    expect(prismaMock.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          images: { create: [{ imageUrl: "https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg" }] },
        }),
      })
    );
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

describe("PUT /reviews/:id", () => {
  const app = createApp();
  const review = { id: 1, userId, status: "Approved" };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.review.findUnique.mockResolvedValue(review);
  });

  it("requires authentication", async () => {
    const res = await request(app).put("/reviews/1").send({ reviewText: "Edited" });

    expect(res.status).toBe(401);
    expect(prismaMock.review.update).not.toHaveBeenCalled();
  });

  it("updates own review and resets status to Pending", async () => {
    prismaMock.review.update.mockResolvedValue({ ...review, reviewText: "Edited", status: "Pending" });

    const res = await request(app)
      .put("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewText: "Edited" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Pending");
    expect(prismaMock.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { reviewText: "Edited", status: "Pending" },
      include: { images: true },
    });
  });

  it("appends newly uploaded images without touching existing ones", async () => {
    uploadImageMock.mockResolvedValue("https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg");
    prismaMock.review.update.mockResolvedValue({ ...review, status: "Pending" });

    const res = await request(app)
      .put("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .attach("images", Buffer.from("fake-bytes"), "photo.png");

    expect(res.status).toBe(200);
    expect(prismaMock.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: "Pending",
        images: { create: [{ imageUrl: "https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg" }] },
      },
      include: { images: true },
    });
  });

  it("returns 403 when editing someone else's review", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ ...review, userId: "someone-else" });

    const res = await request(app)
      .put("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewText: "Edited" });

    expect(res.status).toBe(403);
    expect(prismaMock.review.update).not.toHaveBeenCalled();
  });

  it("returns 404 for a review that doesn't exist", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewText: "Edited" });

    expect(res.status).toBe(404);
    expect(prismaMock.review.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank reviewText", async () => {
    const res = await request(app)
      .put("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewText: "   " });

    expect(res.status).toBe(400);
    expect(prismaMock.review.update).not.toHaveBeenCalled();
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
