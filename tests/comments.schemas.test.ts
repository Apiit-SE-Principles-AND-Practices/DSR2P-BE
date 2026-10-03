import { describe, expect, it } from "vitest";
import { commentIdParamSchema, rejectCommentSchema } from "../src/modules/comments/comments.schemas";

describe("commentIdParamSchema", () => {
  it("coerces a numeric id", () => {
    expect(commentIdParamSchema.parse({ id: "42" })).toEqual({ id: 42 });
  });

  it("rejects a non-numeric id", () => {
    expect(commentIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });

  it("rejects a non-positive id", () => {
    expect(commentIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
  });
});

describe("rejectCommentSchema", () => {
  it("accepts a non-blank reason", () => {
    expect(rejectCommentSchema.parse({ reason: "Off-topic" })).toEqual({ reason: "Off-topic" });
  });

  it("rejects a blank reason", () => {
    expect(rejectCommentSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(rejectCommentSchema.safeParse({}).success).toBe(false);
  });
});
