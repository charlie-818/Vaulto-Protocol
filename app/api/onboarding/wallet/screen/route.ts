import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { screenWallet, shouldBlockWallet } from "@/lib/onboarding/chainalysis";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getClientIp } from "@/lib/onboarding/geo-verify";
import { verifyMessage } from "viem";
import crypto from "crypto";

const OWNERSHIP_MESSAGE_PREFIX = "I am verifying my wallet ownership for Vaulto Protocol.\n\nWallet: ";
const OWNERSHIP_MESSAGE_SUFFIX = "\nTimestamp: ";

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
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if KYC is approved
    if (user.kycVerification?.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Please complete KYC verification first" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { walletAddress, chainId, signature, timestamp } = body;

    if (!walletAddress || !chainId || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: walletAddress, chainId, signature, timestamp" },
        { status: 400 }
      );
    }

    // Verify the signature
    const message = `${OWNERSHIP_MESSAGE_PREFIX}${walletAddress}${OWNERSHIP_MESSAGE_SUFFIX}${timestamp}`;

    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid signature format" },
        { status: 400 }
      );
    }

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 400 }
      );
    }

    // Check if timestamp is within acceptable range (5 minutes)
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (Math.abs(now.getTime() - timestampDate.getTime()) > fiveMinutes) {
      return NextResponse.json(
        { error: "Signature timestamp expired" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const ipAddress = getClientIp(headers);

    // Check if wallet already verified for this user
    const existingVerification = await getDb().walletVerification.findUnique({
      where: {
        userId_walletAddress: {
          userId: user.id,
          walletAddress: walletAddress.toLowerCase(),
        },
      },
    });

    if (existingVerification?.status === "VERIFIED") {
      return NextResponse.json({
        success: true,
        status: "VERIFIED",
        alreadyVerified: true,
        riskLevel: existingVerification.riskLevel,
      });
    }

    // Create or update wallet verification record
    const signatureHash = crypto
      .createHash("sha256")
      .update(signature)
      .digest("hex");

    const walletVerification = await getDb().walletVerification.upsert({
      where: {
        userId_walletAddress: {
          userId: user.id,
          walletAddress: walletAddress.toLowerCase(),
        },
      },
      create: {
        userId: user.id,
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        signatureMessage: message,
        signatureHash,
        ownershipVerified: true,
        ownershipVerifiedAt: new Date(),
        status: "PENDING",
        isPrimary: true,
      },
      update: {
        signatureMessage: message,
        signatureHash,
        ownershipVerified: true,
        ownershipVerifiedAt: new Date(),
        status: "PENDING",
      },
    });

    // Log wallet connection
    await auditHelpers.walletConnected(
      user.id,
      walletVerification.id,
      walletAddress,
      chainId,
      ipAddress
    );

    // Screen wallet with Chainalysis
    const screeningResult = await screenWallet(walletAddress, chainId);

    const blockDecision = shouldBlockWallet(screeningResult);

    // Update wallet verification with screening results
    const updatedVerification = await getDb().walletVerification.update({
      where: { id: walletVerification.id },
      data: {
        status: blockDecision.blocked ? "REJECTED" : "VERIFIED",
        riskLevel: screeningResult.riskLevel,
        screeningScore: screeningResult.riskScore,
        isSanctioned: screeningResult.isSanctioned,
        isHighRisk: screeningResult.isHighRisk,
        riskCategories: screeningResult.categories,
        screenedAt: screeningResult.screenedAt,
        screeningExpires: screeningResult.expiresAt,
        rawResponseHash: crypto
          .createHash("sha256")
          .update(JSON.stringify(screeningResult))
          .digest("hex"),
      },
    });

    if (blockDecision.blocked) {
      // Update user status
      await getDb().user.update({
        where: { id: user.id },
        data: { onboardingStatus: "WALLET_REJECTED" },
      });

      await auditHelpers.walletRejected(
        user.id,
        walletVerification.id,
        blockDecision.reason || "High risk wallet",
        ipAddress
      );

      return NextResponse.json({
        success: false,
        status: "REJECTED",
        reason: blockDecision.reason,
        riskLevel: screeningResult.riskLevel,
      });
    }

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "WALLET_APPROVED" },
    });

    await auditHelpers.walletVerified(
      user.id,
      walletVerification.id,
      screeningResult.riskLevel,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      status: "VERIFIED",
      riskLevel: screeningResult.riskLevel,
      riskScore: screeningResult.riskScore,
    });
  } catch (error) {
    console.error("Wallet screening error:", error);
    return NextResponse.json(
      { error: "Failed to screen wallet" },
      { status: 500 }
    );
  }
}

// Generate ownership verification message
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const message = `${OWNERSHIP_MESSAGE_PREFIX}${walletAddress}${OWNERSHIP_MESSAGE_SUFFIX}${timestamp}`;

    return NextResponse.json({
      message,
      timestamp,
    });
  } catch (error) {
    console.error("Get verification message error:", error);
    return NextResponse.json(
      { error: "Failed to generate verification message" },
      { status: 500 }
    );
  }
}
