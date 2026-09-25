import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  calculateMenuItemAverageRating,
  calculateRestaurantAverageRating,
  calculateRestaurantPriceBand,
} from "../src/lib/ratings";

function fakePrisma(overrides: {
  reviewAvg?: { foodQualityRating: number | null; serviceRating: number | null; miscRating: number | null };
  priceAvg?: number | Prisma.Decimal | null;
}) {
  return {
    review: {
      aggregate: vi.fn().mockResolvedValue({
        _avg: overrides.reviewAvg ?? { foodQualityRating: null, serviceRating: null, miscRating: null },
      }),
    },
    menuItem: {
      aggregate: vi.fn().mockResolvedValue({ _avg: { priceLkr: overrides.priceAvg ?? null } }),
    },
  } as unknown as PrismaClient;
}

describe("calculateRestaurantAverageRating", () => {
  it("averages the three rating dimensions, rounded to one decimal", async () => {
    const prisma = fakePrisma({ reviewAvg: { foodQualityRating: 5, serviceRating: 4, miscRating: 4 } });

    await expect(calculateRestaurantAverageRating(prisma, "r1")).resolves.toBeCloseTo(4.3, 5);
  });

  it("returns null when the restaurant has no Approved reviews", async () => {
    const prisma = fakePrisma({});

    await expect(calculateRestaurantAverageRating(prisma, "r1")).resolves.toBeNull();
  });

  it("only aggregates Approved reviews for that restaurant", async () => {
    const prisma = fakePrisma({ reviewAvg: { foodQualityRating: 5, serviceRating: 5, miscRating: 5 } });

    await calculateRestaurantAverageRating(prisma, "r1");

    expect(prisma.review.aggregate).toHaveBeenCalledWith({
      where: { restaurantId: "r1", status: "Approved" },
      _avg: { foodQualityRating: true, serviceRating: true, miscRating: true },
    });
  });
});

describe("calculateMenuItemAverageRating", () => {
  it("scopes the aggregation to the given item, not the whole restaurant", async () => {
    const prisma = fakePrisma({ reviewAvg: { foodQualityRating: 3, serviceRating: 3, miscRating: 3 } });

    await calculateMenuItemAverageRating(prisma, 42);

    expect(prisma.review.aggregate).toHaveBeenCalledWith({
      where: { itemId: 42, status: "Approved" },
      _avg: { foodQualityRating: true, serviceRating: true, miscRating: true },
    });
  });

  it("returns null when the item has no Approved reviews", async () => {
    const prisma = fakePrisma({});

    await expect(calculateMenuItemAverageRating(prisma, 42)).resolves.toBeNull();
  });
});

describe("calculateRestaurantPriceBand", () => {
  it("returns Budget at or below 1000", async () => {
    const prisma = fakePrisma({ priceAvg: 1000 });
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBe("Budget");
  });

  it("returns Moderate just above the Budget boundary", async () => {
    const prisma = fakePrisma({ priceAvg: 1000.01 });
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBe("Moderate");
  });

  it("returns Moderate at the top of its range", async () => {
    const prisma = fakePrisma({ priceAvg: 2500 });
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBe("Moderate");
  });

  it("returns Premium above 2500", async () => {
    const prisma = fakePrisma({ priceAvg: 2500.01 });
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBe("Premium");
  });

  it("accepts a Prisma Decimal average, not just a number", async () => {
    const prisma = fakePrisma({ priceAvg: new Prisma.Decimal("1800.50") });
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBe("Moderate");
  });

  it("returns null when the restaurant has no menu items", async () => {
    const prisma = fakePrisma({});
    await expect(calculateRestaurantPriceBand(prisma, "r1")).resolves.toBeNull();
  });

  it("aggregates prices scoped to the given restaurant", async () => {
    const prisma = fakePrisma({ priceAvg: 500 });

    await calculateRestaurantPriceBand(prisma, "r1");

    expect(prisma.menuItem.aggregate).toHaveBeenCalledWith({
      where: { restaurantId: "r1" },
      _avg: { priceLkr: true },
    });
  });
});
