import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { PrismaClient } from "@prisma/client";

// Onboarding status type (defined locally to avoid import issues when DB not configured)
type OnboardingStatus =
  | "NOT_STARTED"
  | "GEO_CHECK_PENDING"
  | "GEO_CHECK_PASSED"
  | "GEO_BLOCKED"
  | "KYC_PENDING"
  | "KYC_IN_REVIEW"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "WALLET_PENDING"
  | "WALLET_APPROVED"
  | "WALLET_REJECTED"
  | "SOURCE_OF_FUNDS_PENDING"
  | "SOURCE_OF_FUNDS_APPROVED"
  | "RISK_ACKNOWLEDGMENT_PENDING"
  | "COMPLIANCE_PERIOD_ACTIVE"
  | "FULLY_ONBOARDED"
  | "SUSPENDED";

// Helper to check if user is fully onboarded
function isFullyOnboarded(status: OnboardingStatus | undefined): boolean {
  return status === "FULLY_ONBOARDED" || status === "COMPLIANCE_PERIOD_ACTIVE";
}

// Check if database is configured (without importing prisma)
function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!(databaseUrl && databaseUrl.length > 0);
}

// Check if we're running in Edge runtime (middleware)
function isEdgeRuntime(): boolean {
  return typeof (globalThis as Record<string, unknown>).EdgeRuntime === "string";
}

// Global prisma accessor - set by prisma.ts when it initializes
const globalForPrisma = globalThis as unknown as {
  __vaulto_prisma?: PrismaClient | null;
};

// Get prisma client from global storage - returns null in Edge runtime
function getPrisma(): PrismaClient | null {
  // Don't try to use prisma in Edge runtime
  if (isEdgeRuntime()) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    return null;
  }

  // Check if prisma is available in global storage
  if (globalForPrisma.__vaulto_prisma) {
    return globalForPrisma.__vaulto_prisma;
  }

  // Prisma not yet initialized - this can happen if auth callback runs
  // before any API route that imports prisma
  console.warn("[Auth] Prisma not yet initialized in global storage");
  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ user }) {
      // Skip database operations in Edge runtime (middleware context)
      if (isEdgeRuntime()) {
        return true;
      }

      console.log("[Auth] Sign-in callback triggered for:", user.email);
      console.log("[Auth] Database configured:", isDatabaseConfigured());

      // Only try database operations if database is configured
      if (user.email && isDatabaseConfigured()) {
        const prisma = getPrisma();
        console.log("[Auth] Prisma client available:", !!prisma);

        if (prisma) {
          try {
            console.log("[Auth] Attempting to upsert user to database...");

            const savedUser = await prisma.user.upsert({
              where: { email: user.email },
              create: {
                email: user.email,
                name: user.name,
                image: user.image,
                isVaultoEmployee: user.email.endsWith("@vaulto.ai"),
              },
              update: {
                name: user.name,
                image: user.image,
                isVaultoEmployee: user.email.endsWith("@vaulto.ai"),
              },
            });

            console.log(
              "[Auth] User saved successfully:",
              JSON.stringify({
                id: savedUser.id,
                email: savedUser.email,
                onboardingStatus: savedUser.onboardingStatus,
                createdAt: savedUser.createdAt,
              })
            );
          } catch (error) {
            // Log detailed error information for debugging
            console.error("[Auth] Failed to upsert user:", {
              email: user.email,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              errorType: error?.constructor?.name,
            });

            // In production, we still allow sign-in even if DB fails
            // But we log extensively to help debug
            if (process.env.NODE_ENV === "production") {
              console.error(
                "[Auth] CRITICAL: User not saved to database in production!"
              );
            }
          }
        }
      } else {
        // Log why we're not saving to DB
        console.warn("[Auth] Skipping database save:", {
          hasEmail: !!user.email,
          isDatabaseConfigured: isDatabaseConfigured(),
          databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
        });
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.email) {
        token.isVaultoEmployee = user.email.endsWith("@vaulto.ai");
      }

      // Skip database operations in Edge runtime
      if (isEdgeRuntime()) {
        return token;
      }

      // Only fetch onboarding status if database is configured
      if (
        token.email &&
        isDatabaseConfigured() &&
        (trigger === "signIn" || trigger === "update")
      ) {
        const prisma = getPrisma();

        if (prisma) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: token.email as string },
              select: { id: true, onboardingStatus: true },
            });

            if (dbUser) {
              token.userId = dbUser.id;
              token.onboardingStatus = dbUser.onboardingStatus;
              console.log("[Auth] JWT updated with user data:", {
                userId: dbUser.id,
                onboardingStatus: dbUser.onboardingStatus,
              });
            } else {
              console.warn("[Auth] User not found in database:", token.email);
            }
          } catch (error) {
            console.error("[Auth] Failed to fetch user onboarding status:", {
              email: token.email,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue without onboarding status - will be treated as not onboarded
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.isVaultoEmployee = token.isVaultoEmployee as boolean;
        session.user.id = token.userId as string;
        session.user.onboardingStatus = token.onboardingStatus as OnboardingStatus;
        session.user.isFullyOnboarded = isFullyOnboarded(
          token.onboardingStatus as OnboardingStatus
        );
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // If the URL contains a callback, use it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return `${baseUrl}/waitlist-success`;
    },
  },
});
