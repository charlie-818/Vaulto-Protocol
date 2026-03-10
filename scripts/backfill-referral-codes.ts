/**
 * Backfill referral codes for all users in the database who don't have one.
 * Idempotent - safe to re-run.
 *
 * Usage: npx tsx scripts/backfill-referral-codes.ts
 */

import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(): string {
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += CHARS[bytes[i]! % CHARS.length];
  }
  return code;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users without referral codes. Done.");
    return;
  }

  const existing = new Set(
    (await prisma.user.findMany({ where: { referralCode: { not: null } }, select: { referralCode: true } }))
      .map((u) => u.referralCode!)
  );

  let assigned = 0;
  for (const user of users) {
    let code: string;
    do {
      code = generateCode();
    } while (existing.has(code));
    existing.add(code);

    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: code },
    });
    assigned++;
    console.log(`Assigned ${code} to ${user.email}`);
  }

  console.log(`Done. Assigned referral codes to ${assigned} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
