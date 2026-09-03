import { defineConfig } from "drizzle-kit";

const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL is required for Drizzle commands",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl,
  },
  strict: true,
  verbose: true,
});
