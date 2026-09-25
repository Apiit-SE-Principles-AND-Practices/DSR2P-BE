import { Prisma, PrismaClient } from "@prisma/client";

// ratings and price band, always computed fresh from
// Approved reviews / menu prices, never stored. No caller should add a rating
// or price-band column instead of calling these.

export type PriceBand = "Budget" | "Moderate" | "Premium";

// Average price (LKR) per menu item up to which a restaurant counts as each band.
const BUDGET_MAX = 1000;
const MODERATE_MAX = 2500;

function toNumber(value: number | Prisma.Decimal): number {
  return typeof value === "number" ? value : value.toNumber();
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function bandFor(averagePrice: number): PriceBand {
  if (averagePrice <= BUDGET_MAX) return "Budget";
  if (averagePrice <= MODERATE_MAX) return "Moderate";
  return "Premium";
}

// Restaurant.calculateAverageRating(): mean of the three rating
// dimensions across that restaurant's Approved reviews. null with no such reviews.
export async function calculateRestaurantAverageRating(
  prisma: PrismaClient,
  restaurantId: string
): Promise<number | null> {
  const { _avg } = await prisma.review.aggregate({
    where: { restaurantId, status: "Approved" },
    _avg: { foodQualityRating: true, serviceRating: true, miscRating: true },
  });
  if (_avg.foodQualityRating === null || _avg.serviceRating === null || _avg.miscRating === null) {
    return null;
  }
  return round1((_avg.foodQualityRating + _avg.serviceRating + _avg.miscRating) / 3);
}

// MenuItem.calculateAverageRating(): same, scoped to reviews of
// one dish (reviews.item_id), not the whole restaurant.
export async function calculateMenuItemAverageRating(
  prisma: PrismaClient,
  itemId: number
): Promise<number | null> {
  const { _avg } = await prisma.review.aggregate({
    where: { itemId, status: "Approved" },
    _avg: { foodQualityRating: true, serviceRating: true, miscRating: true },
  });
  if (_avg.foodQualityRating === null || _avg.serviceRating === null || _avg.miscRating === null) {
    return null;
  }
  return round1((_avg.foodQualityRating + _avg.serviceRating + _avg.miscRating) / 3);
}

// Restaurant.calculatePriceBand(): band derived from the average
// price_lkr across that restaurant's menu. null if it has no menu items yet.
export async function calculateRestaurantPriceBand(
  prisma: PrismaClient,
  restaurantId: string
): Promise<PriceBand | null> {
  const { _avg } = await prisma.menuItem.aggregate({
    where: { restaurantId },
    _avg: { priceLkr: true },
  });
  return _avg.priceLkr === null ? null : bandFor(toNumber(_avg.priceLkr));
}
