import { describe, expect, it } from "vitest";
import {
  createRestaurantSchema,
  idParamSchema,
  listRestaurantsQuerySchema,
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
