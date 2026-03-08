/**
 * Chainalysis Wallet Screening Integration
 *
 * Handles:
 * - Wallet address screening
 * - Sanctions checking
 * - Risk assessment
 */

import crypto from "crypto";

const USE_MOCK = process.env.USE_MOCK_PROVIDERS === "true";
const CHAINALYSIS_API_KEY = process.env.CHAINALYSIS_API_KEY || "";
const CHAINALYSIS_BASE_URL =
  process.env.CHAINALYSIS_BASE_URL || "https://api.chainalysis.com/api/kyt/v2";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";

export interface ScreeningResult {
  address: string;
  chainId: number;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  isSanctioned: boolean;
  isHighRisk: boolean;
  categories: string[];
  details: {
    sanctionsExposure: boolean;
    darknetExposure: boolean;
    mixerExposure: boolean;
    ransomwareExposure: boolean;
    stolenFundsExposure: boolean;
    scamExposure: boolean;
    terrorismExposure: boolean;
    childAbuseExposure: boolean;
  };
  screenedAt: Date;
  expiresAt: Date; // Screening results expire after 24 hours
}

export interface ChainalysisAlert {
  alertId: string;
  category: string;
  level: string;
  message: string;
}

// Known test addresses for mock mode
const MOCK_HIGH_RISK_ADDRESSES = new Set([
  "0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c", // Known high-risk address
  "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", // Tornado Cash
]);

const MOCK_SANCTIONED_ADDRESSES = new Set([
  "0x8589427373d6d84e98730d7795d8f6f8731fda16", // Tornado Cash (sanctioned)
  "0x722122df12d4e14e13ac3b6895a86e84145b6967", // Tornado Cash (sanctioned)
]);

