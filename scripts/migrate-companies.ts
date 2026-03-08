/**
 * Migration script: Railway SQLite -> Supabase PostgreSQL
 *
 * Fetches private company data from the Railway API and upserts it into Supabase.
 * Idempotent - safe to re-run multiple times.
 *
 * Usage: npx tsx scripts/migrate-companies.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

const RAILWAY_API_URL = "https://api.vaulto.ai/api/private-companies";

interface RawFundingRound {
  roundNumber?: number;
  type: string;
  date: string;
  amountRaisedUsd: number | null;
  amountRaisedNote?: string | null;
  preMoneyValuationUsd?: number | null;
  postMoneyValuationUsd?: number | null;
  pricePerShareUsd?: number | null;
}

// Products from the API can be strings or objects with name/description
type RawProduct = string | { name: string; description: string };

interface RawCompany {
  id: number;
  name: string;
  industry: string;
  description: string;
  website: string;
  valuationUsd: number;
  valuationAsOf: string;
  totalFundingUsd: number;
  lastFundingRoundType: string;
  lastFundingDate: string;
  lastFundingEstPricePerShareUsd: number | null;
  employees: number;
  ceo: string;
  products: RawProduct[];
  fundingHistory: RawFundingRound[];
}

interface ApiResponse {
  companies: RawCompany[];
  total: number;
}

async function fetchCompaniesFromRailway(): Promise<RawCompany[]> {
  const apiKey = process.env.VAULTO_API_TOKEN;

  if (!apiKey) {
    throw new Error("Missing VAULTO_API_TOKEN environment variable");
  }

  console.log("Fetching companies from Railway API...");

  const res = await fetch(RAILWAY_API_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Railway API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ApiResponse;
  console.log(`Fetched ${json.companies.length} companies from Railway`);

  return json.companies;
}

function toBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(Math.round(value));
}

function toDate(dateString: string): Date {
  return new Date(dateString);
}

async function migrateCompany(company: RawCompany): Promise<void> {
  console.log(`Migrating: ${company.name} (ID: ${company.id})`);

  // Delete existing related records first (for idempotency)
  await prisma.companyProduct.deleteMany({
    where: { companyId: company.id },
  });

  await prisma.fundingRound.deleteMany({
    where: { companyId: company.id },
  });

  // Upsert the company
  await prisma.privateCompany.upsert({
    where: { id: company.id },
    update: {
      name: company.name,
      industry: company.industry,
      description: company.description,
      website: company.website,
      valuationUsd: toBigInt(company.valuationUsd)!,
      valuationAsOf: toDate(company.valuationAsOf),
      totalFundingUsd: toBigInt(company.totalFundingUsd)!,
      lastFundingRoundType: company.lastFundingRoundType,
      lastFundingDate: toDate(company.lastFundingDate),
      lastFundingEstPricePerShareUsd: company.lastFundingEstPricePerShareUsd,
      employees: company.employees,
      ceo: company.ceo,
    },
    create: {
      id: company.id,
      name: company.name,
      industry: company.industry,
      description: company.description,
      website: company.website,
      valuationUsd: toBigInt(company.valuationUsd)!,
      valuationAsOf: toDate(company.valuationAsOf),
      totalFundingUsd: toBigInt(company.totalFundingUsd)!,
      lastFundingRoundType: company.lastFundingRoundType,
      lastFundingDate: toDate(company.lastFundingDate),
      lastFundingEstPricePerShareUsd: company.lastFundingEstPricePerShareUsd,
      employees: company.employees,
      ceo: company.ceo,
    },
  });

  // Insert products (API returns mixed types - strings or objects)
  if (company.products && company.products.length > 0) {
    await prisma.companyProduct.createMany({
      data: company.products.map((product) => {
        if (typeof product === "string") {
          return {
            companyId: company.id,
            name: product,
            description: "",
          };
        } else {
          return {
            companyId: company.id,
            name: product.name,
            description: product.description || "",
          };
        }
      }),
    });
  }

  // Insert funding history
  if (company.fundingHistory && company.fundingHistory.length > 0) {
    await prisma.fundingRound.createMany({
      data: company.fundingHistory.map((round) => ({
        companyId: company.id,
        roundNumber: round.roundNumber ?? null,
        type: round.type,
        date: toDate(round.date),
        amountRaisedUsd: toBigInt(round.amountRaisedUsd),
        amountRaisedNote: round.amountRaisedNote ?? null,
        preMoneyValuationUsd: toBigInt(round.preMoneyValuationUsd),
        postMoneyValuationUsd: toBigInt(round.postMoneyValuationUsd),
        pricePerShareUsd: round.pricePerShareUsd ?? null,
      })),
    });
  }

  console.log(
    `  -> Migrated ${company.products?.length ?? 0} products, ${company.fundingHistory?.length ?? 0} funding rounds`
  );
}

async function main() {
  console.log("=".repeat(60));
  console.log("Private Company Migration: Railway -> Supabase");
  console.log("=".repeat(60));

  try {
    const companies = await fetchCompaniesFromRailway();

    console.log(`\nStarting migration of ${companies.length} companies...\n`);

    for (const company of companies) {
      await migrateCompany(company);
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Migration complete! ${companies.length} companies migrated.`);
    console.log("=".repeat(60));

    // Verify counts
    const companyCount = await prisma.privateCompany.count();
    const productCount = await prisma.companyProduct.count();
    const fundingCount = await prisma.fundingRound.count();

    console.log("\nVerification:");
    console.log(`  - Companies: ${companyCount}`);
    console.log(`  - Products: ${productCount}`);
    console.log(`  - Funding Rounds: ${fundingCount}`);
  } catch (error) {
    console.error("\nMigration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
