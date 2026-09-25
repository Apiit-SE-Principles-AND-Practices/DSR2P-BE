import { describe, expect, it } from "vitest";
import {
  createCommentSchema,
  createResponseSchema,
  createReviewSchema,
  reviewIdParamSchema,
} from "../src/modules/reviews/reviews.schemas";

const valid = {
  restaurantId: "3f1c7a52-9a2e-4b1e-8f3a-0c6d2e5b7a91",
  foodQualityRating: 5,
  serviceRating: 4,
  miscRating: 3,
  reviewText: "Great food, quick service.",
};

describe("createReviewSchema", () => {
  it("accepts a valid review", () => {
    expect(createReviewSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an optional itemId and language", () => {
    const parsed = createReviewSchema.parse({ ...valid, itemId: 42, language: "si" });
    expect(parsed).toMatchObject({ itemId: 42, language: "si" });
  });

  it.each(["foodQualityRating", "serviceRating", "miscRating"] as const)(
    "rejects %s of 0 (below the 1-5 CHECK boundary)",
    (field) => {
      const result = createReviewSchema.safeParse({ ...valid, [field]: 0 });
      expect(result.success).toBe(false);
    }
  );

  it.each(["foodQualityRating", "serviceRating", "miscRating"] as const)(
    "rejects %s of 6 (above the 1-5 CHECK boundary)",
    (field) => {
      const result = createReviewSchema.safeParse({ ...valid, [field]: 6 });
      expect(result.success).toBe(false);
    }
  );

  it("accepts ratings at the 1 and 5 boundaries", () => {
    const result = createReviewSchema.safeParse({
      ...valid,
      foodQualityRating: 1,
      serviceRating: 5,
      miscRating: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer rating", () => {
    const result = createReviewSchema.safeParse({ ...valid, foodQualityRating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a blank reviewText", () => {
    const result = createReviewSchema.safeParse({ ...valid, reviewText: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid restaurantId", () => {
    const result = createReviewSchema.safeParse({ ...valid, restaurantId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("reviewIdParamSchema", () => {
  it("coerces a numeric id", () => {
    expect(reviewIdParamSchema.parse({ id: "42" })).toEqual({ id: 42 });
  });

  it("rejects a non-numeric id", () => {
    expect(reviewIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });

  it("rejects a non-positive id", () => {
    expect(reviewIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("accepts non-blank commentText", () => {
    expect(createCommentSchema.parse({ commentText: "Agreed!" })).toEqual({ commentText: "Agreed!" });
  });

  it("rejects blank commentText", () => {
    expect(createCommentSchema.safeParse({ commentText: "   " }).success).toBe(false);
  });

  it("rejects a missing commentText", () => {
    expect(createCommentSchema.safeParse({}).success).toBe(false);
  });
});

describe("createResponseSchema", () => {
  it("accepts non-blank responseText", () => {
    expect(createResponseSchema.parse({ responseText: "Thanks!" })).toEqual({ responseText: "Thanks!" });
  });

  it("rejects blank responseText", () => {
    expect(createResponseSchema.safeParse({ responseText: "   " }).success).toBe(false);
  });

  it("rejects a missing responseText", () => {
    expect(createResponseSchema.safeParse({}).success).toBe(false);
  });
});
