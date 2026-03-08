import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { generateAccessToken } from "@/lib/onboarding/sumsub";

export async function POST() {
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
      return NextResponse.json(
        { error: "Please initialize KYC first" },
        { status: 400 }
      );
    }

    // Check if we have a valid token
    if (
      user.kycVerification.sumsubAccessToken &&
      user.kycVerification.tokenExpiresAt &&
      user.kycVerification.tokenExpiresAt > new Date()
    ) {
      return NextResponse.json({
        success: true,
        token: user.kycVerification.sumsubAccessToken,
        expiresAt: user.kycVerification.tokenExpiresAt.toISOString(),
      });
    }

    // Generate new access token
    const accessToken = await generateAccessToken(user.id);

    // Update KYC verification with new token
    await getDb().kycVerification.update({
      where: { id: user.kycVerification.id },
      data: {
        sumsubAccessToken: accessToken.token,
        tokenExpiresAt: accessToken.expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      token: accessToken.token,
      expiresAt: accessToken.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("KYC token error:", error);
    return NextResponse.json(
      { error: "Failed to generate access token" },
      { status: 500 }
    );
  }
}
