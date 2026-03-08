import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitError: Error | undefined;
};

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!(databaseUrl && databaseUrl.length > 0);
}

function createPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL;

  // If no DATABASE_URL, return null - database features will be disabled
  if (!databaseUrl) {
    console.warn("DATABASE_URL not configured - database features disabled");
    return null as unknown as PrismaClient;
  }

  try {
    if (databaseUrl.startsWith("prisma+postgres://")) {
      // Using Prisma Postgres (Accelerate)
      return new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
        accelerateUrl: databaseUrl,
      } as never);
    }

    // Standard PostgreSQL connection
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
      datasourceUrl: databaseUrl,
    } as never);
  } catch (error) {
    console.error("Failed to create Prisma client:", error);
    globalForPrisma.prismaInitError = error as Error;
    return null as unknown as PrismaClient;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
