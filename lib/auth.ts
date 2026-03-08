import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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
      console.log("User signed in:", user.email);

      // Only try database operations if database is configured
      if (user.email && isDatabaseConfigured() && prisma) {
        try {
          console.log("Attempting to save user to database...");
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
          console.log("User saved successfully:", savedUser.id);
        } catch (error) {
          console.error("Failed to upsert user:", error);
          // Don't block sign-in on database errors
        }
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        token.isVaultoEmployee = user.email.endsWith("@vaulto.ai");
      }

      // Only fetch onboarding status if database is configured
      if (token.email && isDatabaseConfigured() && prisma && (trigger === "signIn" || trigger === "update")) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { id: true, onboardingStatus: true },
          });

          if (dbUser) {
            token.userId = dbUser.id;
            token.onboardingStatus = dbUser.onboardingStatus;
          }
        } catch (error) {
          console.error("Failed to fetch user onboarding status:", error);
          // Continue without onboarding status - will be treated as not onboarded
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isVaultoEmployee = token.isVaultoEmployee as boolean;
        session.user.id = token.userId as string;
        session.user.onboardingStatus = token.onboardingStatus as OnboardingStatus;
        session.user.isFullyOnboarded = isFullyOnboarded(token.onboardingStatus as OnboardingStatus);
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
