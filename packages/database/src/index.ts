import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

// Re-export types agar bisa dipakai di apps lain
export type { Merchant, Session } from "./generated/client";
export { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public";

const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
