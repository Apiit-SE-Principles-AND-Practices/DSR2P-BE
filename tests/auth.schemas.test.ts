import { describe, expect, it } from "vitest";
import { EMAIL_MAX, NAME_MAX, PASSWORD_MAX, registerSchema } from "../src/modules/auth/auth.schemas";

const valid = { name: "Nimal Perera", email: "nimal@example.com", password: "Password123" };

// First error message for a field, or undefined if the field passed.
function firstError(input: unknown, field: string) {
  const result = registerSchema.safeParse(input);
  if (result.success) return undefined;
  const fieldErrors: Record<string, string[] | undefined> = result.error.flatten().fieldErrors;
  return fieldErrors[field]?.[0];
}

describe("registerSchema", () => {
  it("accepts a valid registration and defaults nothing it wasn't given", () => {
    expect(registerSchema.parse(valid)).toEqual(valid);
  });

  it("accepts each supported language", () => {
    for (const language of ["en", "si", "ta"]) {
      expect(registerSchema.parse({ ...valid, language }).language).toBe(language);
    }
  });

  it("trims name and email, and lowercases email", () => {
    const parsed = registerSchema.parse({
      ...valid,
      name: "  Nimal Perera  ",
      email: "  Nimal@Example.COM ",
    });
    expect(parsed.name).toBe("Nimal Perera");
    expect(parsed.email).toBe("nimal@example.com");
  });

  it("drops fields that aren't part of registration, such as role", () => {
    const parsed = registerSchema.parse({ ...valid, role: "Admin", roleId: 2 });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("roleId");
  });

  describe("name", () => {
    it.each([
      ["missing", undefined, "Name is required"],
      ["blank", "", "Name is required"],
      ["only spaces", "   ", "Name is required"],
      ["too long", "a".repeat(NAME_MAX + 1), `Name must be at most ${NAME_MAX} characters`],
    ])("rejects a %s name", (_case, name, message) => {
      expect(firstError({ ...valid, name }, "name")).toBe(message);
    });

    it(`accepts a name of exactly ${NAME_MAX} characters`, () => {
      expect(firstError({ ...valid, name: "a".repeat(NAME_MAX) }, "name")).toBeUndefined();
    });
  });

  describe("email", () => {
    const longEmail = `${"a".repeat(EMAIL_MAX - "@example.com".length + 1)}@example.com`;

    it.each([
      ["missing", undefined, "Email is required"],
      ["blank", "", "Email is required"],
      ["only spaces", "   ", "Email is required"],
      ["malformed", "not-an-email", "Invalid email address"],
      ["missing its domain", "nimal@", "Invalid email address"],
      ["too long", longEmail, `Email must be at most ${EMAIL_MAX} characters`],
    ])("rejects a %s email", (_case, email, message) => {
      expect(firstError({ ...valid, email }, "email")).toBe(message);
    });
  });

  describe("password", () => {
    it.each([
      ["missing", undefined, "Password is required"],
      ["blank", "", "Password is required"],
      ["too short", "Pass12", "Password must be at least 8 characters"],
      ["too long", `a1${"b".repeat(PASSWORD_MAX - 1)}`, `Password must be at most ${PASSWORD_MAX} characters`],
      ["letter-free", "12345678", "Password must contain a letter"],
      ["number-free", "Password", "Password must contain a number"],
    ])("rejects a %s password", (_case, password, message) => {
      expect(firstError({ ...valid, password }, "password")).toBe(message);
    });

    it("does not trim the password", () => {
      expect(registerSchema.parse({ ...valid, password: " Password123 " }).password).toBe(" Password123 ");
    });
  });

  it("rejects an unsupported language", () => {
    expect(firstError({ ...valid, language: "EN" }, "language")).toBeDefined();
  });

  it("reports every invalid field at once", () => {
    const result = registerSchema.safeParse({ name: "", email: "bad", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.error.flatten().fieldErrors).sort()).toEqual(["email", "name", "password"]);
    }
  });
});
