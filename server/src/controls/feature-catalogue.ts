/**
 * Every switchable feature (Product Specification, Section 17.1).
 *
 * defaultEnabled is what applies where no rule says otherwise. Features not yet built are off by
 * default; switching them on is a decision for the platform team once they are ready.
 * critical features need two approvals to switch on (see ADR 0002).
 */
export interface FeatureDefinition {
  key: string;
  area: string;
  description: string;
  critical: boolean;
  defaultEnabled: boolean;
}

const f = (
  key: string,
  description: string,
  opts: { critical?: boolean; on?: boolean } = {},
): FeatureDefinition => ({
  key,
  area: key.split('.')[0],
  description,
  critical: opts.critical ?? false,
  defaultEnabled: opts.on ?? false,
});

export const FEATURES = [
  // Platform-wide emergency switches
  f('platform.new_registrations', 'Allow new users to register', { critical: true, on: true }),
  f('platform.new_listings', 'Allow new listings to be submitted', { critical: true, on: true }),

  // Search
  f('search.around_me', 'Search around the tenant\'s current location', { on: true }),
  f('search.map', 'Map search', { on: true }),
  f('search.landmark', 'Search by distance from a landmark', { on: true }),
  f('search.saved_alerts', 'Saved area alerts', { on: true }),
  f('search.compare', 'Compare up to three properties', { on: true }),

  // Listings
  f('listings.long_term', 'Long-term residential rentals', { on: true }),
  f('listings.commercial', 'Commercial rentals', { on: true }),
  f('listings.short_let', 'Short lets'),
  f('listings.photo_360', '360-degree photos'),
  f('listings.floor_plan', 'Floor plans'),

  // Contact
  f('contact.chat', 'In-app chat', { on: true }),
  f('contact.phone_reveal', 'Phone number reveal after an inspection is booked', { on: true }),
  f('contact.inspection_booking', 'Inspection booking', { on: true }),
  f('contact.inspection_safety_share', 'Share inspection details with a trusted contact', { on: true }),

  // Verification
  f('verification.satellite_check', 'Satellite check of property location', { critical: true }),
  f('verification.survey_plan_match', 'Survey plan coordinate match', { critical: true }),
  f('verification.document_reading', 'Automatic reading of title documents', { critical: true }),
  f('verification.stolen_photo_check', 'Check photos against images published online', { critical: true }),
  f('verification.registry_check', 'Land registry title check', { critical: true }),
  f('verification.random_audits', 'Random site visits to green listings', { critical: true, on: true }),
  f('verification.required_site_visits', 'Site visits required for red listings', { critical: true, on: true }),

  // Money
  f('money.escrow', 'Escrow payments', { critical: true }),
  f('money.completed_rental_fee', 'Completed rental fee for rentals outside escrow', { critical: true }),
  f('money.card_payments', 'Card payments', { critical: true }),
  f('money.bank_transfer', 'Bank transfer payments', { critical: true }),
  f('money.rent_financing', 'Rent financing', { critical: true }),

  // Property management
  f('management.property_management', 'Property management'),
  f('management.tenancy_agreements', 'Digital tenancy agreements'),
  f('management.rent_reminders', 'Rent reminders'),
  f('management.maintenance_requests', 'Maintenance requests'),
  f('management.caretaker_role', 'Caretaker role'),

  // Market information
  f('market.fair_rent_indicator', 'Fair rent indicator'),
  f('market.area_reports', 'Area rent reports'),
  f('market.neighbourhood_ratings', 'Neighbourhood ratings'),

  // Trust
  f('trust.ratings_reviews', 'Ratings and reviews'),
  f('trust.report_button', 'Report a listing', { on: true }),
  f('trust.chat_monitoring', 'Automatic chat monitoring', { on: true }),

  // Media protection
  f('media.screenshot_blocking', 'Screenshot and recording blocking', { on: true }),
  f('media.auto_blur', 'Automatic blurring of faces, plates and documents', { on: true }),
  f('media.web_monitoring', 'Monitoring the web for copied images'),

  // Languages
  f('language.en', 'English', { on: true }),
  f('language.pcm', 'Nigerian Pidgin', { on: true }),
  f('language.yo', 'Yoruba'),
  f('language.ig', 'Igbo'),
  f('language.ha', 'Hausa'),
  f('language.fr', 'French'),
] as const satisfies readonly FeatureDefinition[];

export type FeatureKey = (typeof FEATURES)[number]['key'];

export const FEATURE_KEYS = new Set<string>(FEATURES.map((x) => x.key));

export function isFeatureKey(key: string): key is FeatureKey {
  return FEATURE_KEYS.has(key);
}
