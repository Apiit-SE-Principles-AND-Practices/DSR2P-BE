import { z } from "zod";

// Mirrors the DB CHECK constraints (reviews_{food_quality,service,misc}_rating_check):
// integer 1–5 inclusive, so 0 and 6 are rejected same as any other out-of-range value.
// Coerced since multipart/form-data values arrive as strings.
const rating = z.coerce
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5");

const language = z.enum(["en", "si", "ta"]);

// [DSR2P]-17 — POST /reviews submit(). multipart/form-data (text fields coerced,
// since multipart values arrive as strings) plus optional "images" files.
export const createReviewSchema = z.object({
  restaurantId: z.string().uuid("Invalid restaurant id"),
  itemId: z.coerce.number().int().positive().optional(),
  foodQualityRating: rating,
  serviceRating: rating,
  miscRating: rating,
  reviewText: z.string().trim().min(1, "Review text is required"),
  language: language.optional(),
});

// [DSR2P]-21 — PUT /reviews/:id edit(), own review only. Partial; new images are
// appended, existing ones untouched. Re-submitting resets status to Pending.
export const updateReviewSchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  foodQualityRating: rating.optional(),
  serviceRating: rating.optional(),
  miscRating: rating.optional(),
  reviewText: z.string().trim().min(1, "Review text is required").optional(),
  language: language.optional(),
});

// [DSR2P]-19 — POST /reviews/:id/comments
export const reviewIdParamSchema = z.object({
  id: z.coerce.number().int("Invalid review id").positive("Invalid review id"),
});

export const createCommentSchema = z.object({
  commentText: z.string().trim().min(1, "Comment text is required"),
});

// [DSR2P]-20 — POST /reviews/:id/response
export const createResponseSchema = z.object({
  responseText: z.string().trim().min(1, "Response text is required"),
});

// [DSR2P]-33 — PATCH /admin/reviews/:id/reject
export const rejectReviewSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
