import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  engine: "classic",
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public",
  },
});

