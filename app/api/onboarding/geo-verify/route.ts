import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  verifyGeo,
  getClientIp,
  getNonUsDeclarationText,
} from "@/lib/onboarding/geo-verify";
import { auditHelpers } from "@/lib/onboarding/audit";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    // Get or create user
    let user = await getDb().user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      user = await getDb().user.create({
        data: {
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          isVaultoEmployee: session.user.isVaultoEmployee || false,
        },
      });
    }

    // Get client IP
    const headers = request.headers;
    const ipAddress = getClientIp(headers);
    const userAgent = headers.get("user-agent") || undefined;

    // Log geo check initiation
    await auditHelpers.geoCheckInitiated(user.id, ipAddress, userAgent);

    // Perform geo verification
    const geoResult = await verifyGeo(ipAddress);

    // Check if user is declaring non-US status
    const body = await request.json().catch(() => ({}));
    const declaredNonUs = body.declaredNonUs === true;
    const declaredCountry = body.declaredCountry as string | undefined;

    // Create geo verification record
    const geoVerification = await getDb().geoVerification.create({
      data: {
        userId: user.id,
        ipAddress: geoResult.ipAddress,
        countryCode: geoResult.countryCode,
        countryName: geoResult.countryName,
        city: geoResult.city,
        region: geoResult.region,
        isVpnDetected: geoResult.isVpnDetected,
        isProxyDetected: geoResult.isProxyDetected,
        isTorDetected: geoResult.isTorDetected,
        isBlocked: geoResult.isBlocked,
        blockReason: geoResult.blockReason,
        declaredNonUs,
        declaredCountry,
        declarationSignedAt: declaredNonUs ? new Date() : null,
        rawResponseHash: geoResult.rawResponseHash,
      },
    });

    if (geoResult.isBlocked) {
      // Update user status to blocked
      await getDb().user.update({
        where: { id: user.id },
        data: { onboardingStatus: "GEO_BLOCKED" },
      });

      // Log the block
      await auditHelpers.geoCheckBlocked(
        user.id,
        geoVerification.id,
        geoResult.blockReason || "UNKNOWN",
        ipAddress
      );

      return NextResponse.json({
        success: false,
        blocked: true,
        reason: geoResult.blockReason,
        countryCode: geoResult.countryCode,
        countryName: geoResult.countryName,
      });
    }

    // Update user status to passed
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "GEO_CHECK_PASSED" },
    });

    // Log success
    await auditHelpers.geoCheckPassed(
      user.id,
      geoVerification.id,
      geoResult.countryCode,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      blocked: false,
      countryCode: geoResult.countryCode,
      countryName: geoResult.countryName,
      requiresDeclaration: !declaredNonUs,
      declarationText: !declaredNonUs ? getNonUsDeclarationText() : null,
    });
  } catch (error) {
    console.error("Geo verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify geolocation" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const user = await getDb().user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { declaredNonUs, declaredCountry, signatureHash } = body;

    if (!declaredNonUs || !declaredCountry || !signatureHash) {
      return NextResponse.json(
        { error: "Missing required declaration fields" },
        { status: 400 }
      );
    }

    // Get the most recent geo verification
    const latestGeoVerification = await getDb().geoVerification.findFirst({
      where: { userId: user.id },
      orderBy: { verifiedAt: "desc" },
    });

    if (!latestGeoVerification) {
      return NextResponse.json(
        { error: "No geo verification found. Please verify your location first." },
        { status: 400 }
      );
    }

    // Update the geo verification with declaration
    await getDb().geoVerification.update({
      where: { id: latestGeoVerification.id },
      data: {
        declaredNonUs: true,
        declaredCountry,
        declarationSignedAt: new Date(),
      },
    });

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "KYC_PENDING" },
    });

    const headers = request.headers;
    const ipAddress = getClientIp(headers);

    await auditHelpers.geoCheckPassed(
      user.id,
      latestGeoVerification.id,
      declaredCountry,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      message: "Declaration submitted successfully",
    });
  } catch (error) {
    console.error("Declaration submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit declaration" },
      { status: 500 }
    );
  }
}