function generateMockScreeningResult(
  address: string,
  chainId: number
): ScreeningResult {
  const normalizedAddress = address.toLowerCase();

  // Check for sanctioned addresses
  if (MOCK_SANCTIONED_ADDRESSES.has(normalizedAddress)) {
    return {
      address,
      chainId,
      riskLevel: "SEVERE",
      riskScore: 100,
      isSanctioned: true,
      isHighRisk: true,
      categories: ["sanctions", "mixer"],
      details: {
        sanctionsExposure: true,
        darknetExposure: false,
        mixerExposure: true,
        ransomwareExposure: false,
        stolenFundsExposure: false,
        scamExposure: false,
        terrorismExposure: false,
        childAbuseExposure: false,
      },
      screenedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  // Check for high-risk addresses
  if (MOCK_HIGH_RISK_ADDRESSES.has(normalizedAddress)) {
    return {
      address,
      chainId,
      riskLevel: "HIGH",
      riskScore: 75,
      isSanctioned: false,
      isHighRisk: true,
      categories: ["mixer", "darknet"],
      details: {
        sanctionsExposure: false,
        darknetExposure: true,
        mixerExposure: true,
        ransomwareExposure: false,
        stolenFundsExposure: false,
        scamExposure: false,
        terrorismExposure: false,
        childAbuseExposure: false,
      },
      screenedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  // Default: low risk address
  return {
    address,
    chainId,
    riskLevel: "LOW",
    riskScore: Math.floor(Math.random() * 15), // Random score 0-14
    isSanctioned: false,
    isHighRisk: false,
    categories: [],
    details: {
      sanctionsExposure: false,
      darknetExposure: false,
      mixerExposure: false,
      ransomwareExposure: false,
      stolenFundsExposure: false,
      scamExposure: false,
      terrorismExposure: false,
      childAbuseExposure: false,
    },
    screenedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

async function chainalysisRequest<T>(
  method: string,
  endpoint: string,
  body?: object
): Promise<T> {
  const response = await fetch(`${CHAINALYSIS_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Token: CHAINALYSIS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chainalysis API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Screen a wallet address for risk
 */
export async function screenWallet(
  address: string,
  chainId: number
): Promise<ScreeningResult> {
  if (USE_MOCK) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return generateMockScreeningResult(address, chainId);
  }

  // Map chain ID to Chainalysis asset identifier
  const asset = getAssetFromChainId(chainId);

  // Register the address first
  await chainalysisRequest("POST", "/users", {
    address,
    asset,
    userId: crypto.randomBytes(16).toString("hex"),
  });

  // Get the risk assessment
  interface ChainalysisRiskResponse {
    risk: string;
    riskReason?: string;
    cluster?: {
      category?: string;
      name?: string;
    };
    alerts?: ChainalysisAlert[];
  }

  const response = await chainalysisRequest<ChainalysisRiskResponse>(
    "GET",
    `/users/${address}`
  );

  return mapChainalysisResponse(address, chainId, response);
}

/**
 * Check if an address is sanctioned (quick check)
 */
export async function checkSanctions(address: string): Promise<boolean> {
  if (USE_MOCK) {
    return MOCK_SANCTIONED_ADDRESSES.has(address.toLowerCase());
  }

  try {
    interface SanctionsResponse {
      identifications: Array<{
        category: string;
        name: string;
        description: string;
      }>;
    }

    const response = await chainalysisRequest<SanctionsResponse>(
      "GET",
      `/sanctions/${address}`
    );
    return response.identifications && response.identifications.length > 0;
  } catch {
    return false;
  }
}

function getAssetFromChainId(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: "ETH", // Ethereum mainnet
    137: "MATIC", // Polygon
    10: "ETH", // Optimism (uses ETH)
    42161: "ETH", // Arbitrum (uses ETH)
    8453: "ETH", // Base (uses ETH)
    43114: "AVAX", // Avalanche
    56: "BNB", // BSC
  };
  return chainMap[chainId] || "ETH";
}

function mapChainalysisResponse(
  address: string,
  chainId: number,
  response: {
    risk: string;
    riskReason?: string;
    cluster?: { category?: string; name?: string };
    alerts?: ChainalysisAlert[];
  }
): ScreeningResult {
  const categories: string[] = [];
  const details = {
    sanctionsExposure: false,
    darknetExposure: false,
    mixerExposure: false,
    ransomwareExposure: false,
    stolenFundsExposure: false,
    scamExposure: false,
    terrorismExposure: false,
    childAbuseExposure: false,
  };

  // Parse alerts for categories
  if (response.alerts) {
    for (const alert of response.alerts) {
      const category = alert.category.toLowerCase();
      categories.push(category);

      if (category.includes("sanction")) details.sanctionsExposure = true;
      if (category.includes("darknet")) details.darknetExposure = true;
      if (category.includes("mixer") || category.includes("mixing"))
        details.mixerExposure = true;
      if (category.includes("ransomware")) details.ransomwareExposure = true;
      if (category.includes("stolen")) details.stolenFundsExposure = true;
      if (category.includes("scam")) details.scamExposure = true;
      if (category.includes("terror")) details.terrorismExposure = true;
      if (category.includes("child") || category.includes("csam"))
        details.childAbuseExposure = true;
    }
  }

  let riskLevel: RiskLevel = "LOW";
  let riskScore = 0;

  switch (response.risk?.toLowerCase()) {
    case "severe":
      riskLevel = "SEVERE";
      riskScore = 90;
      break;
    case "high":
      riskLevel = "HIGH";
      riskScore = 70;
      break;
    case "medium":
      riskLevel = "MEDIUM";
      riskScore = 40;
      break;
    default:
      riskLevel = "LOW";
      riskScore = 10;
  }

  const isSanctioned = details.sanctionsExposure;
  const isHighRisk = riskLevel === "HIGH" || riskLevel === "SEVERE";

  return {
    address,
    chainId,
    riskLevel,
    riskScore,
    isSanctioned,
    isHighRisk,
    categories,
    details,
    screenedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

/**
 * Determine if a wallet should be blocked based on screening
 */
export function shouldBlockWallet(result: ScreeningResult): {
  blocked: boolean;
  reason?: string;
} {
  if (result.isSanctioned) {
    return {
      blocked: true,
      reason: "Wallet is associated with sanctioned entities",
    };
  }

  if (result.riskLevel === "SEVERE") {
    return {
      blocked: true,
      reason: "Wallet has severe risk indicators",
    };
  }

  if (result.details.terrorismExposure) {
    return {
      blocked: true,
      reason: "Wallet has terrorism financing exposure",
    };
  }

  if (result.details.childAbuseExposure) {
    return {
      blocked: true,
      reason: "Wallet has child abuse material exposure",
    };
  }

  if (result.details.ransomwareExposure) {
    return {
      blocked: true,
      reason: "Wallet has ransomware exposure",
    };
  }

  // High risk requires manual review but not automatic block
  if (result.riskLevel === "HIGH") {
    return {
      blocked: false,
      reason: "Wallet requires enhanced due diligence",
    };
  }

  return { blocked: false };
}

/**
 * Mock helpers for testing
 */
export const mockHelpers = {
  addHighRiskAddress(address: string): void {
    if (USE_MOCK) {
      MOCK_HIGH_RISK_ADDRESSES.add(address.toLowerCase());
    }
  },

  addSanctionedAddress(address: string): void {
    if (USE_MOCK) {
      MOCK_SANCTIONED_ADDRESSES.add(address.toLowerCase());
    }
  },

  clearMockAddresses(): void {
    if (USE_MOCK) {
      MOCK_HIGH_RISK_ADDRESSES.clear();
      MOCK_SANCTIONED_ADDRESSES.clear();
    }
  },
};
