/** Shapes of the API answers the public website reads (docs/api/openapi.yaml). */
export interface Money {
  amountMinor: string;
  currency: string;
}

export interface ListingCard {
  id: string;
  title: string;
  coverImage: string | null;
  propertyTypeLabel: string;
  bedrooms: number;
  bathrooms: number;
  rent: Money;
  rentPeriod: 'YEAR' | 'MONTH' | 'WEEK' | 'NIGHT';
  area: string;
  city: string;
  region: string;
  badges: string[];
  photosTakenAt: string | null;
  publishedAt: string | null;
}

export interface SearchResult {
  items: ListingCard[];
  total: number;
  nextCursor: string | null;
}

export interface MediaItem {
  id: string;
  partCode: string | null;
  kind: string;
  display: { small?: string; medium?: string; large?: string } | null;
}

export interface GalleryPart {
  partCode: string;
  partLabel: string;
  note: string | null;
  media: MediaItem[];
}

export interface FeeLine {
  type: 'AGENCY_FEE' | 'LEGAL_FEE' | 'CAUTION_DEPOSIT' | 'SERVICE_CHARGE';
  amount: Money;
}

export interface ListingPage extends ListingCard {
  kind: 'LONG_TERM' | 'SHORT_LET';
  description: string;
  moveInCost: { rent: Money; fees: FeeLine[]; total: Money; inspectionFee: 'FREE' };
  serviceChargeCovers: string | null;
  availableFrom: string | null;
  minTermMonths: number | null;
  maxTermMonths: number | null;
  occupancyRules: { allowed?: string[]; notes?: string } | null;
  unit: { toilets: number; floorLevel: number | null; floorArea: number | null; areaUnit: 'SQM' | 'SQFT'; details: Record<string, unknown> };
  gallery: GalleryPart[];
  nearbyAmenities: { name: string; kind?: string; distanceM?: number }[];
  lister: { displayName: string; role: 'LANDLORD' | 'AGENT'; verified: boolean } | null;
}

export interface Related {
  similar: ListingCard[];
  nearby: ListingCard[];
}

export interface PopularArea {
  area: string;
  city: string;
  count: number;
}

export interface Controls {
  features: Record<string, boolean>;
  country: { code: string; name: string; currency: string; defaultLanguage: string; timezone: string; settings: { unitDetails?: { furnishing?: string[] } } } | null;
}
