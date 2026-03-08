/**
 * MaxMind GeoIP2 Integration for Geo-Verification
 *
 * Handles:
 * - IP geolocation
 * - VPN/Proxy/Tor detection
 * - Country blocking for Reg S compliance
 */

import crypto from "crypto";

const USE_MOCK = process.env.USE_MOCK_PROVIDERS === "true";
const MAXMIND_ACCOUNT_ID = process.env.MAXMIND_ACCOUNT_ID || "";
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY || "";
const MAXMIND_BASE_URL = "https://geoip.maxmind.com/geoip/v2.1";

// Countries blocked for Reg S compliance
export const BLOCKED_COUNTRIES = {
  // US - Primary Reg S exclusion
  US: "United States of America",

  // OFAC Sanctioned countries
  CU: "Cuba",
  IR: "Iran",
  KP: "North Korea",
  SY: "Syria",
  RU: "Russia", // Partial sanctions

  // High-risk jurisdictions
  MM: "Myanmar",
  BY: "Belarus",
  VE: "Venezuela",
  ZW: "Zimbabwe",
} as const;

export type BlockedCountryCode = keyof typeof BLOCKED_COUNTRIES;

export interface GeoVerificationResult {
  ipAddress: string;
  countryCode: string;
  countryName: string;
  city?: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isVpnDetected: boolean;
  isProxyDetected: boolean;
  isTorDetected: boolean;
  isHostingProvider: boolean;
  isBlocked: boolean;
  blockReason?: string;
  confidence: number; // 0-100
  rawResponseHash?: string;
}

// Mock IP patterns for testing
const MOCK_US_IPS = [
  "8.8.8.8",
  "1.2.3.4",
  "192.168.1.1", // These would be US IPs in mock
];

const MOCK_VPN_IPS = ["10.0.0.1", "172.16.0.1"];

function generateMockGeoResult(ipAddress: string): GeoVerificationResult {
  // Check for localhost/private IPs
  if (
    ipAddress === "127.0.0.1" ||
    ipAddress === "::1" ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("10.")
  ) {
    // Treat localhost as non-US for development
    return {
      ipAddress,
      countryCode: "GB", // UK for development
      countryName: "United Kingdom",
      city: "London",
      region: "England",
      isVpnDetected: false,
      isProxyDetected: false,
      isTorDetected: false,
      isHostingProvider: false,
      isBlocked: false,
      confidence: 100,
    };
  }

  // Check for mock US IPs
  if (MOCK_US_IPS.includes(ipAddress)) {
    return {
      ipAddress,
      countryCode: "US",
      countryName: "United States of America",
      city: "Mountain View",
      region: "California",
      isVpnDetected: false,
      isProxyDetected: false,
      isTorDetected: false,
      isHostingProvider: false,
      isBlocked: true,
      blockReason: "US_INVESTOR",
      confidence: 99,
    };
  }

  // Check for mock VPN IPs
  if (MOCK_VPN_IPS.includes(ipAddress)) {
    return {
      ipAddress,
      countryCode: "NL",
      countryName: "Netherlands",
      city: "Amsterdam",
      region: "North Holland",
      isVpnDetected: true,
      isProxyDetected: false,
      isTorDetected: false,
      isHostingProvider: true,
      isBlocked: true,
      blockReason: "VPN_DETECTED",
      confidence: 50,
    };
  }

  // Default: Non-US location
  return {
    ipAddress,
    countryCode: "GB",
    countryName: "United Kingdom",
    city: "London",
    region: "England",
    isVpnDetected: false,
    isProxyDetected: false,
    isTorDetected: false,
    isHostingProvider: false,
    isBlocked: false,
    confidence: 95,
  };
}

