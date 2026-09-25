import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./docs/openapi";
import { attachUser } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { healthRouter } from "./modules/health/health.routes";
import { adminRestaurantsRouter, restaurantsRouter } from "./modules/restaurants/restaurants.routes";
import { reviewsRouter } from "./modules/reviews/reviews.routes";
import { usersRouter } from "./modules/users/users.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(attachUser);

  app.get("/docs/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/restaurants", restaurantsRouter);
  app.use("/admin/restaurants", adminRestaurantsRouter);
  app.use("/reviews", reviewsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
