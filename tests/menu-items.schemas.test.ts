import { describe, expect, it } from "vitest";
import {
  createMenuItemSchema,
  restaurantItemParamsSchema,
  updateMenuItemSchema,
} from "../src/modules/restaurants/menu-items.schemas";

describe("createMenuItemSchema", () => {
  it("accepts a minimal valid item, defaulting booleans and spiceLevel", () => {
    const parsed = createMenuItemSchema.parse({ name: "Kottu", priceLkr: "800" });
    expect(parsed).toEqual({
      name: "Kottu",
      priceLkr: 800,
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
      spiceLevel: "None",
    });
  });

  it("coerces priceLkr from a multipart string", () => {
    expect(createMenuItemSchema.parse({ name: "Kottu", priceLkr: "0" }).priceLkr).toBe(0);
  });

  it("rejects a negative price", () => {
    const result = createMenuItemSchema.safeParse({ name: "Kottu", priceLkr: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = createMenuItemSchema.safeParse({ name: "  ", priceLkr: "100" });
    expect(result.success).toBe(false);
  });

  it.each(["true", "false"])("parses the string boolean %s correctly, not via truthiness", (value) => {
    const parsed = createMenuItemSchema.parse({ name: "Kottu", priceLkr: "100", isVegan: value });
    expect(parsed.isVegan).toBe(value === "true");
  });

  it("rejects an unsupported spiceLevel", () => {
    const result = createMenuItemSchema.safeParse({ name: "Kottu", priceLkr: "100", spiceLevel: "Nuclear" });
    expect(result.success).toBe(false);
  });
});

describe("updateMenuItemSchema", () => {
  it("accepts a single field update", () => {
    expect(updateMenuItemSchema.parse({ priceLkr: "500" })).toEqual({ priceLkr: 500 });
  });

  it("rejects an empty body", () => {
    expect(updateMenuItemSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(updateMenuItemSchema.safeParse({ priceLkr: "-5" }).success).toBe(false);
  });
});

describe("restaurantItemParamsSchema", () => {
  const restaurantId = "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91";

  it("coerces itemId to a number", () => {
    expect(restaurantItemParamsSchema.parse({ id: restaurantId, itemId: "42" })).toEqual({
      id: restaurantId,
      itemId: 42,
    });
  });

  it("rejects a non-uuid restaurant id", () => {
    expect(restaurantItemParamsSchema.safeParse({ id: "not-a-uuid", itemId: "42" }).success).toBe(false);
  });

  it("rejects a non-numeric itemId", () => {
    expect(restaurantItemParamsSchema.safeParse({ id: restaurantId, itemId: "abc" }).success).toBe(false);
  });
});
