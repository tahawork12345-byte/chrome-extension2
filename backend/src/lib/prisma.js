import { PrismaClient } from "@prisma/client";

/* one client per process; reused across warm serverless invocations
   and across --watch reloads in dev */
const g = globalThis;
export const prisma = g.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
