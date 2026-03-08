import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { createApplicant, getApplicantByExternalId } from "@/lib/onboarding/sumsub";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getClientIp } from "@/lib/onboarding/geo-verify";

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
        kycVerification: true,
        geoVerifications: {
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if geo verification is complete
    const latestGeoVerification = user.geoVerifications[0];
    if (!latestGeoVerification || latestGeoVerification.isBlocked) {
      return NextResponse.json(
        { error: "Please complete geo verification first" },
        { status: 400 }
      );
    }

    // Check if KYC already exists
    if (user.kycVerification?.sumsubApplicantId) {
      // Return existing applicant
      return NextResponse.json({
        success: true,
        applicantId: user.kycVerification.sumsubApplicantId,
        status: user.kycVerification.status,
        alreadyExists: true,
      });
    }

    // Check if applicant already exists in Sumsub
    const existingApplicant = await getApplicantByExternalId(user.id);

    if (existingApplicant) {
      // Update our records with existing applicant
      const kycVerification = await getDb().kycVerification.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          sumsubApplicantId: existingApplicant.id,
          status: "PENDING",
        },
        update: {
          sumsubApplicantId: existingApplicant.id,
        },
      });

      await getDb().user.update({
        where: { id: user.id },
        data: { onboardingStatus: "KYC_PENDING" },
      });

      const headers = request.headers;
      const ipAddress = getClientIp(headers);

      await auditHelpers.kycInitiated(
        user.id,
        kycVerification.id,
        existingApplicant.id,
        ipAddress
      );

      return NextResponse.json({
        success: true,
        applicantId: existingApplicant.id,
        status: "PENDING",
        alreadyExists: true,
      });
    }

    // Create new applicant in Sumsub
    const applicant = await createApplicant(user.id, session.user.email);

    // Create KYC verification record
    const kycVerification = await getDb().kycVerification.create({
      data: {
        userId: user.id,
        sumsubApplicantId: applicant.id,
        status: "PENDING",
      },
    });

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "KYC_PENDING" },
    });

    const headers = request.headers;
    const ipAddress = getClientIp(headers);

    await auditHelpers.kycInitiated(
      user.id,
      kycVerification.id,
      applicant.id,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      applicantId: applicant.id,
      status: "PENDING",
      alreadyExists: false,
    });
  } catch (error) {
    console.error("KYC init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize KYC" },
      { status: 500 }
    );
  }
}
