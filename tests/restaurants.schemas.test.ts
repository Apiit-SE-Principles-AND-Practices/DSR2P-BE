import { describe, expect, it } from "vitest";
import {
  createRestaurantSchema,
  idParamSchema,
  listReviewsQuerySchema,
  listRestaurantsQuerySchema,
  searchRestaurantsQuerySchema,
  updateRestaurantSchema,
} from "../src/modules/restaurants/restaurants.schemas";

const valid = {
  name: "Ceylon Spice House",
  city: "Colombo",
  category: "Sri Lankan",
  address: "12 Galle Road, Colombo 03",
};

describe("createRestaurantSchema", () => {
  it("accepts a valid restaurant", () => {
    expect(createRestaurantSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an optional imageUrl", () => {
    const parsed = createRestaurantSchema.parse({ ...valid, imageUrl: "https://example.com/a.png" });
    expect(parsed.imageUrl).toBe("https://example.com/a.png");
  });

  it("trims text fields", () => {
    const parsed = createRestaurantSchema.parse({ ...valid, name: "  Ceylon Spice House  " });
    expect(parsed.name).toBe("Ceylon Spice House");
  });

  it.each(["name", "category", "address"] as const)("rejects a blank %s", (field) => {
    const result = createRestaurantSchema.safeParse({ ...valid, [field]: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 150 characters", () => {
    const result = createRestaurantSchema.safeParse({ ...valid, name: "a".repeat(151) });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported city", () => {
    const result = createRestaurantSchema.safeParse({ ...valid, city: "London" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed imageUrl", () => {
    const result = createRestaurantSchema.safeParse({ ...valid, imageUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("requires every field", () => {
    const result = createRestaurantSchema.safeParse({ name: "Ceylon Spice House" });
    expect(result.success).toBe(false);
  });
});

describe("updateRestaurantSchema", () => {
  it("accepts a single-field update", () => {
    expect(updateRestaurantSchema.parse({ name: "New Name" })).toEqual({ name: "New Name" });
  });

  it("rejects an empty body", () => {
    const result = updateRestaurantSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an invalid city even when other fields are valid", () => {
    const result = updateRestaurantSchema.safeParse({ name: "New Name", city: "London" });
    expect(result.success).toBe(false);
  });
});

describe("listRestaurantsQuerySchema", () => {
  it("defaults page to 1 and pageSize to 20 for an empty query", () => {
    expect(listRestaurantsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts a supported city", () => {
    expect(listRestaurantsQuerySchema.parse({ city: "Kandy" }).city).toBe("Kandy");
  });

  it("rejects an unsupported city", () => {
    const result = listRestaurantsQuerySchema.safeParse({ city: "London" });
    expect(result.success).toBe(false);
  });

  it("coerces page and pageSize from query strings", () => {
    const parsed = listRestaurantsQuerySchema.parse({ page: "3", pageSize: "50" });
    expect(parsed).toMatchObject({ page: 3, pageSize: 50 });
  });

  it.each([0, -1])("rejects a page of %i", (page) => {
    expect(listRestaurantsQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it("rejects a non-integer page", () => {
    expect(listRestaurantsQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it("rejects a non-numeric page", () => {
    expect(listRestaurantsQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
  });

  it("accepts pageSize at the max of 100", () => {
    expect(listRestaurantsQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100);
  });

  it("rejects a pageSize over 100", () => {
    expect(listRestaurantsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("rejects a pageSize of 0", () => {
    expect(listRestaurantsQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
  });
});

describe("idParamSchema", () => {
  it("accepts a uuid", () => {
    const id = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";
    expect(idParamSchema.parse({ id })).toEqual({ id });
  });

  it("rejects a non-uuid id", () => {
    const result = idParamSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("searchRestaurantsQuerySchema", () => {
  it("accepts an empty query, defaulting page/pageSize", () => {
    expect(searchRestaurantsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts all filters together", () => {
    const query = {
      city: "Kandy",
      category: "Sri Lankan",
      diet: "Vegan",
      spice: "Hot",
      price: "Moderate",
    };
    expect(searchRestaurantsQuerySchema.parse(query)).toMatchObject(query);
  });

  it.each(["Vegetarian", "Vegan", "Halal"])("accepts diet %s", (diet) => {
    expect(searchRestaurantsQuerySchema.safeParse({ diet }).success).toBe(true);
  });

  it("rejects an unsupported diet", () => {
    expect(searchRestaurantsQuerySchema.safeParse({ diet: "Keto" }).success).toBe(false);
  });

  it.each(["None", "Mild", "Medium", "Hot", "Extra_Hot"])("accepts spice %s", (spice) => {
    expect(searchRestaurantsQuerySchema.safeParse({ spice }).success).toBe(true);
  });

  it("rejects an unsupported spice level", () => {
    expect(searchRestaurantsQuerySchema.safeParse({ spice: "Nuclear" }).success).toBe(false);
  });

  it.each(["Budget", "Moderate", "Premium"])("accepts price band %s", (price) => {
    expect(searchRestaurantsQuerySchema.safeParse({ price }).success).toBe(true);
  });

  it("rejects an unsupported price band", () => {
    expect(searchRestaurantsQuerySchema.safeParse({ price: "Luxury" }).success).toBe(false);
  });

  it("rejects an unsupported city", () => {
    expect(searchRestaurantsQuerySchema.safeParse({ city: "London" }).success).toBe(false);
  });

  it.each(["rating", "price"])("accepts sort %s", (sort) => {
    expect(searchRestaurantsQuerySchema.safeParse({ sort }).success).toBe(true);
  });

  it("rejects an unsupported sort", () => {
    expect(searchRestaurantsQuerySchema.safeParse({ sort: "distance" }).success).toBe(false);
  });
});

describe("listReviewsQuerySchema", () => {
  it("defaults to status=Approved, sort=newest", () => {
    expect(listReviewsQuerySchema.parse({})).toEqual({ status: "Approved", sort: "newest" });
  });

  it.each(["Approved", "Rejected", "Pending"])("accepts status %s", (status) => {
    expect(listReviewsQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects an unsupported status", () => {
    expect(listReviewsQuerySchema.safeParse({ status: "Draft" }).success).toBe(false);
  });

  it("rejects an unsupported sort", () => {
    expect(listReviewsQuerySchema.safeParse({ sort: "top" }).success).toBe(false);
  });
});
