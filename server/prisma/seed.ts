/**
 * Starter data: Nigeria, its states, Benin City, property types, accepted documents and the feature
 * catalogue. Safe to run more than once (it updates rather than duplicates).
 *
 * Launch city is an open decision, so no state or city is switched on here. Staff switch them on.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { FEATURES } from '../src/controls/feature-catalogue.js';
import { countrySettingsSchema } from '../src/controls/country-settings.schema.js';
import { COMMERCIAL_PARTS, RESIDENTIAL_PARTS, ROOM_PARTS } from './seed-data/part-templates.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const NIGERIA_STATES: [string, string][] = [
  ['AB', 'Abia'], ['AD', 'Adamawa'], ['AK', 'Akwa Ibom'], ['AN', 'Anambra'], ['BA', 'Bauchi'],
  ['BY', 'Bayelsa'], ['BE', 'Benue'], ['BO', 'Borno'], ['CR', 'Cross River'], ['DE', 'Delta'],
  ['EB', 'Ebonyi'], ['ED', 'Edo'], ['EK', 'Ekiti'], ['EN', 'Enugu'], ['FC', 'Federal Capital Territory'],
  ['GO', 'Gombe'], ['IM', 'Imo'], ['JI', 'Jigawa'], ['KD', 'Kaduna'], ['KN', 'Kano'], ['KT', 'Katsina'],
  ['KE', 'Kebbi'], ['KO', 'Kogi'], ['KW', 'Kwara'], ['LA', 'Lagos'], ['NA', 'Nasarawa'], ['NI', 'Niger'],
  ['OG', 'Ogun'], ['ON', 'Ondo'], ['OS', 'Osun'], ['OY', 'Oyo'], ['PL', 'Plateau'], ['RI', 'Rivers'],
  ['SO', 'Sokoto'], ['TA', 'Taraba'], ['YO', 'Yobe'], ['ZA', 'Zamfara'],
];

const NG_PROPERTY_TYPES = [
  ['LONG_TERM_RESIDENTIAL', 'room_shared', 'Room in a shared house', ROOM_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'self_contain', 'Self-contain (studio)', ROOM_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'mini_flat', 'Mini flat (one bedroom)', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'flat', 'Flat or apartment', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'bungalow', 'Bungalow', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'duplex_detached', 'Detached duplex', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'duplex_semi_detached', 'Semi-detached duplex', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'duplex_terrace', 'Terrace duplex', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'penthouse', 'Penthouse', RESIDENTIAL_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'boys_quarters', "Boys' quarters", ROOM_PARTS],
  ['LONG_TERM_RESIDENTIAL', 'hostel_room', 'Student hostel room', ROOM_PARTS],
  ['COMMERCIAL', 'shop', 'Shop', COMMERCIAL_PARTS],
  ['COMMERCIAL', 'office', 'Office space', COMMERCIAL_PARTS],
  ['COMMERCIAL', 'plaza_unit', 'Plaza unit', COMMERCIAL_PARTS],
  ['COMMERCIAL', 'warehouse', 'Warehouse', COMMERCIAL_PARTS],
  ['SHORT_LET', 'serviced_apartment', 'Entire serviced apartment', RESIDENTIAL_PARTS],
  ['SHORT_LET', 'entire_house', 'Entire house', RESIDENTIAL_PARTS],
  ['SHORT_LET', 'private_room', 'Private room', ROOM_PARTS],
] as const;

const NG_DOCUMENT_TYPES = [
  ['IDENTITY', 'NIN', 'National Identification Number (NIN)'],
  ['OWNERSHIP', 'CERTIFICATE_OF_OCCUPANCY', 'Certificate of Occupancy'],
  ['OWNERSHIP', 'DEED_OF_ASSIGNMENT', 'Deed of assignment'],
  ['OWNERSHIP', 'SURVEY_PLAN', 'Survey plan'],
  ['OWNERSHIP', 'PURCHASE_RECEIPT', 'Purchase receipt'],
  ['AUTHORITY_LETTER', 'LETTER_OF_AUTHORITY', 'Letter of authority from the landlord'],
] as const;

async function main() {
  // Feature catalogue
  for (const def of FEATURES) {
    await prisma.featureFlag.upsert({
      where: { key: def.key },
      create: { ...def },
      update: { area: def.area, description: def.description, critical: def.critical, defaultEnabled: def.defaultEnabled },
    });
  }

  // Nigeria. Settings are validated so a typo cannot be saved.
  const settings = countrySettingsSchema.parse({
    verification: { acceptedIdTypes: ['NIN'] },
  });
  await prisma.country.upsert({
    where: { code: 'NG' },
    create: {
      code: 'NG',
      name: 'Nigeria',
      currency: 'NGN',
      enabled: true,
      defaultLanguage: 'en',
      languages: ['en', 'pcm', 'yo', 'ig', 'ha', 'fr'],
      timezone: 'Africa/Lagos',
      settings,
    },
    update: {},
  });

  for (const [code, name] of NIGERIA_STATES) {
    await prisma.region.upsert({
      where: { countryCode_code: { countryCode: 'NG', code } },
      create: { countryCode: 'NG', code, name },
      update: { name },
    });
  }

  const edo = await prisma.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'NG', code: 'ED' } } });
  const benin = await prisma.city.upsert({
    where: { regionId_name: { regionId: edo.id, name: 'Benin City' } },
    create: { regionId: edo.id, name: 'Benin City' },
    update: {},
  });
  await prisma.$executeRaw`
    UPDATE "City" SET "centre" = ST_SetSRID(ST_MakePoint(5.6037, 6.3350), 4326)::geography WHERE "id" = ${benin.id}::uuid`;

  let order = 0;
  for (const [category, code, label, template] of NG_PROPERTY_TYPES) {
    await prisma.propertyType.upsert({
      where: { countryCode_code: { countryCode: 'NG', code } },
      create: { countryCode: 'NG', category, code, label, partTemplate: template, sortOrder: order },
      update: { category, label, partTemplate: template, sortOrder: order },
    });
    order++;
  }

  for (const [purpose, code, label] of NG_DOCUMENT_TYPES) {
    await prisma.documentType.upsert({
      where: { countryCode_code: { countryCode: 'NG', code } },
      create: { countryCode: 'NG', purpose, code, label },
      update: { purpose, label },
    });
  }

  console.log(
    `Seeded: ${FEATURES.length} features, Nigeria with ${NIGERIA_STATES.length} states, Benin City, ` +
      `${NG_PROPERTY_TYPES.length} property types, ${NG_DOCUMENT_TYPES.length} document types.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
