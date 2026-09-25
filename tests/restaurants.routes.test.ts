import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  restaurant: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  review: { groupBy: vi.fn() },
  menuItem: { groupBy: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { Prisma } from "@prisma/client";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const adminToken = signToken({ sub: "admin-id", role: "Admin" });
const customerToken = signToken({ sub: "customer-id", role: "Customer" });
const id = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
const restaurant = {
  id,
  name: "Ceylon Spice House",
  city: "Colombo",
  category: "Sri Lankan",
  address: "12 Galle Road, Colombo 03",
  imageUrl: null,
  createdAt: new Date(),
};
const notFoundError = new Prisma.PrismaClientKnownRequestError("Record not found", {
  code: "P2025",
  clientVersion: Prisma.prismaVersion.client,
});

describe("restaurants", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.count.mockResolvedValue(1);
  });

  describe("GET /restaurants", () => {
    it("lists restaurants with no filter, defaulting to page 1 of 20", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([restaurant]);

      const res = await request(app).get("/restaurants");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: [{ ...restaurant, createdAt: restaurant.createdAt.toISOString() }],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(prismaMock.restaurant.count).toHaveBeenCalledWith({ where: undefined });
    });

    it("filters by city", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([]);

      await request(app).get("/restaurants?city=Kandy");

      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { city: "Kandy" } })
      );
      expect(prismaMock.restaurant.count).toHaveBeenCalledWith({ where: { city: "Kandy" } });
    });

    it("returns 400 for an unsupported city", async () => {
      const res = await request(app).get("/restaurants?city=London");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findMany).not.toHaveBeenCalled();
    });

    it("applies page and pageSize as skip/take", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([]);
      prismaMock.restaurant.count.mockResolvedValue(45);

      const res = await request(app).get("/restaurants?page=3&pageSize=10");

      expect(res.body).toMatchObject({ page: 3, pageSize: 10, total: 45, totalPages: 5 });
      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it("returns 400 for a page below 1, and never queries", async () => {
      const res = await request(app).get("/restaurants?page=0");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findMany).not.toHaveBeenCalled();
      expect(prismaMock.restaurant.count).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-numeric page", async () => {
      const res = await request(app).get("/restaurants?page=abc");

      expect(res.status).toBe(400);
    });

    it("returns 400 for a pageSize over the max", async () => {
      const res = await request(app).get("/restaurants?pageSize=101");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findMany).not.toHaveBeenCalled();
    });
  });

  describe("GET /restaurants/search", () => {
    it("searches with no filters, defaulting to page 1 of 20", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([restaurant]);

      const res = await request(app).get("/restaurants/search");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    it("filters by city and category", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([]);

      await request(app).get("/restaurants/search?city=Kandy&category=Sri Lankan");

      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { city: "Kandy", category: "Sri Lankan" } })
      );
    });

    it("filters by diet, spice and price via a menu item sub-filter", async () => {
      prismaMock.restaurant.findMany.mockResolvedValue([]);

      await request(app).get("/restaurants/search?diet=Vegan&spice=Hot&price=Budget");

      expect(prismaMock.restaurant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            menuItems: {
              some: { isVegan: true, spiceLevel: "Hot", priceLkr: { lte: 1000 } },
            },
          },
        })
      );
    });

    it("returns 400 for an unsupported diet", async () => {
      const res = await request(app).get("/restaurants/search?diet=Keto");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 for an unsupported price band", async () => {
      const res = await request(app).get("/restaurants/search?price=Luxury");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findMany).not.toHaveBeenCalled();
    });

    it("sorts by rating, best-rated first, unrated last", async () => {
      const low = { ...restaurant, id: "low" };
      const unrated = { ...restaurant, id: "unrated" };
      const high = { ...restaurant, id: "high" };
      prismaMock.restaurant.findMany.mockResolvedValue([low, unrated, high]);
      prismaMock.review.groupBy.mockResolvedValue([
        { restaurantId: "low", _avg: { foodQualityRating: 2, serviceRating: 2, miscRating: 2 } },
        { restaurantId: "high", _avg: { foodQualityRating: 5, serviceRating: 5, miscRating: 5 } },
      ]);

      const res = await request(app).get("/restaurants/search?sort=rating");

      expect(res.status).toBe(200);
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual(["high", "low", "unrated"]);
      expect(res.body.total).toBe(3);
      expect(prismaMock.restaurant.count).not.toHaveBeenCalled();
    });

    it("sorts by price, cheapest first, unpriced last", async () => {
      const cheap = { ...restaurant, id: "cheap" };
      const unpriced = { ...restaurant, id: "unpriced" };
      const pricey = { ...restaurant, id: "pricey" };
      prismaMock.restaurant.findMany.mockResolvedValue([pricey, unpriced, cheap]);
      prismaMock.menuItem.groupBy.mockResolvedValue([
        { restaurantId: "pricey", _avg: { priceLkr: 5000 } },
        { restaurantId: "cheap", _avg: { priceLkr: 500 } },
      ]);

      const res = await request(app).get("/restaurants/search?sort=price");

      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual(["cheap", "pricey", "unpriced"]);
    });

    it("paginates sorted results", async () => {
      const rows = ["a", "b", "c"].map((id) => ({ ...restaurant, id }));
      prismaMock.restaurant.findMany.mockResolvedValue(rows);
      prismaMock.menuItem.groupBy.mockResolvedValue([]);

      const res = await request(app).get("/restaurants/search?sort=price&page=2&pageSize=2");

      expect(res.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /restaurants/:id", () => {
    it("returns the restaurant", async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(restaurant);

      const res = await request(app).get(`/restaurants/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it("returns 404 when it doesn't exist", async () => {
      prismaMock.restaurant.findUnique.mockResolvedValue(null);

      const res = await request(app).get(`/restaurants/${id}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed id, not 500", async () => {
      const res = await request(app).get("/restaurants/not-a-uuid");

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("POST /admin/restaurants", () => {
    const body = {
      name: "Ceylon Spice House",
      city: "Colombo",
      category: "Sri Lankan",
      address: "12 Galle Road, Colombo 03",
    };

    it("requires authentication", async () => {
      const res = await request(app).post("/admin/restaurants").send(body);

      expect(res.status).toBe(401);
      expect(prismaMock.restaurant.create).not.toHaveBeenCalled();
    });

    it("blocks a Customer", async () => {
      const res = await request(app)
        .post("/admin/restaurants")
        .set("Authorization", `Bearer ${customerToken}`)
        .send(body);

      expect(res.status).toBe(403);
      expect(prismaMock.restaurant.create).not.toHaveBeenCalled();
    });

    it("creates the restaurant for an Admin", async () => {
      prismaMock.restaurant.create.mockResolvedValue(restaurant);

      const res = await request(app)
        .post("/admin/restaurants")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(id);
      expect(prismaMock.restaurant.create).toHaveBeenCalledWith({ data: body });
    });

    it("returns 400 and saves nothing for a missing field", async () => {
      const res = await request(app)
        .post("/admin/restaurants")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Ceylon Spice House" });

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT /admin/restaurants/:id", () => {
    it("blocks a Customer", async () => {
      const res = await request(app)
        .put(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ name: "New Name" });

      expect(res.status).toBe(403);
    });

    it("updates the restaurant for an Admin", async () => {
      prismaMock.restaurant.update.mockResolvedValue({ ...restaurant, name: "New Name" });

      const res = await request(app)
        .put(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New Name");
      expect(prismaMock.restaurant.update).toHaveBeenCalledWith({
        where: { id },
        data: { name: "New Name" },
      });
    });

    it("returns 400 for an empty body", async () => {
      const res = await request(app)
        .put(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(prismaMock.restaurant.update).not.toHaveBeenCalled();
    });

    it("returns 404 for a restaurant that doesn't exist", async () => {
      prismaMock.restaurant.update.mockRejectedValue(notFoundError);

      const res = await request(app)
        .put(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New Name" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/restaurants/:id", () => {
    it("blocks a Customer", async () => {
      const res = await request(app)
        .delete(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(prismaMock.restaurant.delete).not.toHaveBeenCalled();
    });

    it("deletes for an Admin", async () => {
      prismaMock.restaurant.delete.mockResolvedValue(restaurant);

      const res = await request(app)
        .delete(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(prismaMock.restaurant.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it("returns 404 for a restaurant that doesn't exist", async () => {
      prismaMock.restaurant.delete.mockRejectedValue(notFoundError);

      const res = await request(app)
        .delete(`/admin/restaurants/${id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
