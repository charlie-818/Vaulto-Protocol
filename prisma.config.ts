// Prisma configuration for Vaulto Protocol
// See https://pris.ly/d/config-datasource
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use connection pooler URL for serverless deployments
    url: process.env["DATABASE_URL"],
  },
});
