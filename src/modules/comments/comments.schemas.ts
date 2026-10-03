import { z } from "zod";

export const commentIdParamSchema = z.object({
  id: z.coerce.number().int("Invalid comment id").positive("Invalid comment id"),
});

// [DSR2P]-34 — PATCH /admin/comments/:id/reject
export const rejectCommentSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
});
