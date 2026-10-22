/**
 * One-time server command: makes the first super admin.
 *
 *   pnpm staff:make-super-admin +2348031234567
 *
 * See docs/DEPLOYMENT.md and ADR 0005. Reads DATABASE_URL from the environment (or server/.env).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { makeFirstSuperAdmin } from './first-super-admin.js';

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: pnpm staff:make-super-admin +2348031234567');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const made = await makeFirstSuperAdmin(prisma, phone);
  console.log(`Done: ${made.name} (${made.phone}) is now a super admin for all countries.`);
  console.log('They must complete two-step login (SMS code) before using any admin feature.');
} catch (err) {
  console.error(`Not done: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
