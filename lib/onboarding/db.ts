/**
 * Database utilities for onboarding
 */

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Check if database is available for onboarding operations
 * Returns an error response if not available
 */
export function requireDatabase(): NextResponse | null {
  if (!isDatabaseConfigured() || !prisma) {
    return NextResponse.json(
      {
        error: "Database not configured",
        message: "Onboarding features require database configuration. Please set DATABASE_URL.",
      },
      { status: 503 }
    );
  }
  return null;
}

/**
 * Get Prisma client with type assertion (use after requireDatabase check)
 */
export function getDb() {
  if (!prisma) {
    throw new Error("Database not configured");
  }
  return prisma;
}
