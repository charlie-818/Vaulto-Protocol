import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getClientIp } from "@/lib/onboarding/geo-verify";
import crypto from "crypto";

const DECLARATION_TEXT = `I hereby declare that the funds I will use on Vaulto Protocol are derived from legitimate sources and are not proceeds of any criminal activity. I confirm that:

1. The funds come from the source(s) I have indicated in this declaration.
2. I am not engaging in money laundering, terrorist financing, or any other financial crime.
3. I understand that providing false information may result in account termination and potential legal action.
4. I agree to provide additional documentation if requested for enhanced due diligence purposes.

I acknowledge that Vaulto Protocol may monitor my transactions and report suspicious activity to relevant authorities as required by law.`;

const VALID_PRIMARY_SOURCES = [
  "employment",
  "self_employment",
  "business_ownership",
  "investments",
  "inheritance",
  "gift",
  "pension",
  "savings",
  "crypto_trading",
  "other",
];

const VALID_NET_WORTH_RANGES = [
  "under_10k",
  "10k_50k",
  "50k_100k",
  "100k_500k",
  "500k_1m",
  "1m_5m",
  "over_5m",
];

const VALID_TRADING_VOLUME_RANGES = [
  "under_1k",
  "1k_10k",
  "10k_50k",
  "50k_100k",
  "100k_500k",
  "over_500k",
];

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
        walletVerifications: {
          where: { status: "VERIFIED" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if wallet verification is complete
    if (user.walletVerifications.length === 0) {
      return NextResponse.json(
        { error: "Please complete wallet verification first" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      primarySource,
      secondarySources,
      employerName,
      occupation,
      estimatedNetWorth,
      expectedTradingVolume,
      hasDocumentation,
      documentationNotes,
      signatureHash,
    } = body;

    // Validate required fields
    if (!primarySource || !signatureHash) {
      return NextResponse.json(
        { error: "Missing required fields: primarySource, signatureHash" },
        { status: 400 }
      );
    }

    // Validate primary source
    if (!VALID_PRIMARY_SOURCES.includes(primarySource)) {
      return NextResponse.json(
        { error: "Invalid primary source" },
        { status: 400 }
      );
    }

    // Validate net worth range if provided
    if (estimatedNetWorth && !VALID_NET_WORTH_RANGES.includes(estimatedNetWorth)) {
      return NextResponse.json(
        { error: "Invalid net worth range" },
        { status: 400 }
      );
    }

    // Validate trading volume range if provided
    if (
      expectedTradingVolume &&
      !VALID_TRADING_VOLUME_RANGES.includes(expectedTradingVolume)
    ) {
      return NextResponse.json(
        { error: "Invalid trading volume range" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const ipAddress = getClientIp(headers);

    // Check if declaration already exists
    const existingDeclaration = await getDb().sourceOfFundsDeclaration.findUnique({
      where: { userId: user.id },
    });

    if (existingDeclaration?.isApproved) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        message: "Source of funds declaration already approved",
      });
    }

    // Create or update declaration
    const declaration = await getDb().sourceOfFundsDeclaration.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        primarySource,
        secondarySources: secondarySources || [],
        employerName,
        occupation,
        estimatedNetWorth,
        expectedTradingVolume,
        hasDocumentation: hasDocumentation || false,
        documentationNotes,
        declarationText: DECLARATION_TEXT,
        signatureHash,
        signedAt: new Date(),
        ipAddress,
        isApproved: true, // Auto-approve for now (manual review can be added)
        reviewedAt: new Date(),
      },
      update: {
        primarySource,
        secondarySources: secondarySources || [],
        employerName,
        occupation,
        estimatedNetWorth,
        expectedTradingVolume,
        hasDocumentation: hasDocumentation || false,
        documentationNotes,
        signatureHash,
        signedAt: new Date(),
        ipAddress,
        isApproved: true,
        reviewedAt: new Date(),
      },
    });

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "SOURCE_OF_FUNDS_APPROVED" },
    });

    await auditHelpers.sourceOfFundsSubmitted(
      user.id,
      declaration.id,
      primarySource,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      message: "Source of funds declaration submitted successfully",
    });
  } catch (error) {
    console.error("Source of funds error:", error);
    return NextResponse.json(
      { error: "Failed to submit declaration" },
      { status: 500 }
    );
  }
}

// Get declaration template and options
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
        sourceOfFundsDeclaration: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      declarationText: DECLARATION_TEXT,
      primarySources: VALID_PRIMARY_SOURCES,
      netWorthRanges: VALID_NET_WORTH_RANGES,
      tradingVolumeRanges: VALID_TRADING_VOLUME_RANGES,
      existingDeclaration: user.sourceOfFundsDeclaration
        ? {
            primarySource: user.sourceOfFundsDeclaration.primarySource,
            secondarySources: user.sourceOfFundsDeclaration.secondarySources,
            employerName: user.sourceOfFundsDeclaration.employerName,
            occupation: user.sourceOfFundsDeclaration.occupation,
            estimatedNetWorth: user.sourceOfFundsDeclaration.estimatedNetWorth,
            expectedTradingVolume:
              user.sourceOfFundsDeclaration.expectedTradingVolume,
            isApproved: user.sourceOfFundsDeclaration.isApproved,
            signedAt: user.sourceOfFundsDeclaration.signedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Get source of funds error:", error);
    return NextResponse.json(
      { error: "Failed to get declaration template" },
      { status: 500 }
    );
  }
}
