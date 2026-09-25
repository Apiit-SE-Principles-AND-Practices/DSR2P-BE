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
    { name: "Restaurants", description: "Public restaurant browsing" },
    { name: "Admin", description: "Admin-only restaurant management" },
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
      City: { type: "string", enum: ["Colombo", "Kandy", "Galle"] },
      Restaurant: {
        type: "object",
        required: ["id", "name", "city", "category", "address", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          city: { $ref: "#/components/schemas/City" },
          category: { type: "string" },
          address: { type: "string" },
          imageUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      RestaurantPage: {
        type: "object",
        required: ["data", "page", "pageSize", "total", "totalPages"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Restaurant" } },
          page: { type: "integer", minimum: 1, example: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 100, example: 20 },
          total: { type: "integer", description: "Total matching restaurants, across all pages" },
          totalPages: { type: "integer" },
        },
      },
      PriceBand: { type: "string", enum: ["Budget", "Moderate", "Premium"] },
      RestaurantSearchResult: {
        allOf: [
          { $ref: "#/components/schemas/Restaurant" },
          {
            type: "object",
            required: ["averageRating", "priceBand"],
            properties: {
              averageRating: {
                type: "number",
                nullable: true,
                description: "Mean of the three rating dimensions across Approved reviews; null with none",
              },
              priceBand: { allOf: [{ $ref: "#/components/schemas/PriceBand" }], nullable: true },
            },
          },
        ],
      },
      RestaurantSearchPage: {
        type: "object",
        required: ["data", "page", "pageSize", "total", "totalPages"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/RestaurantSearchResult" } },
          page: { type: "integer", minimum: 1, example: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 100, example: 20 },
          total: { type: "integer", description: "Total matching restaurants, across all pages" },
          totalPages: { type: "integer" },
        },
      },
      SpiceLevel: { type: "string", enum: ["None", "Mild", "Medium", "Hot", "Extra_Hot"] },
      MenuItem: {
        type: "object",
        required: ["id", "name", "priceLkr", "isVegetarian", "isVegan", "isHalal", "spiceLevel"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          priceLkr: { type: "number" },
          isVegetarian: { type: "boolean" },
          isVegan: { type: "boolean" },
          isHalal: { type: "boolean" },
          spiceLevel: { $ref: "#/components/schemas/SpiceLevel" },
          imageUrl: { type: "string", nullable: true },
        },
      },
      ModerationStatus: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
      Comment: {
        type: "object",
        required: ["id", "reviewId", "userId", "commentText", "status", "createdAt"],
        properties: {
          id: { type: "integer" },
          reviewId: { type: "integer" },
          userId: { type: "string", format: "uuid" },
          commentText: { type: "string" },
          status: { $ref: "#/components/schemas/ModerationStatus" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ReviewResponse: {
        type: "object",
        required: ["id", "reviewId", "responseText", "createdAt"],
        properties: {
          id: { type: "integer" },
          reviewId: { type: "integer" },
          responseText: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Review: {
        type: "object",
        required: [
          "id",
          "userId",
          "restaurantId",
          "foodQualityRating",
          "serviceRating",
          "miscRating",
          "reviewText",
          "language",
          "status",
          "createdAt",
          "comments",
          "response",
        ],
        properties: {
          id: { type: "integer" },
          userId: { type: "string", format: "uuid" },
          restaurantId: { type: "string", format: "uuid" },
          itemId: { type: "integer", nullable: true },
          foodQualityRating: { type: "integer", minimum: 1, maximum: 5 },
          serviceRating: { type: "integer", minimum: 1, maximum: 5 },
          miscRating: { type: "integer", minimum: 1, maximum: 5 },
          reviewText: { type: "string" },
          language: { $ref: "#/components/schemas/Language" },
          status: { $ref: "#/components/schemas/ModerationStatus" },
          createdAt: { type: "string", format: "date-time" },
          comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
          response: { allOf: [{ $ref: "#/components/schemas/ReviewResponse" }], nullable: true },
        },
      },
      CreateRestaurantInput: {
        type: "object",
        required: ["name", "city", "category", "address"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 150, example: "Ceylon Spice House" },
          city: { $ref: "#/components/schemas/City" },
          category: { type: "string", minLength: 1, maxLength: 50, example: "Sri Lankan" },
          address: { type: "string", minLength: 1, maxLength: 255, example: "12 Galle Road, Colombo 03" },
          imageUrl: { type: "string", format: "uri", maxLength: 255 },
        },
      },
      UpdateRestaurantInput: {
        type: "object",
        description: "At least one field must be given",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 150 },
          city: { $ref: "#/components/schemas/City" },
          category: { type: "string", minLength: 1, maxLength: 50 },
          address: { type: "string", minLength: 1, maxLength: 255 },
          imageUrl: { type: "string", format: "uri", maxLength: 255 },
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
    "/restaurants": {
      get: {
        tags: ["Restaurants"],
        summary: "List restaurants, newest first",
        parameters: [
          {
            name: "city",
            in: "query",
            schema: { $ref: "#/components/schemas/City" },
          },
          {
            name: "page",
            in: "query",
            description: "1-based page number",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "A page of restaurants",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RestaurantPage" } },
            },
          },
          "400": errorResponse("Unsupported city, or an invalid page/pageSize"),
        },
      },
    },
    "/restaurants/search": {
      get: {
        tags: ["Restaurants"],
        summary: "Search restaurants by category/diet/spice/price/city",
        description: "diet/spice/price filter on the restaurant's menu items (matches restaurants with at least one qualifying item).",
        parameters: [
          { name: "city", in: "query", schema: { $ref: "#/components/schemas/City" } },
          { name: "category", in: "query", schema: { type: "string", maxLength: 50 } },
          { name: "diet", in: "query", schema: { type: "string", enum: ["Vegetarian", "Vegan", "Halal"] } },
          {
            name: "spice",
            in: "query",
            schema: { type: "string", enum: ["None", "Mild", "Medium", "Hot", "Extra_Hot"] },
          },
          { name: "price", in: "query", schema: { type: "string", enum: ["Budget", "Moderate", "Premium"] } },
          {
            name: "sort",
            in: "query",
            description: "rating: best-rated first. price: cheapest first. Default: newest first.",
            schema: { type: "string", enum: ["rating", "price"] },
          },
          {
            name: "page",
            in: "query",
            description: "1-based page number",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "A page of matching restaurants, each with computed averageRating/priceBand",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RestaurantSearchPage" } },
            },
          },
          "400": errorResponse("Unsupported filter value, or an invalid page/pageSize"),
        },
      },
    },
    "/restaurants/{id}": {
      get: {
        tags: ["Restaurants"],
        summary: "Get one restaurant",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Restaurant, with computed averageRating/priceBand",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RestaurantSearchResult" } } },
          },
          "400": errorResponse("Malformed id"),
          "404": errorResponse("Restaurant not found"),
        },
      },
    },
    "/restaurants/{id}/menu": {
      get: {
        tags: ["Restaurants"],
        summary: "Get a restaurant's menu",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Menu items, alphabetical by name",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/MenuItem" } } } },
          },
          "400": errorResponse("Malformed id"),
          "404": errorResponse("Restaurant not found"),
        },
      },
    },
    "/restaurants/{id}/reviews": {
      get: {
        tags: ["Restaurants"],
        summary: "Get a restaurant's reviews, with nested comments and admin response",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          {
            name: "status",
            in: "query",
            description: "Defaults to Approved",
            schema: { $ref: "#/components/schemas/ModerationStatus" },
          },
          {
            name: "sort",
            in: "query",
            description: "Defaults to newest",
            schema: { type: "string", enum: ["newest", "oldest"] },
          },
        ],
        responses: {
          "200": {
            description: "Matching reviews",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Review" } } } },
          },
          "400": errorResponse("Malformed id, or an unsupported status/sort"),
          "404": errorResponse("Restaurant not found"),
        },
      },
    },
    "/admin/restaurants": {
      post: {
        tags: ["Admin"],
        summary: "Create a restaurant",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateRestaurantInput" } },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Restaurant" } } },
          },
          "400": {
            description: "Validation failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "401": errorResponse("Not logged in"),
          "403": errorResponse("Not an Admin"),
        },
      },
    },
    "/admin/restaurants/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update a restaurant",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateRestaurantInput" } },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Restaurant" } } },
          },
          "400": {
            description: "Validation failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "401": errorResponse("Not logged in"),
          "403": errorResponse("Not an Admin"),
          "404": errorResponse("Restaurant not found"),
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete a restaurant (cascades to its menu items and reviews)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "204": { description: "Deleted" },
          "400": errorResponse("Malformed id"),
          "401": errorResponse("Not logged in"),
          "403": errorResponse("Not an Admin"),
          "404": errorResponse("Restaurant not found"),
        },
      },
    },
  },
};
