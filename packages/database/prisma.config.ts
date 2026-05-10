import path from "node:path";
import url from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Muat .env dari root monorepo
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public",
  },
});
