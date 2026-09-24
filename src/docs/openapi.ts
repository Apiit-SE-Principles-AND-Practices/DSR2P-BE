import { OpenAPIV3 } from "openapi-types";

// OpenAPI 3.0 spec served at /docs (Swagger UI) and /docs/openapi.json.
// Keep request schemas in sync with the zod schemas in src/modules/**.

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "DSR2P API",
    version: "0.1.0",
    description: "Backend API for the Ruchi / Dine Score restaurant review portal.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health" },
    { name: "Auth", description: "Registration and login" },
    { name: "Users", description: "The logged-in user's profile" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Language: { type: "string", enum: ["en", "si", "ta"] },
      Role: { type: "string", enum: ["Customer", "Admin"] },
      PublicUser: {
        type: "object",
        required: ["id", "name", "email", "role", "language"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/Role" },
          language: { $ref: "#/components/schemas/Language" },
        },
      },
      AuthResult: {
        type: "object",
        required: ["token", "user"],
        properties: {
          token: { type: "string", description: "JWT — send as `Authorization: Bearer <token>`" },
          user: { $ref: "#/components/schemas/PublicUser" },
        },
      },
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Nimal Perera" },
          email: {
            type: "string",
            format: "email",
            maxLength: 150,
            description: "Stored lowercase; must not already be registered (in any case)",
            example: "nimal@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 72,
            description: "8–72 characters, with at least one letter and one number",
            example: "Password123",
          },
          language: { $ref: "#/components/schemas/Language" },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "customer@dsr2p.local" },
          password: { type: "string", example: "Password123" },
        },
      },
      UpdateProfileInput: {
        type: "object",
        description: "At least one of name/language must be given",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Nimal Perera" },
          language: { $ref: "#/components/schemas/Language" },
        },
      },
      ValidationError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "details"],
            properties: {
              code: { type: "string", enum: ["VALIDATION_ERROR"] },
              message: { type: "string" },
              details: {
                type: "object",
                properties: {
                  formErrors: { type: "array", items: { type: "string" } },
                  fieldErrors: {
                    type: "object",
                    description: "Messages per field; the first one is the most relevant",
                    additionalProperties: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                example: "VALIDATION_ERROR",
                description:
                  "VALIDATION_ERROR | BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
              },
              message: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check (confirms database connectivity)",
        responses: {
          "200": {
            description: "API and database are up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
          "500": errorResponse("Database unreachable"),
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new Customer account",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterInput" } },
          },
        },
        responses: {
          "201": {
            description: "Account created",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } },
            },
          },
          "400": {
            description: "Validation failed — nothing was saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
                example: {
                  error: {
                    code: "VALIDATION_ERROR",
                    message: "Request failed validation",
                    details: {
                      formErrors: [],
                      fieldErrors: {
                        email: ["Invalid email address"],
                        password: ["Password must contain a number"],
                      },
                    },
                  },
                },
              },
            },
          },
          "409": errorResponse("Email already registered — nothing was saved"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } },
          },
        },
        responses: {
          "200": {
            description: "Logged in",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } },
            },
          },
          "400": errorResponse("Validation failed"),
          "401": errorResponse("Invalid email or password"),
        },
      },
    },
    "/users/me": {
      patch: {
        tags: ["Users"],
        summary: "Update the logged-in user's name and/or language",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateProfileInput" } },
          },
        },
        responses: {
          "200": {
            description: "Updated profile",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } },
            },
          },
          "400": {
            description: "Validation failed (blank/over-long name, unsupported language, or neither field given)",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } },
            },
          },
          "401": errorResponse("Not logged in"),
          "404": errorResponse("User no longer exists"),
        },
      },
    },
  },
};
