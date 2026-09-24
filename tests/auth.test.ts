import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("auth validation", () => {
  const app = createApp();

  it("rejects registration with an invalid email", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "Test User",
      email: "not-an-email",
      password: "Password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects login with missing password", async () => {
    const res = await request(app).post("/auth/login").send({
      email: "someone@example.com",
    });

    expect(res.status).toBe(400);
  });
});
