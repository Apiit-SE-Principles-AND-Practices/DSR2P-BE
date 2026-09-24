import { z } from "zod";

// Column limits from the users table (name VARCHAR(100), email VARCHAR(150)).
// Checked here so over-long input is a 400 field error, not a 500 from the database.
export const NAME_MAX = 100;
export const EMAIL_MAX = 150;
// bcrypt only uses the first 72 bytes of a password; reject longer ones rather
// than silently ignoring the tail.
export const PASSWORD_MAX = 72;

const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)
  .email("Invalid email address");

// Mirrors NFR-05 (registration validation) at the API layer.
export const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`),
  // Stored lowercase so the same address can't be registered twice in different case.
  email: emailField.toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
  language: z.enum(["en", "si", "ta"]).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
