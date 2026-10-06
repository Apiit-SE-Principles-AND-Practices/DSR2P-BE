import { describe, expect, it } from "vitest";
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../src/modules/categories/categories.schemas";

describe("createCategorySchema", () => {
  it("accepts a non-blank name", () => {
    expect(createCategorySchema.parse({ name: "Breakfast" })).toEqual({ name: "Breakfast" });
  });

  it("trims the name", () => {
    expect(createCategorySchema.parse({ name: "  Breakfast  " }).name).toBe("Breakfast");
  });

  it("rejects a blank name", () => {
    expect(createCategorySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 50 characters", () => {
    expect(createCategorySchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts a non-blank name", () => {
    expect(updateCategorySchema.parse({ name: "Desserts" })).toEqual({ name: "Desserts" });
  });

  it("rejects a missing name", () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe("categoryIdParamSchema", () => {
  it("coerces a numeric id", () => {
    expect(categoryIdParamSchema.parse({ id: "5" })).toEqual({ id: 5 });
  });

  it("rejects a non-numeric id", () => {
    expect(categoryIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });

  it("rejects a non-positive id", () => {
    expect(categoryIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
  });
});
