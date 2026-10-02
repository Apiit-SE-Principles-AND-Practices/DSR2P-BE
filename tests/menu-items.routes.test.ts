import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: { findUnique: vi.fn() },
  menuItem: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

const uploadImageMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/imageUpload", () => ({ uploadImage: uploadImageMock }));

import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const restaurantId = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });
const restaurant = { id: restaurantId };
const menuItem = { id: 1, restaurantId, name: "Kottu", priceLkr: 800 };

describe("POST /admin/restaurants/:id/menu-items", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.findUnique.mockResolvedValue(restaurant);
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${customerToken}`)
      .field("name", "Kottu")
      .field("priceLkr", "800");

    expect(res.status).toBe(403);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("creates the item for an Admin, without an image", async () => {
    prismaMock.menuItem.create.mockResolvedValue(menuItem);

    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Kottu")
      .field("priceLkr", "800");

    expect(res.status).toBe(201);
    expect(uploadImageMock).not.toHaveBeenCalled();
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: {
        name: "Kottu",
        priceLkr: 800,
        isVegetarian: false,
        isVegan: false,
        isHalal: false,
        spiceLevel: "None",
        restaurantId,
        imageUrl: undefined,
      },
    });
  });

  it("uploads the image and stores the returned url", async () => {
    uploadImageMock.mockResolvedValue("https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg");
    prismaMock.menuItem.create.mockResolvedValue(menuItem);

    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Kottu")
      .field("priceLkr", "800")
      .attach("image", Buffer.from("fake-image-bytes"), "photo.png");

    expect(res.status).toBe(201);
    expect(uploadImageMock).toHaveBeenCalledWith(expect.any(Buffer));
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: "https://bucket.s3.region.amazonaws.com/dsr2p/uuid.jpg" }),
      })
    );
  });

  it("returns 404 when the restaurant doesn't exist", async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Kottu")
      .field("priceLkr", "800");

    expect(res.status).toBe(404);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a negative price", async () => {
    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Kottu")
      .field("priceLkr", "-1");

    expect(res.status).toBe(400);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank name", async () => {
    const res = await request(app)
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", " ")
      .field("priceLkr", "800");

    expect(res.status).toBe(400);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });
});

describe("PUT /admin/restaurants/:id/menu-items/:itemId", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.menuItem.findFirst.mockResolvedValue(menuItem);
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .put(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${customerToken}`)
      .field("priceLkr", "900");

    expect(res.status).toBe(403);
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it("updates the item for an Admin", async () => {
    prismaMock.menuItem.update.mockResolvedValue({ ...menuItem, priceLkr: 900 });

    const res = await request(app)
      .put(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("priceLkr", "900");

    expect(res.status).toBe(200);
    expect(prismaMock.menuItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { priceLkr: 900, imageUrl: undefined },
    });
  });

  it("returns 404 when the item doesn't belong to that restaurant", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("priceLkr", "900");

    expect(res.status).toBe(404);
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app)
      .put(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/restaurants/:id/menu-items/:itemId", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.menuItem.findFirst.mockResolvedValue(menuItem);
  });

  it("blocks a Customer", async () => {
    const res = await request(app)
      .delete(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(prismaMock.menuItem.delete).not.toHaveBeenCalled();
  });

  it("deletes for an Admin", async () => {
    const res = await request(app)
      .delete(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(prismaMock.menuItem.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("returns 404 when the item doesn't belong to that restaurant", async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/admin/restaurants/${restaurantId}/menu-items/1`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(prismaMock.menuItem.delete).not.toHaveBeenCalled();
  });
});
