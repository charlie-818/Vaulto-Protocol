import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getClientIp } from "@/lib/onboarding/geo-verify";
import crypto from "crypto";

const ACKNOWLEDGMENT_DOCUMENT_VERSION = "1.0.0";

const ACKNOWLEDGMENTS = {
  volatility: {
    key: "acknowledgesVolatility",
    title: "Price Volatility",
    text: "I understand that synthetic tokens representing private company equity may experience extreme price volatility, and the value of my holdings can decrease significantly in a short period.",
  },
  liquidityRisk: {
    key: "acknowledgesLiquidityRisk",
    title: "Liquidity Risk",
    text: "I understand that there may be limited liquidity for these synthetic tokens, and I may not be able to sell my holdings at a desired price or time.",
  },
  regulatoryRisk: {
    key: "acknowledgesRegulatoryRisk",
    title: "Regulatory Risk",
    text: "I understand that the regulatory environment for synthetic securities and digital assets is evolving, and changes in laws or regulations may adversely affect my ability to trade or hold these tokens.",
  },
  noInsurance: {
    key: "acknowledgesNoInsurance",
    title: "No Insurance or Guarantees",
    text: "I understand that my holdings are not insured by any government agency and there are no guarantees of value or performance.",
  },
  lossRisk: {
    key: "acknowledgesLossRisk",
    title: "Risk of Total Loss",
    text: "I understand that I may lose all or a substantial portion of my investment, and I am financially prepared to bear such a loss.",
  },
  experimental: {
    key: "acknowledgesExperimental",
    title: "Experimental Technology",
    text: "I understand that synthetic tokens and blockchain technology are experimental, and there may be unforeseen technical risks, including smart contract bugs, network failures, or security vulnerabilities.",
  },
  regSCompliance: {
    key: "acknowledgesRegSCompliance",
    title: "Regulation S Compliance",
    text: "I understand that these tokens are offered under Regulation S exemption and are not registered with the U.S. Securities and Exchange Commission. I confirm that I am not a U.S. Person and will not resell these tokens to U.S. Persons during the distribution compliance period.",
  },
  transferRestrictions: {
    key: "acknowledgesTransferRestrictions",
    title: "Transfer Restrictions",
    text: "I understand that there are transfer restrictions on these tokens, including a 40-day distribution compliance period during which transfers may be restricted or require additional compliance checks.",
  },
};

function generateDocumentHash(): string {
  const documentContent = JSON.stringify(ACKNOWLEDGMENTS);
  return crypto.createHash("sha256").update(documentContent).digest("hex");
}

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
        sourceOfFundsDeclaration: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if source of funds is approved
    if (!user.sourceOfFundsDeclaration?.isApproved) {
      return NextResponse.json(
        { error: "Please complete source of funds declaration first" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      acknowledgesVolatility,
      acknowledgesLiquidityRisk,
      acknowledgesRegulatoryRisk,
      acknowledgesNoInsurance,
      acknowledgesLossRisk,
      acknowledgesExperimental,
      acknowledgesRegSCompliance,
      acknowledgesTransferRestrictions,
      signatureHash,
    } = body;

    // Validate all acknowledgments are true
    const allAcknowledgments = [
      acknowledgesVolatility,
      acknowledgesLiquidityRisk,
      acknowledgesRegulatoryRisk,
      acknowledgesNoInsurance,
      acknowledgesLossRisk,
      acknowledgesExperimental,
      acknowledgesRegSCompliance,
      acknowledgesTransferRestrictions,
    ];

    if (!allAcknowledgments.every((ack) => ack === true)) {
      return NextResponse.json(
        { error: "All risk acknowledgments must be accepted" },
        { status: 400 }
      );
    }

    if (!signatureHash) {
      return NextResponse.json(
        { error: "Signature is required" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const ipAddress = getClientIp(headers);
    const documentHash = generateDocumentHash();

    // Check if acknowledgment already exists
    const existingAcknowledgment = await getDb().riskAcknowledgment.findUnique({
      where: { userId: user.id },
    });

    if (existingAcknowledgment) {
      return NextResponse.json({
        success: true,
        alreadySigned: true,
        message: "Risk acknowledgments already signed",
      });
    }

    // Create acknowledgment record
    const acknowledgment = await getDb().riskAcknowledgment.create({
      data: {
        userId: user.id,
        acknowledgesVolatility,
        acknowledgesLiquidityRisk,
        acknowledgesRegulatoryRisk,
        acknowledgesNoInsurance,
        acknowledgesLossRisk,
        acknowledgesExperimental,
        acknowledgesRegSCompliance,
        acknowledgesTransferRestrictions,
        documentVersion: ACKNOWLEDGMENT_DOCUMENT_VERSION,
        documentHash,
        signatureHash,
        signedAt: new Date(),
        ipAddress,
      },
    });

    // Update user status
    await getDb().user.update({
      where: { id: user.id },
      data: { onboardingStatus: "RISK_ACKNOWLEDGMENT_PENDING" },
    });

    await auditHelpers.riskAcknowledgmentSigned(
      user.id,
      acknowledgment.id,
      ACKNOWLEDGMENT_DOCUMENT_VERSION,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      message: "Risk acknowledgments signed successfully",
    });
  } catch (error) {
    console.error("Risk acknowledgments error:", error);
    return NextResponse.json(
      { error: "Failed to submit acknowledgments" },
      { status: 500 }
    );
  }
}

// Get acknowledgment document
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
        riskAcknowledgment: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      documentVersion: ACKNOWLEDGMENT_DOCUMENT_VERSION,
      acknowledgments: Object.values(ACKNOWLEDGMENTS),
      documentHash: generateDocumentHash(),
      existingAcknowledgment: user.riskAcknowledgment
        ? {
            signedAt: user.riskAcknowledgment.signedAt.toISOString(),
            documentVersion: user.riskAcknowledgment.documentVersion,
          }
        : null,
    });
  } catch (error) {
    console.error("Get acknowledgments error:", error);
    return NextResponse.json(
      { error: "Failed to get acknowledgment document" },
      { status: 500 }
    );
  }
}
