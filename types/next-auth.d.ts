import "next-auth";

// Define OnboardingStatus locally to avoid Prisma import dependency
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

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isVaultoEmployee?: boolean;
      onboardingStatus?: OnboardingStatus;
      isFullyOnboarded?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isVaultoEmployee?: boolean;
    onboardingStatus?: OnboardingStatus;
    userId?: string;
  }
}
