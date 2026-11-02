import { apiError } from './api-error.js';

/** Checks an Idempotency-Key header: 1 to 100 visible characters, or absent. */
export function checkIdempotencyKey(key: string | undefined): string | undefined {
  if (key !== undefined && !/^[\x21-\x7e]{1,100}$/.test(key)) {
    throw apiError(400, 'BAD_REQUEST', 'Idempotency-Key must be 1 to 100 visible characters.');
  }
  return key;
}
