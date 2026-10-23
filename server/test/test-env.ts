/** Settings for the API tests. Uses a separate database so tests never touch development data. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://fhq:fhq_dev_password@localhost:5432/findhousequick_test?schema=public',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  OTP_HASH_SECRET: 'test-code-secret-that-is-also-at-least-32-characters',
  LOOKUP_HASH_SECRET: 'test-lookup-secret-that-is-also-at-least-32-characters',
  RUN_BACKGROUND_JOBS: 'false',
  STORAGE_LOCAL_DIR: '.private-storage-test',
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};
