/**
 * Sumsub KYC/AML Integration
 *
 * Handles:
 * - Applicant creation
 * - Access token generation for WebSDK
 * - Webhook signature verification
 * - Status updates
 */

import crypto from "crypto";

const USE_MOCK = process.env.USE_MOCK_PROVIDERS === "true";
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || "";
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || "";
const SUMSUB_BASE_URL =
  process.env.SUMSUB_BASE_URL || "https://api.sumsub.com";
const SUMSUB_WEBHOOK_SECRET = process.env.SUMSUB_WEBHOOK_SECRET || "";

// Level name for Vaulto Protocol KYC flow
const KYC_LEVEL_NAME = "vaulto-basic-kyc";

export interface SumsubApplicant {
  id: string;
  createdAt: string;
  key: string;
  clientId?: string;
  inspectionId?: string;
  externalUserId: string;
  info?: {
    firstName?: string;
    lastName?: string;
    country?: string;
  };
  email?: string;
  phone?: string;
  review?: {
    reviewId?: string;
    attemptId?: string;
    attemptCnt?: number;
    levelName?: string;
    createDate?: string;
    reviewStatus?: string;
    reviewResult?: {
      reviewAnswer?: string;
      label?: string;
      rejectLabels?: string[];
      clientComment?: string;
      moderationComment?: string;
    };
  };
}

export interface SumsubAccessToken {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface SumsubWebhookPayload {
  applicantId: string;
  inspectionId?: string;
  correlationId?: string;
  levelName?: string;
  externalUserId?: string;
  type: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer: string;
    label?: string;
    rejectLabels?: string[];
    clientComment?: string;
    moderationComment?: string;
  };
  createdAt?: string;
  applicantType?: string;
  sandboxMode?: boolean;
}

// Mock data for development
const mockApplicants: Map<string, SumsubApplicant> = new Map();

function generateMockApplicantId(): string {
  return `mock_${crypto.randomBytes(12).toString("hex")}`;
}

function generateSignature(
  method: string,
  url: string,
  timestamp: number,
  body?: string
): string {
  const data = timestamp + method.toUpperCase() + url + (body || "");
  return crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(data)
    .digest("hex");
}

async function sumsubRequest<T>(
  method: string,
  endpoint: string,
  body?: object
): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = endpoint;
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const signature = generateSignature(method, url, timestamp, bodyStr);

  const response = await fetch(`${SUMSUB_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": SUMSUB_APP_TOKEN,
      "X-App-Access-Sig": signature,
      "X-App-Access-Ts": timestamp.toString(),
    },
    body: bodyStr,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sumsub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Create a new Sumsub applicant for KYC verification
 */
export async function createApplicant(
  externalUserId: string,
  email: string
): Promise<SumsubApplicant> {
  if (USE_MOCK) {
    const applicantId = generateMockApplicantId();
    const mockApplicant: SumsubApplicant = {
      id: applicantId,
      createdAt: new Date().toISOString(),
      key: applicantId,
      externalUserId,
      email,
      review: {
        levelName: KYC_LEVEL_NAME,
        reviewStatus: "init",
      },
    };
    mockApplicants.set(externalUserId, mockApplicant);
    return mockApplicant;
  }

  return sumsubRequest<SumsubApplicant>("POST", "/resources/applicants", {
    externalUserId,
    email,
    levelName: KYC_LEVEL_NAME,
  });
}

/**
 * Get applicant by external user ID
 */
export async function getApplicantByExternalId(
  externalUserId: string
): Promise<SumsubApplicant | null> {
  if (USE_MOCK) {
    return mockApplicants.get(externalUserId) || null;
  }

  try {
    return await sumsubRequest<SumsubApplicant>(
      "GET",
      `/resources/applicants/-;externalUserId=${externalUserId}/one`
    );
  } catch {
    return null;
  }
}

/**
 * Get applicant by Sumsub applicant ID
 */
export async function getApplicantById(
  applicantId: string
): Promise<SumsubApplicant | null> {
  if (USE_MOCK) {
    for (const [, applicant] of mockApplicants) {
      if (applicant.id === applicantId) {
        return applicant;
      }
    }
    return null;
  }

  try {
    return await sumsubRequest<SumsubApplicant>(
      "GET",
      `/resources/applicants/${applicantId}/one`
    );
  } catch {
    return null;
  }
}

/**
 * Generate access token for Sumsub WebSDK
 */
export async function generateAccessToken(
  externalUserId: string
): Promise<SumsubAccessToken> {
  if (USE_MOCK) {
    const mockToken = `mock_token_${crypto.randomBytes(16).toString("hex")}`;
    return {
      token: mockToken,
      userId: externalUserId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  const response = await sumsubRequest<{ token: string }>(
    "POST",
    `/resources/accessTokens?userId=${externalUserId}&levelName=${KYC_LEVEL_NAME}`
  );

  return {
    token: response.token,
    userId: externalUserId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  };
}

/**
 * Verify Sumsub webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (USE_MOCK) {
    return true;
  }

  const computedSignature = crypto
    .createHmac("sha1", SUMSUB_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

/**
 * Parse and validate webhook payload
 */
export function parseWebhookPayload(payload: string): SumsubWebhookPayload {
  return JSON.parse(payload) as SumsubWebhookPayload;
}

/**
 * Map Sumsub review status to our KycStatus
 */
export function mapReviewStatus(
  reviewStatus: string,
  reviewAnswer?: string
): "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" {
  if (reviewStatus === "completed") {
    if (reviewAnswer === "GREEN") return "APPROVED";
    if (reviewAnswer === "RED") return "REJECTED";
  }
  if (reviewStatus === "pending") return "IN_REVIEW";
  if (reviewStatus === "init") return "PENDING";
  return "PENDING";
}

/**
 * Mock functions for testing the full flow
 */
export const mockHelpers = {
  /**
   * Simulate KYC approval (for testing)
   */
  approveKyc(externalUserId: string): void {
    if (!USE_MOCK) return;
    const applicant = mockApplicants.get(externalUserId);
    if (applicant) {
      applicant.review = {
        ...applicant.review,
        reviewStatus: "completed",
        reviewResult: {
          reviewAnswer: "GREEN",
        },
      };
      mockApplicants.set(externalUserId, applicant);
    }
  },

  /**
   * Simulate KYC rejection (for testing)
   */
  rejectKyc(externalUserId: string, reason: string): void {
    if (!USE_MOCK) return;
    const applicant = mockApplicants.get(externalUserId);
    if (applicant) {
      applicant.review = {
        ...applicant.review,
        reviewStatus: "completed",
        reviewResult: {
          reviewAnswer: "RED",
          rejectLabels: [reason],
          clientComment: reason,
        },
      };
      mockApplicants.set(externalUserId, applicant);
    }
  },

  /**
   * Get mock applicant for testing
   */
  getMockApplicant(externalUserId: string): SumsubApplicant | undefined {
    return mockApplicants.get(externalUserId);
  },
};
