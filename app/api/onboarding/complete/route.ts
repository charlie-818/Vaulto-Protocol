import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getClientIp } from "@/lib/onboarding/geo-verify";

const COMPLIANCE_PERIOD_DAYS = 40;

export async function POST(request: Request) {
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
        walletVerifications: {
          where: { status: "VERIFIED" },
        },
        sourceOfFundsDeclaration: true,
        riskAcknowledgment: true,
        compliancePeriod: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate all steps are complete
    const validationErrors: string[] = [];

    const latestGeo = user.geoVerifications[0];
    if (!latestGeo || latestGeo.isBlocked) {
      validationErrors.push("Geo verification not complete or blocked");
    }

    if (user.kycVerification?.status !== "APPROVED") {
      validationErrors.push("KYC verification not approved");
    }

    if (user.walletVerifications.length === 0) {
      validationErrors.push("No verified wallet found");
    }

    if (!user.sourceOfFundsDeclaration?.isApproved) {
      validationErrors.push("Source of funds declaration not approved");
    }

    if (!user.riskAcknowledgment) {
      validationErrors.push("Risk acknowledgments not signed");
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Onboarding steps incomplete",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const ipAddress = getClientIp(headers);

    // Check if compliance period already exists
    if (user.compliancePeriod) {
      // Check if compliance period is complete
      if (
        user.compliancePeriod.isCompleted ||
        user.compliancePeriod.periodEndDate <= new Date()
      ) {
        // User is fully onboarded
        if (user.onboardingStatus !== "FULLY_ONBOARDED") {
          await getDb().user.update({
            where: { id: user.id },
            data: { onboardingStatus: "FULLY_ONBOARDED" },
          });

          await getDb().compliancePeriod.update({
            where: { id: user.compliancePeriod.id },
            data: {
              isCompleted: true,
              completedAt: new Date(),
              isActive: false,
            },
          });

          await auditHelpers.onboardingCompleted(user.id, ipAddress);
        }

        return NextResponse.json({
          success: true,
          status: "FULLY_ONBOARDED",
          compliancePeriod: {
            startDate: user.compliancePeriod.periodStartDate.toISOString(),
            endDate: user.compliancePeriod.periodEndDate.toISOString(),
            isCompleted: true,
          },
        });
      }

      // Compliance period still active
      return NextResponse.json({
        success: true,
        status: "COMPLIANCE_PERIOD_ACTIVE",
        compliancePeriod: {
          startDate: user.compliancePeriod.periodStartDate.toISOString(),
          endDate: user.compliancePeriod.periodEndDate.toISOString(),
          daysRemaining: Math.ceil(
            (user.compliancePeriod.periodEndDate.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          ),
          isCompleted: false,
        },
      });
    }

    // Create compliance period
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + COMPLIANCE_PERIOD_DAYS);

    const compliancePeriod = await getDb().compliancePeriod.create({
      data: {
        userId: user.id,
        periodStartDate: startDate,
        periodEndDate: endDate,
        periodDays: COMPLIANCE_PERIOD_DAYS,
        isActive: true,
        acknowledgedAt: new Date(),
      },
    });

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "COMPLIANCE_PERIOD_ACTIVE" },
    });

    await auditHelpers.compliancePeriodStarted(
      user.id,
      compliancePeriod.id,
      startDate,
      endDate,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      status: "COMPLIANCE_PERIOD_ACTIVE",
      message: `Your ${COMPLIANCE_PERIOD_DAYS}-day compliance period has begun. You will have full access to the platform during this time.`,
      compliancePeriod: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysRemaining: COMPLIANCE_PERIOD_DAYS,
        isCompleted: false,
      },
    });
  } catch (error) {
    console.error("Complete onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
