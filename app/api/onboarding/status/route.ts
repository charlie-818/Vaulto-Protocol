import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

export interface OnboardingStatusResponse {
  status: string;
  steps: {
    geoVerification: {
      completed: boolean;
      blocked: boolean;
      countryCode?: string;
      countryName?: string;
    };
    kycVerification: {
      completed: boolean;
      status?: string;
      initiatedAt?: string;
    };
    walletVerification: {
      completed: boolean;
      wallets: Array<{
        address: string;
        chainId: number;
        status: string;
        riskLevel?: string;
      }>;
    };
    sourceOfFunds: {
      completed: boolean;
      submittedAt?: string;
    };
    riskAcknowledgments: {
      completed: boolean;
      signedAt?: string;
    };
    compliancePeriod: {
      active: boolean;
      completed: boolean;
      startDate?: string;
      endDate?: string;
      daysRemaining?: number;
    };
  };
  canProceed: boolean;
  nextStep?: string;
  isFullyOnboarded: boolean;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const user = await getDb().user.findUnique({
      where: { email: session.user.email },
      include: {
        geoVerifications: {
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
        kycVerification: true,
        walletVerifications: true,
        sourceOfFundsDeclaration: true,
        riskAcknowledgment: true,
        compliancePeriod: true,
      },
    });

    if (!user) {
      // User doesn't exist yet - return initial state
      return NextResponse.json({
        status: "NOT_STARTED",
        steps: {
          geoVerification: { completed: false, blocked: false },
          kycVerification: { completed: false },
          walletVerification: { completed: false, wallets: [] },
          sourceOfFunds: { completed: false },
          riskAcknowledgments: { completed: false },
          compliancePeriod: { active: false, completed: false },
        },
        canProceed: true,
        nextStep: "GEO_VERIFICATION",
        isFullyOnboarded: false,
      } as OnboardingStatusResponse);
    }

    const latestGeo = user.geoVerifications[0];

    // Build status response
    const geoVerification = {
      completed: latestGeo && !latestGeo.isBlocked,
      blocked: latestGeo?.isBlocked || false,
      countryCode: latestGeo?.countryCode,
      countryName: latestGeo?.countryName,
    };

    const kycVerification = {
      completed: user.kycVerification?.status === "APPROVED",
      status: user.kycVerification?.status,
      initiatedAt: user.kycVerification?.initiatedAt?.toISOString(),
    };

    const walletVerification = {
      completed: user.walletVerifications.some((w) => w.status === "VERIFIED"),
      wallets: user.walletVerifications.map((w) => ({
        address: w.walletAddress,
        chainId: w.chainId,
        status: w.status,
        riskLevel: w.riskLevel || undefined,
      })),
    };

    const sourceOfFunds = {
      completed: user.sourceOfFundsDeclaration?.isApproved || false,
      submittedAt: user.sourceOfFundsDeclaration?.signedAt?.toISOString(),
    };

    const riskAcknowledgments = {
      completed: !!user.riskAcknowledgment,
      signedAt: user.riskAcknowledgment?.signedAt?.toISOString(),
    };

    const now = new Date();
    const compliancePeriod = {
      active:
        user.compliancePeriod?.isActive &&
        user.compliancePeriod.periodEndDate > now,
      completed:
        user.compliancePeriod?.isCompleted ||
        (user.compliancePeriod?.periodEndDate &&
          user.compliancePeriod.periodEndDate <= now),
      startDate: user.compliancePeriod?.periodStartDate?.toISOString(),
      endDate: user.compliancePeriod?.periodEndDate?.toISOString(),
      daysRemaining: user.compliancePeriod?.periodEndDate
        ? Math.max(
            0,
            Math.ceil(
              (user.compliancePeriod.periodEndDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : undefined,
    };

    // Determine next step
    let nextStep: string | undefined;
    let canProceed = true;

    if (geoVerification.blocked) {
      canProceed = false;
      nextStep = "BLOCKED";
    } else if (!geoVerification.completed) {
      nextStep = "GEO_VERIFICATION";
    } else if (!kycVerification.completed) {
      if (kycVerification.status === "REJECTED") {
        canProceed = false;
        nextStep = "KYC_REJECTED";
      } else if (kycVerification.status === "IN_REVIEW") {
        nextStep = "KYC_PENDING";
      } else {
        nextStep = "KYC_VERIFICATION";
      }
    } else if (!walletVerification.completed) {
      nextStep = "WALLET_VERIFICATION";
    } else if (!sourceOfFunds.completed) {
      nextStep = "SOURCE_OF_FUNDS";
    } else if (!riskAcknowledgments.completed) {
      nextStep = "RISK_ACKNOWLEDGMENTS";
    } else if (!compliancePeriod.active && !compliancePeriod.completed) {
      nextStep = "COMPLIANCE_PERIOD";
    } else if (compliancePeriod.active) {
      nextStep = "COMPLIANCE_PERIOD_ACTIVE";
    } else {
      nextStep = undefined;
    }

    const isFullyOnboarded =
      user.onboardingStatus === "FULLY_ONBOARDED" ||
      (compliancePeriod.completed === true && riskAcknowledgments.completed);

    return NextResponse.json({
      status: user.onboardingStatus,
      steps: {
        geoVerification,
        kycVerification,
        walletVerification,
        sourceOfFunds,
        riskAcknowledgments,
        compliancePeriod,
      },
      canProceed,
      nextStep,
      isFullyOnboarded,
    } as OnboardingStatusResponse);
  } catch (error) {
    console.error("Get onboarding status error:", error);
    return NextResponse.json(
      { error: "Failed to get onboarding status" },
      { status: 500 }
    );
  }
}
