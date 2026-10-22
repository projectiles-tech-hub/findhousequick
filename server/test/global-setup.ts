/**
 * Runs once before the API tests: rebuilds the test database from the migrations and loads the
 * starter data, so every test run starts from the same known state.
 */
import { execSync } from 'node:child_process';
import pg from 'pg';
import { TEST_ENV } from './test-env.js';

export default async function setup(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_ENV.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await client.end();

  const env = { ...process.env, ...TEST_ENV };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
}
