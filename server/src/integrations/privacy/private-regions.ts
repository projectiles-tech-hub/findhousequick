import type { PrivateRegion } from '../../media/photo.js';

/**
 * Finds what must be blurred in a property photo before it is shown: faces, vehicle number plates, documents and
 * family photographs (Specification 15.3). Each detection service gets its own adapter implementing this.
 */
export interface PrivateRegionFinder {
  readonly provider: string;
  find(photo: Buffer): Promise<PrivateRegion[]>;
}

/** No detection service: nothing is found, so nothing is blurred automatically. Not allowed in production. */
export class NoRegionFinder implements PrivateRegionFinder {
  readonly provider = 'none';
  find(): Promise<PrivateRegion[]> {
    return Promise.resolve([]);
  }
}

export const PRIVATE_REGION_FINDER = Symbol('PRIVATE_REGION_FINDER');
