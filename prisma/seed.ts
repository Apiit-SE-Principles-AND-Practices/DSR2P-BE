import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [DSR2P]-categories — the fixed menu/dish category list.
const CATEGORY_NAMES = [
  "Breakfast",
  "Salads",
  "Soups",
  "Rice & Biryani",
  "Noodles & Pasta",
  "Pizza",
  "Burgers & Sandwiches",
  "Chicken",
  "Meat & Beef",
  "Seafood",
  "Vegetarian",
  "Sri Lankan / Local Specials",
  "Curries",
  "Appetizers & Starters",
  "Snacks & Sides",
  "Desserts",
  "Soft Drinks & Beverages",
  "Tea & Coffee",
  "Mocktails & Juices",
  "Kids' Menu",
];

// [DSR2P]-1-BE5 — seed roles, sample restaurants, menu items and one Admin/Customer account.
// Safe to re-run: every insert is an upsert or guarded by an existence check.
async function main() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  const riceAndBiryani = await prisma.category.findUniqueOrThrow({ where: { name: "Rice & Biryani" } });
  const localSpecials = await prisma.category.findUniqueOrThrow({
    where: { name: "Sri Lankan / Local Specials" },
  });

  await prisma.role.upsert({
    where: { name: "Customer" },
    update: {},
    create: {
      name: "Customer",
      description: "Browses, searches, and reviews restaurants and menu items",
    },
  });
  await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      description: "Manages restaurant and menu data and moderates reviews and comments",
    },
  });

  const passwordHash = await bcrypt.hash("Password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dsr2p.local" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@dsr2p.local",
      passwordHash,
      role: { connect: { name: "Admin" } },
      language: "en",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@dsr2p.local" },
    update: {},
    create: {
      name: "Sample Customer",
      email: "customer@dsr2p.local",
      passwordHash,
      role: { connect: { name: "Customer" } },
      language: "en",
    },
  });

  const restaurant =
    (await prisma.restaurant.findFirst({ where: { name: "Ceylon Spice House" } })) ??
    (await prisma.restaurant.create({
      data: {
        name: "Ceylon Spice House",
        city: "Colombo",
        address: "12 Galle Road, Colombo 03",
        categories: { create: [{ categoryId: localSpecials.id }, { categoryId: riceAndBiryani.id }] },
        menuItems: {
          create: [
            {
              name: "Chicken Kottu",
              priceLkr: 1200,
              isVegetarian: false,
              isVegan: false,
              isHalal: true,
              spiceLevel: "Medium",
              categoryId: localSpecials.id,
            },
            {
              name: "Vegetable Rice & Curry",
              categoryId: riceAndBiryani.id,
              priceLkr: 900,
              isVegetarian: true,
              isVegan: true,
              isHalal: true,
              spiceLevel: "Mild",
            },
          ],
        },
      },
    }));

  const existingReview = await prisma.review.findFirst({
    where: { userId: customer.id, restaurantId: restaurant.id },
  });
  if (!existingReview) {
    await prisma.review.create({
      data: {
        userId: customer.id,
        restaurantId: restaurant.id,
        foodQualityRating: 5,
        serviceRating: 4,
        miscRating: 4,
        reviewText: "Great flavours and quick service.",
        status: "Approved",
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete:", { admin: admin.email, customer: customer.email });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
