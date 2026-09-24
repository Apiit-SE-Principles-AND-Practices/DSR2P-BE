import { describe, expect, it } from "vitest";
import { NAME_MAX } from "../src/modules/auth/auth.schemas";
import { updateProfileSchema } from "../src/modules/users/users.schemas";

function firstFormError(input: unknown) {
  const result = updateProfileSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.flatten().formErrors[0];
}

function firstFieldError(input: unknown, field: string) {
  const result = updateProfileSchema.safeParse(input);
  if (result.success) return undefined;
  const fieldErrors: Record<string, string[] | undefined> = result.error.flatten().fieldErrors;
  return fieldErrors[field]?.[0];
}

describe("updateProfileSchema", () => {
  it("accepts a name-only update", () => {
    expect(updateProfileSchema.parse({ name: "Nimal Perera" })).toEqual({ name: "Nimal Perera" });
  });

  it("accepts a language-only update", () => {
    expect(updateProfileSchema.parse({ language: "si" })).toEqual({ language: "si" });
  });

  it("accepts both fields together", () => {
    expect(updateProfileSchema.parse({ name: "Nimal Perera", language: "ta" })).toEqual({
      name: "Nimal Perera",
      language: "ta",
    });
  });

  it("accepts each supported language", () => {
    for (const language of ["en", "si", "ta"]) {
      expect(updateProfileSchema.parse({ language }).language).toBe(language);
    }
  });

  it("trims the name", () => {
    expect(updateProfileSchema.parse({ name: "  Nimal Perera  " }).name).toBe("Nimal Perera");
  });

  it("accepts a name of exactly the max length", () => {
    const name = "a".repeat(NAME_MAX);
    expect(updateProfileSchema.parse({ name }).name).toBe(name);
  });

  it("rejects a name over the max length", () => {
    const name = "a".repeat(NAME_MAX + 1);
    expect(firstFieldError({ name }, "name")).toBe(`Name must be at most ${NAME_MAX} characters`);
  });

  it("rejects a blank name", () => {
    expect(firstFieldError({ name: "" }, "name")).toBe("Name cannot be blank");
  });

  it("rejects a whitespace-only name", () => {
    expect(firstFieldError({ name: "   " }, "name")).toBe("Name cannot be blank");
  });

  it("rejects an unsupported language", () => {
    const result = updateProfileSchema.safeParse({ language: "fr" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty body — nothing to update", () => {
    expect(firstFormError({})).toBe("Provide at least a name or a language to update");
  });

  it("rejects a body with only unrelated fields", () => {
    expect(firstFormError({ email: "new@example.com" })).toBe(
      "Provide at least a name or a language to update"
    );
  });

  it("strips fields that aren't part of the profile, such as role or email", () => {
    const parsed = updateProfileSchema.parse({ name: "Nimal Perera", role: "Admin", email: "x@example.com" });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("email");
  });
});
