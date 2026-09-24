import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("api docs", () => {
  const app = createApp();

  it("serves the OpenAPI spec", async () => {
    const res = await request(app).get("/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(["/health", "/auth/register", "/auth/login", "/users/me"])
    );
  });

  it("serves the Swagger UI", async () => {
    const res = await request(app).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
