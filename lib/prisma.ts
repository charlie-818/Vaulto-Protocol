import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  prismaInitError: Error | undefined;
  // Used by auth.ts to access prisma without importing this module
  __vaulto_prisma?: PrismaClient | null;
};

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!(databaseUrl && databaseUrl.length > 0);
}

// Parse DATABASE_URL for debugging (hides password)
export function getDatabaseUrlDebugInfo(): {
  configured: boolean;
  length?: number;
  protocol?: string;
  host?: string;
  port?: string;
  database?: string;
  hasUser?: boolean;
  hasPassword?: boolean;
  parseError?: string;
} {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return { configured: false };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      configured: true,
      length: databaseUrl.length,
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || "default",
      database: url.pathname.slice(1) || "default",
      hasUser: !!url.username,
      hasPassword: !!url.password,
    };
  } catch (error) {
    return {
      configured: true,
      length: databaseUrl.length,
      parseError: error instanceof Error ? error.message : "Failed to parse URL",
    };
  }
}

function createPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL;

  // If no DATABASE_URL, return null - database features will be disabled
  if (!databaseUrl) {
    console.warn(
      "[Prisma] DATABASE_URL not configured - database features disabled"
    );
    return null;
  }

  try {
    console.log("[Prisma] Creating new PrismaClient instance with pg adapter...");

    // Create or reuse a connection pool
    const pool = globalForPrisma.pool ?? new Pool({
      connectionString: databaseUrl,
      max: 5, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Cache the pool globally
    if (!globalForPrisma.pool) {
      globalForPrisma.pool = pool;
    }

    // Create Prisma adapter with the pg pool
    const adapter = new PrismaPg(pool);

    // Create PrismaClient with the adapter
    const client = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
    });

    console.log("[Prisma] PrismaClient created successfully with pg adapter");
    return client;
  } catch (error) {
    console.error("[Prisma] Failed to create Prisma client:", error);
    globalForPrisma.prismaInitError = error as Error;
    return null;
  }
}

// Use cached client if available, otherwise create a new one
// In serverless environments (like Netlify), we need to cache globally
// to avoid exhausting the connection pool
export const prisma: PrismaClient | null =
  globalForPrisma.prisma ?? createPrismaClient();

// Cache the client globally for both development (hot reload) and production (serverless)
if (prisma) {
  globalForPrisma.prisma = prisma;
  // Also set __vaulto_prisma for auth.ts to access
  globalForPrisma.__vaulto_prisma = prisma;
  console.log("[Prisma] Client registered in globalThis.__vaulto_prisma");
}

// Helper to safely check if prisma is available
export function getPrismaClient(): PrismaClient | null {
  if (!isDatabaseConfigured()) {
    console.warn("[Prisma] Database not configured");
    return null;
  }
  if (!prisma) {
    console.warn("[Prisma] Prisma client not initialized");
    return null;
  }
  return prisma;
}

// Test database connection
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();

  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      error: "DATABASE_URL not configured",
      timestamp,
    };
  }

  if (!prisma) {
    return {
      connected: false,
      error: "Prisma client not initialized",
      timestamp,
    };
  }

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, timestamp };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Prisma] Database connection test failed:", errorMessage);
    return {
      connected: false,
      error: errorMessage,
      timestamp,
    };
  }
}

export default prisma;
