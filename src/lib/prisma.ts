import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance, reused across the app (and hot reload in dev).
export const prisma = new PrismaClient();
