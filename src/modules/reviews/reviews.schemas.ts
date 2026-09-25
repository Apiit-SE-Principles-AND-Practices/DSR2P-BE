import { z } from "zod";

// Mirrors the DB CHECK constraints (reviews_{food_quality,service,misc}_rating_check):
// integer 1–5 inclusive, so 0 and 6 are rejected same as any other out-of-range value.
const rating = z
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5");

// [DSR2P]-17 — POST /reviews submit()
export const createReviewSchema = z.object({
  restaurantId: z.string().uuid("Invalid restaurant id"),
  itemId: z.number().int().positive().optional(),
  foodQualityRating: rating,
  serviceRating: rating,
  miscRating: rating,
  reviewText: z.string().trim().min(1, "Review text is required"),
  language: z.enum(["en", "si", "ta"]).optional(),
});

// [DSR2P]-19 — POST /reviews/:id/comments
export const reviewIdParamSchema = z.object({
  id: z.coerce.number().int("Invalid review id").positive("Invalid review id"),
});

export const createCommentSchema = z.object({
  commentText: z.string().trim().min(1, "Comment text is required"),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