async function maxmindRequest(ipAddress: string): Promise<{
  country?: { iso_code?: string; names?: { en?: string } };
  city?: { names?: { en?: string } };
  subdivisions?: Array<{ names?: { en?: string } }>;
  postal?: { code?: string };
  location?: { latitude?: number; longitude?: number; time_zone?: string };
  traits?: {
    is_anonymous_vpn?: boolean;
    is_anonymous_proxy?: boolean;
    is_tor_exit_node?: boolean;
    is_hosting_provider?: boolean;
    ip_address?: string;
  };
}> {
  const auth = Buffer.from(
    `${MAXMIND_ACCOUNT_ID}:${MAXMIND_LICENSE_KEY}`
  ).toString("base64");

  const response = await fetch(
    `${MAXMIND_BASE_URL}/insights/${ipAddress}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MaxMind API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Verify IP geolocation and check for blocking criteria
 */
export async function verifyGeo(ipAddress: string): Promise<GeoVerificationResult> {
  if (USE_MOCK) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    return generateMockGeoResult(ipAddress);
  }

  const response = await maxmindRequest(ipAddress);

  const countryCode = response.country?.iso_code || "XX";
  const countryName = response.country?.names?.en || "Unknown";

  const isVpnDetected = response.traits?.is_anonymous_vpn || false;
  const isProxyDetected = response.traits?.is_anonymous_proxy || false;
  const isTorDetected = response.traits?.is_tor_exit_node || false;
  const isHostingProvider = response.traits?.is_hosting_provider || false;

  // Determine if blocked
  let isBlocked = false;
  let blockReason: string | undefined;

  // Check country blocking
  if (countryCode in BLOCKED_COUNTRIES) {
    isBlocked = true;
    if (countryCode === "US") {
      blockReason = "US_INVESTOR";
    } else {
      blockReason = "SANCTIONED_COUNTRY";
    }
  }

  // Check VPN/Proxy/Tor
  if (isVpnDetected || isProxyDetected || isTorDetected) {
    isBlocked = true;
    if (isVpnDetected) blockReason = "VPN_DETECTED";
    else if (isProxyDetected) blockReason = "PROXY_DETECTED";
    else if (isTorDetected) blockReason = "TOR_DETECTED";
  }

  // Hash the raw response for audit purposes
  const rawResponseHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(response))
    .digest("hex");

  return {
    ipAddress,
    countryCode,
    countryName,
    city: response.city?.names?.en,
    region: response.subdivisions?.[0]?.names?.en,
    postalCode: response.postal?.code,
    latitude: response.location?.latitude,
    longitude: response.location?.longitude,
    timezone: response.location?.time_zone,
    isVpnDetected,
    isProxyDetected,
    isTorDetected,
    isHostingProvider,
    isBlocked,
    blockReason,
    confidence: 90, // MaxMind doesn't provide confidence, use default
    rawResponseHash,
  };
}

/**
 * Check if a country is blocked
 */
export function isCountryBlocked(countryCode: string): boolean {
  return countryCode in BLOCKED_COUNTRIES;
}

/**
 * Get the reason for blocking a country
 */
export function getBlockReason(countryCode: string): string | undefined {
  if (countryCode === "US") {
    return "US_INVESTOR";
  }
  if (countryCode in BLOCKED_COUNTRIES) {
    return "SANCTIONED_COUNTRY";
  }
  return undefined;
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(headers: Headers): string {
  // Check various headers for the real IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (client IP)
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to localhost for development
  return "127.0.0.1";
}

/**
 * Generate the non-US declaration text
 */
export function getNonUsDeclarationText(): string {
  return `I hereby declare under penalty of perjury that:

1. I am not a "U.S. Person" as defined in Regulation S under the Securities Act of 1933, as amended.

2. I am not acquiring these tokens for the account or benefit of any U.S. Person.

3. I understand that the tokens being offered are not registered under the U.S. Securities Act of 1933, as amended, and may not be offered or sold in the United States or to U.S. Persons absent registration or an applicable exemption from registration requirements.

4. I agree that I will not resell or transfer these tokens to any U.S. Person or within the United States during the applicable distribution compliance period.

5. I acknowledge that I have had the opportunity to ask questions and receive answers concerning the terms and conditions of this offering and have had access to such additional information as I have deemed necessary to verify the accuracy of the information provided.

6. I understand that Vaulto Protocol reserves the right to refuse or cancel any transaction if it determines that the purchaser is a U.S. Person or if the transaction would otherwise violate applicable securities laws.

This declaration is accurate and complete as of the date signed.`;
}

/**
 * Mock helpers for testing
 */
export const mockHelpers = {
  setMockUsIp(ipAddress: string): void {
    if (USE_MOCK) {
      MOCK_US_IPS.push(ipAddress);
    }
  },

  setMockVpnIp(ipAddress: string): void {
    if (USE_MOCK) {
      MOCK_VPN_IPS.push(ipAddress);
    }
  },
};
