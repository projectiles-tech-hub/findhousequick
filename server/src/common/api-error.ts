import { HttpException } from '@nestjs/common';

/**
 * Builds an error in the shape documented in docs/api/openapi.yaml (components/schemas/Error):
 * a status code, a machine-readable code the apps can act on, and a plain message safe to show users.
 */
export function apiError(
  statusCode: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException({ statusCode, code, message, ...extra }, statusCode);
}
