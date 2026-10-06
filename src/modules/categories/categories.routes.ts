import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { categoryIdParamSchema, createCategorySchema, updateCategorySchema } from "./categories.schemas";

// [DSR2P]-8/categories — GET /categories — the full list, alphabetical.
export const categoriesRouter = Router();
categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.status(200).json(categories);
  })
);

// Admin-only writes, mounted at /admin/categories.
export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAdmin);

adminCategoriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createCategorySchema.parse(req.body);
    const category = await prisma.category.create({ data: input });
    res.status(201).json(category);
  })
);

adminCategoriesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    const input = updateCategorySchema.parse(req.body);
    const category = await prisma.category.update({ where: { id }, data: input });
    res.status(200).json(category);
  })
);

// Linked menu items keep their row (categoryId set null via onDelete: SetNull);
// linked restaurants simply lose that tag (RestaurantCategory cascades).
adminCategoriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  })
);
