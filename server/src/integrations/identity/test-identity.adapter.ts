import { z } from 'zod';
import {
  UntrustedResultError,
  type IdentityCheckResult,
  type IdentityCheckStart,
  type IdentityProvider,
  type IncomingResult,
  type StartedIdentityCheck,
} from './identity-provider.js';

const resultSchema = z.object({
  reference: z.string().min(1),
  idFound: z.boolean(),
  nameOnId: z.string().max(300).nullable().default(null),
  livenessPassed: z.boolean(),
  faceMatched: z.boolean(),
  faceMatchScore: z.number().int().min(0).max(100).nullable().default(null),
});

/**
 * Development identity provider. It checks nothing: a check stays pending until a result is sent to
 * POST /v1/identity/provider-results/test, by a developer or by the API tests, with the outcome to simulate.
 *
 * Because anyone could send such a result, this adapter is only available when NODE_ENV is not "production"
 * (see identity.module.ts).
 */
export class TestIdentityAdapter implements IdentityProvider {
  readonly name = 'test';

  async start(check: IdentityCheckStart): Promise<StartedIdentityCheck> {
    const reference = `test-${check.checkId}`;
    return {
      reference,
      session: {
        provider: this.name,
        reference,
        note: 'Test provider: send the result to POST /v1/identity/provider-results/test.',
      },
    };
  }

  async readResult(incoming: IncomingResult): Promise<IdentityCheckResult> {
    const parsed = resultSchema.safeParse(incoming.body);
    if (!parsed.success) throw new UntrustedResultError('Not a valid test result');
    return parsed.data;
  }
}
