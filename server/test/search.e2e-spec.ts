import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import { uuidv7 } from '../src/common/ids.js';
import { ControlsService } from '../src/controls/controls.service.js';
import type { UserType } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
/** A quiet spot in Benin City used only by these tests, so other tests' listings do not get in the way. */
const BASE = { lat: 6.2601, lng: 5.5402 };
const at = (northM: number, eastM = 0) => ({ lat: BASE.lat + northM / 111_320, lng: BASE.lng + eastM / (111_320 * Math.cos((BASE.lat * Math.PI) / 180)) });
const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((b.lat - a.lat) * 111_320, (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

describe('Search, the property page and saved items (API, step 5 part 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seq = 0;
  let cityId: string;
  let regionId: string;
  let original: { region: boolean; city: boolean };
  let types: Record<string, string>;
  const run = randomUUID().slice(0, 8);

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const newPhone = () => `+234806${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;

  interface Person {
    id: string;
    token: string;
  }

  async function person(t: UserType[] = ['TENANT']): Promise<Person> {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `search${process.pid}.${seq}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Efosa',
        lastName: `Search ${seq}`,
        countryCode: 'NG',
        types: t,
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    return { id: user.id, token: res.body.accessToken };
  }

  /** A live listing at a point, written straight to the database. */
  async function liveListing(owner: Person, where: { lat: number; lng: number }, o: { type?: string; bedrooms?: number; rent?: number; area?: string; status?: 'LIVE' | 'DRAFT'; furnishing?: string } = {}) {
    const buildingId = uuidv7();
    await prisma.$executeRaw`
      INSERT INTO "Building" ("id", "countryCode", "cityId", "area", "street", "addressKey", "location", "ownerId", "createdById", "updatedAt")
      VALUES (${buildingId}::uuid, 'NG', ${cityId}::uuid, ${o.area ?? `Testarea${run}`}, ${`Street ${++seq}`}, ${`k${run}${seq}`},
        ST_SetSRID(ST_MakePoint(${where.lng}, ${where.lat}), 4326)::geography, ${owner.id}::uuid, ${owner.id}::uuid, now())`;
    const unit = await prisma.unit.create({
      data: { buildingId, label: 'Flat 1', propertyTypeId: types[o.type ?? 'flat']!, bedrooms: o.bedrooms ?? 2, bathrooms: 2, toilets: 2, details: o.furnishing ? { furnishing: o.furnishing } : {} },
    });
    return prisma.listing.create({
      data: {
        unitId: unit.id,
        kind: o.type === 'serviced_apartment' ? 'SHORT_LET' : 'LONG_TERM',
        status: o.status ?? 'LIVE',
        title: `Test home ${seq}`,
        description: 'A home used by the search tests, with enough words to pass.',
        currency: 'NGN',
        rentMinor: BigInt((o.rent ?? 800_000) * 100),
        rentPeriod: o.type === 'serviced_apartment' ? 'NIGHT' : 'YEAR',
        publishedAt: new Date(Date.now() - seq * 1000),
        createdById: owner.id,
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' }, include: { region: true } });
    cityId = city.id;
    regionId = city.regionId;
    original = { region: city.region.enabled, city: city.enabled };
    await prisma.region.update({ where: { id: regionId }, data: { enabled: true } });
    await prisma.city.update({ where: { id: cityId }, data: { enabled: true } });
    types = Object.fromEntries((await prisma.propertyType.findMany({ where: { countryCode: 'NG' } })).map((t) => [t.code, t.id]));
  });

  afterAll(async () => {
    await prisma.city.update({ where: { id: cityId }, data: { enabled: original.city } });
    await prisma.region.update({ where: { id: regionId }, data: { enabled: original.region } });
    await app.close();
  });

  describe('search', () => {
    it('finds live listings around a point, nearest first, with approximate positions and rounded distances', async () => {
      const landlord = await person(['LANDLORD']);
      const near = await liveListing(landlord, at(300));
      const far = await liveListing(landlord, at(1500));
      const draft = await liveListing(landlord, at(200), { status: 'DRAFT' });
      const outside = await liveListing(landlord, at(9000));
      const res = (await api().get(`/v1/search/listings?near=${BASE.lat},${BASE.lng}&radiusM=2000`).expect(200)).body;
      const ids = res.items.map((i: { id: string }) => i.id);
      expect(ids.indexOf(near.id)).toBeLessThan(ids.indexOf(far.id));
      expect(ids).not.toContain(draft.id);
      expect(ids).not.toContain(outside.id);
      const card = res.items.find((i: { id: string }) => i.id === near.id);
      expect(card.distanceM % 100).toBe(0);
      expect(card.badges).toEqual(['OWNER_VERIFIED']);
      const moved = metresBetween(card.approximateLocation, at(300));
      expect(moved).toBeGreaterThan(100);
      expect(moved).toBeLessThan(310);
    });

    it('filters by bedrooms, rent, property type, furnishing and area', async () => {
      const landlord = await person(['LANDLORD']);
      const area = `Filterarea${run}`;
      const big = await liveListing(landlord, at(5000), { bedrooms: 4, rent: 2_500_000, area, furnishing: 'FURNISHED' });
      const small = await liveListing(landlord, at(5100), { bedrooms: 1, rent: 400_000, area });
      const ids = async (qs: string) => (await api().get(`/v1/search/listings?area=${area}&${qs}`).expect(200)).body.items.map((i: { id: string }) => i.id);
      expect(await ids('')).toEqual(expect.arrayContaining([big.id, small.id]));
      expect(await ids('minBedrooms=3')).toEqual([big.id]);
      expect(await ids('maxRent=50000000')).toEqual([small.id]);
      expect(await ids('furnished=FURNISHED')).toEqual([big.id]);
      expect(await ids('propertyType=bungalow')).toEqual([]);
      expect(await ids('sort=PRICE_DESC')).toEqual([big.id, small.id]);
    });

    it('leaves out kinds of rental that are switched off (short lets are off by default)', async () => {
      const landlord = await person(['LANDLORD']);
      const short = await liveListing(landlord, at(7000), { type: 'serviced_apartment' });
      const res = (await api().get(`/v1/search/listings?near=${at(7000).lat},${at(7000).lng}&radiusM=500`).expect(200)).body;
      expect(res.items.map((i: { id: string }) => i.id)).not.toContain(short.id);
      await api().get(`/v1/listings/${short.id}`).expect(404);
    });

    it('groups map pins when zoomed out, never placing a group on a listing\'s own spot', async () => {
      const landlord = await person(['LANDLORD']);
      const spot = at(12_000, 12_000);
      await liveListing(landlord, spot);
      const bbox = [spot.lat - 0.05, spot.lng - 0.05, spot.lat + 0.05, spot.lng + 0.05].join(',');
      const res = (await api().get(`/v1/search/listings?bbox=${bbox}&zoom=9`).expect(200)).body;
      expect(res.items).toEqual([]);
      expect(res.clusters.reduce((n: number, c: { count: number }) => n + c.count, 0)).toBeGreaterThanOrEqual(1);
      for (const c of res.clusters) expect(metresBetween(c.centre, spot)).toBeGreaterThan(5);
      const close = (await api().get(`/v1/search/listings?bbox=${bbox}&zoom=15`).expect(200)).body;
      expect(close.items.length).toBeGreaterThanOrEqual(1);
      expect(close.clusters).toEqual([]);
    });

    it('pages through results with a cursor', async () => {
      const landlord = await person(['LANDLORD']);
      const area = `Pagearea${run}`;
      for (let i = 0; i < 22; i++) await liveListing(landlord, at(20_000 + i * 10), { area });
      const first = (await api().get(`/v1/search/listings?area=${area}`).expect(200)).body;
      expect(first.items).toHaveLength(20);
      const second = (await api().get(`/v1/search/listings?area=${area}&cursor=${first.nextCursor}`).expect(200)).body;
      expect(second.items).toHaveLength(2);
      expect(second.nextCursor).toBeNull();
      expect(new Set([...first.items, ...second.items].map((i: { id: string }) => i.id)).size).toBe(22);
    });

    it('finds areas and landmarks by name', async () => {
      const landlord = await person(['LANDLORD']);
      await liveListing(landlord, at(30_000), { area: `Placearea${run}` });
      const res = (await api().get(`/v1/search/places?q=Placearea${run}`).expect(200)).body;
      expect(res[0]).toMatchObject({ name: `Placearea${run}`, description: 'Area in Benin City' });
    });
  });

  describe('the property page', () => {
    it('shows the full listing to everyone, the lister and travel distances only to signed-in users', async () => {
      const landlord = await person(['LANDLORD']);
      const listing = await liveListing(landlord, at(40_000));
      const out = (await api().get(`/v1/listings/${listing.id}`).set('X-Device-Id', `dev-${run}-a`).expect(200)).body;
      expect(out).toMatchObject({ id: listing.id, lister: null, exactLocation: null, savedPlaceDistances: [], moveInCost: { inspectionFee: 'FREE' } });
      expect(out.status).toBeUndefined();

      const tenant = await person();
      await api().post('/v1/me/saved-places').set(bearer(tenant.token)).send({ name: 'Office', location: at(41_000) }).expect(201);
      const inside = (await api().get(`/v1/listings/${listing.id}`).set(bearer(tenant.token)).expect(200)).body;
      expect(inside.lister).toMatchObject({ id: landlord.id, role: 'LANDLORD', verified: true });
      expect(inside.savedPlaceDistances).toEqual([expect.objectContaining({ name: 'Office', distanceM: 1000 })]);

      // The landlord sees his own owner view, with its state.
      expect((await api().get(`/v1/listings/${listing.id}`).set(bearer(landlord.token)).expect(200)).body.status).toBe('LIVE');
    });

    it('hides listings that are not live from everyone but their lister', async () => {
      const landlord = await person(['LANDLORD']);
      const draft = await liveListing(landlord, at(42_000), { status: 'DRAFT' });
      await api().get(`/v1/listings/${draft.id}`).expect(404);
      const stranger = await person();
      await api().get(`/v1/listings/${draft.id}`).set(bearer(stranger.token)).expect(404);
      await api().get(`/v1/listings/${draft.id}`).set(bearer(landlord.token)).expect(200);
    });

    it('shows similar homes and more in the area, without distances between listings', async () => {
      const landlord = await person(['LANDLORD']);
      const area = `Relatedarea${run}`;
      const main = await liveListing(landlord, at(50_000), { area, rent: 1_000_000 });
      const similar = await liveListing(landlord, at(50_300), { area, rent: 1_100_000 });
      const pricier = await liveListing(landlord, at(50_400), { area, rent: 3_000_000 });
      const res = (await api().get(`/v1/listings/${main.id}/related`).expect(200)).body;
      expect(res.similar.map((c: { id: string }) => c.id)).toContain(similar.id);
      expect(res.similar.map((c: { id: string }) => c.id)).not.toContain(pricier.id);
      expect(res.nearby.map((c: { id: string }) => c.id)).toContain(pricier.id);
      expect([...res.similar, ...res.nearby].map((c: { id: string }) => c.id)).not.toContain(main.id);
      expect([...res.similar, ...res.nearby].every((c: { distanceM: unknown }) => c.distanceM === null)).toBe(true);
    });

    it('gives the total, the city on each card, a city filter and the popular areas', async () => {
      const landlord = await person(['LANDLORD']);
      const area = `Popular${run}`;
      await liveListing(landlord, at(70_000), { area });
      await liveListing(landlord, at(70_300), { area: area.toUpperCase() });
      await liveListing(landlord, at(70_600), { area: `Quiet${run}` });
      const res = (await api().get(`/v1/search/listings?city=benin%20city&area=${area}`).expect(200)).body;
      expect(res.total).toBe(2);
      expect(res.items[0]).toMatchObject({ city: 'Benin City', region: expect.any(String) });
      expect((await api().get('/v1/search/listings?city=Nowhere').expect(200)).body).toMatchObject({ items: [], total: 0 });
      const areas = (await api().get('/v1/search/areas?city=Benin%20City&limit=30').expect(200)).body as { area: string; count: number }[];
      const popular = areas.find((a) => a.area.toLowerCase() === area.toLowerCase())!;
      expect(popular.count).toBe(2);
      expect(areas.map((a) => a.count)).toEqual(areas.map((a) => a.count).toSorted((x, y) => y - x));
    });

    it('limits how many property pages one device can open in an hour without signing in', async () => {
      const landlord = await person(['LANDLORD']);
      const listing = await liveListing(landlord, at(60_000));
      const controls = app.get(ControlsService);
      const before = await controls.getPlatformSettings();
      await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, settings: { ...before, signedOutListingViewsPerHour: 10 } }, update: { settings: { ...before, signedOutListingViewsPerHour: 10 } } });
      (controls as unknown as { invalidate?: () => void }).invalidate?.();
      try {
        const device = `dev-${run}-limit`;
        let last = 0;
        for (let i = 0; i < 12; i++) last = (await api().get(`/v1/listings/${listing.id}`).set('X-Device-Id', device)).status;
        expect(last).toBe(429);
        // Another device, and signed-in users, have their own counts.
        await api().get(`/v1/listings/${listing.id}`).set('X-Device-Id', `dev-${run}-other`).expect(200);
        const signedIn = await person();
        await api().get(`/v1/listings/${listing.id}`).set(bearer(signedIn.token)).expect(200);
      } finally {
        await prisma.platformSettings.update({ where: { id: 1 }, data: { settings: before } });
        (controls as unknown as { invalidate?: () => void }).invalidate?.();
      }
    });
  });

  describe('saved items', () => {
    it('saves and removes favourites, which drop out once no longer live', async () => {
      const landlord = await person(['LANDLORD']);
      const tenant = await person();
      const a = await liveListing(landlord, at(70_000));
      const b = await liveListing(landlord, at(70_100));
      const draft = await liveListing(landlord, at(70_200), { status: 'DRAFT' });
      await api().put(`/v1/me/saved-listings/${a.id}`).set(bearer(tenant.token)).expect(204);
      await api().put(`/v1/me/saved-listings/${a.id}`).set(bearer(tenant.token)).expect(204);
      await api().put(`/v1/me/saved-listings/${b.id}`).set(bearer(tenant.token)).expect(204);
      await api().put(`/v1/me/saved-listings/${draft.id}`).set(bearer(tenant.token)).expect(404);
      await prisma.listing.update({ where: { id: b.id }, data: { status: 'RENTED' } });
      const saved = (await api().get('/v1/me/saved-listings').set(bearer(tenant.token)).expect(200)).body;
      expect(saved.map((c: { id: string }) => c.id)).toEqual([a.id]);
      await api().delete(`/v1/me/saved-listings/${a.id}`).set(bearer(tenant.token)).expect(204);
      expect((await api().get('/v1/me/saved-listings').set(bearer(tenant.token)).expect(200)).body).toEqual([]);
      await api().put(`/v1/me/saved-listings/${a.id}`).expect(401);
    });

    it('saves areas as a circle or a drawn shape, with filters', async () => {
      const tenant = await person();
      const circle = (await api().post('/v1/me/saved-searches').set(bearer(tenant.token)).send({ name: 'Near work', area: { centre: BASE, radiusM: 1000 }, filters: { minBedrooms: 2 } }).expect(201)).body;
      expect(circle.area.polygon.length).toBeGreaterThan(8);
      expect(circle).toMatchObject({ name: 'Near work', filters: { minBedrooms: 2 }, alertsEnabled: true });
      const drawn = (await api().post('/v1/me/saved-searches').set(bearer(tenant.token)).send({ name: 'GRA', area: { polygon: [at(0), at(1000), at(1000, 1000)] }, alertsEnabled: false }).expect(201)).body;
      expect(drawn.area.polygon).toHaveLength(3);
      await api().post('/v1/me/saved-searches').set(bearer(tenant.token)).send({ name: 'Both', area: { polygon: [at(0), at(1), at(2)], centre: BASE, radiusM: 500 } }).expect(400);
      expect((await api().get('/v1/me/saved-searches').set(bearer(tenant.token)).expect(200)).body).toHaveLength(2);
      await api().delete(`/v1/me/saved-searches/${drawn.id}`).set(bearer(tenant.token)).expect(204);
      await api().delete(`/v1/me/saved-searches/${drawn.id}`).set(bearer(tenant.token)).expect(404);
    });

    it('keeps saved places private to their owner', async () => {
      const tenant = await person();
      const other = await person();
      const place = (await api().post('/v1/me/saved-places').set(bearer(tenant.token)).send({ name: 'School', location: at(100) }).expect(201)).body;
      expect((await api().get('/v1/me/saved-places').set(bearer(other.token)).expect(200)).body).toEqual([]);
      await api().delete(`/v1/me/saved-places/${place.id}`).set(bearer(other.token)).expect(404);
      await api().delete(`/v1/me/saved-places/${place.id}`).set(bearer(tenant.token)).expect(204);
    });
  });
});
