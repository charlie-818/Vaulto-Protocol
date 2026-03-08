import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getApplicantById } from "@/lib/onboarding/sumsub";

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
        kycVerification: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.kycVerification) {
      return NextResponse.json({
        success: true,
        status: "NOT_STARTED",
        message: "KYC verification has not been initiated",
      });
    }

    const kyc = user.kycVerification;

    // If status is pending or in_review, check with Sumsub for updates
    if (
      kyc.sumsubApplicantId &&
      (kyc.status === "PENDING" || kyc.status === "IN_REVIEW")
    ) {
      const applicant = await getApplicantById(kyc.sumsubApplicantId);

      if (applicant?.review?.reviewStatus === "completed") {
        const reviewAnswer = applicant.review.reviewResult?.reviewAnswer;
        const newStatus = reviewAnswer === "GREEN" ? "APPROVED" : "REJECTED";

        // Update KYC status
        await getDb().kycVerification.update({
          where: { id: kyc.id },
          data: {
            status: newStatus,
            reviewResult: JSON.stringify(applicant.review.reviewResult),
            reviewedAt: new Date(),
          },
        });

        // Update user onboarding status
        await getDb().user.update({
          where: { id: user.id },
          data: {
            onboardingStatus:
              newStatus === "APPROVED" ? "KYC_APPROVED" : "KYC_REJECTED",
          },
        });

        return NextResponse.json({
          success: true,
          status: newStatus,
          reviewResult: applicant.review.reviewResult,
          reviewedAt: new Date().toISOString(),
        });
      }

      if (applicant?.review?.reviewStatus === "pending") {
        // Update to in_review if we're still pending
        if (kyc.status === "PENDING") {
          await getDb().kycVerification.update({
            where: { id: kyc.id },
            data: { status: "IN_REVIEW" },
          });

          await getDb().user.update({
            where: { id: user.id },
            data: { onboardingStatus: "KYC_IN_REVIEW" },
          });

          return NextResponse.json({
            success: true,
            status: "IN_REVIEW",
            message: "Your documents are being reviewed",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: kyc.status,
      initiatedAt: kyc.initiatedAt.toISOString(),
      submittedAt: kyc.submittedAt?.toISOString(),
      reviewedAt: kyc.reviewedAt?.toISOString(),
      documentVerified: kyc.documentVerified,
      livenessVerified: kyc.livenessVerified,
      amlScreeningPassed: kyc.amlScreeningPassed,
    });
  } catch (error) {
    console.error("KYC status error:", error);
    return NextResponse.json(
      { error: "Failed to get KYC status" },
      { status: 500 }
    );
  }
}
