import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import type { UserType } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';

/** Benin City, near the University of Benin. */
const HERE = { lat: 6.4024, lng: 5.6153 };

describe('Reference lists, buildings, units and the parts checklist (API, step 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seq = 0;
  let cityId: string;
  let regionId: string;
  let flatTypeId: string;
  let original: { region: boolean; city: boolean };

  const api = () => request(app.getHttpServer());
  const newPhone = () => `+234809${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** A point about `metres` north of HERE. */
  const north = (metres: number) => ({ lat: HERE.lat + metres / 111_320, lng: HERE.lng });

  interface Person {
    id: string;
    token: string;
  }

  /** A signed-in user of the given types; identity checked (level 2) unless `level` says otherwise. */
  async function person(types: UserType[], level: 1 | 2 = 2): Promise<Person> {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `props${process.pid}.${seq}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: level === 2 ? new Date() : null,
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Test',
        lastName: `Person ${seq}`,
        countryCode: 'NG',
        types,
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    return { id: user.id, token: res.body.accessToken };
  }

  const building = (over: Record<string, unknown> = {}) => ({
    cityId,
    area: 'Ugbowo',
    street: `Ekosodin Road ${++seq}`,
    houseNumber: '12',
    landmark: 'Opposite the filling station',
    distanceToMainRoadM: 150,
    location: north(seq * 100),
    locationAccuracyM: 6,
    ...over,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' }, include: { region: true } });
    cityId = city.id;
    regionId = city.regionId;
    original = { region: city.region.enabled, city: city.enabled };
    // The launch city is an open decision, so nothing is switched on in the starter data; switch it on here.
    await prisma.region.update({ where: { id: regionId }, data: { enabled: true } });
    await prisma.city.update({ where: { id: cityId }, data: { enabled: true } });
    flatTypeId = (await prisma.propertyType.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'NG', code: 'flat' } } })).id;
  });

  afterAll(async () => {
    await prisma.city.update({ where: { id: cityId }, data: { enabled: original.city } });
    await prisma.region.update({ where: { id: regionId }, data: { enabled: original.region } });
    await app.close();
  });

  describe('reference lists', () => {
    it('lists property types with their checklists, toilets separate from bathrooms (decision 56)', async () => {
      const res = await api().get('/v1/reference/countries/ng/property-types').expect(200);
      const flat = res.body.find((t: { code: string }) => t.code === 'flat');
      expect(flat).toMatchObject({ category: 'LONG_TERM_RESIDENTIAL', label: 'Flat or apartment' });
      const codes = flat.partTemplate.map((p: { code: string }) => p.code);
      expect(codes).toEqual(expect.arrayContaining(['bedroom', 'bathroom', 'toilet', 'walkthrough']));
      expect(flat.partTemplate.find((p: { code: string }) => p.code === 'toilet').repeat).toBe('toilets');
    });

    it('lists document types and regions with their cities', async () => {
      const docs = await api().get('/v1/reference/countries/NG/document-types').expect(200);
      expect(docs.body.map((d: { purpose: string }) => d.purpose)).toEqual(expect.arrayContaining(['IDENTITY', 'OWNERSHIP']));
      const regions = await api().get('/v1/reference/countries/NG/regions').expect(200);
      expect(regions.body).toHaveLength(37);
      const edo = regions.body.find((r: { id: string }) => r.id === regionId);
      expect(edo.enabled).toBe(true);
      expect(edo.cities.map((c: { name: string }) => c.name)).toContain('Benin City');
    });

    it('answers not found for a country that is not set up', async () => {
      await api().get('/v1/reference/countries/ZZ/property-types').expect(404);
    });
  });

  describe('buildings', () => {
    it('lets a verified landlord register a building, with the distance to the main road (decision 56)', async () => {
      const landlord = await person(['LANDLORD']);
      const res = await api().post('/v1/buildings').set(bearer(landlord.token)).send(building()).expect(201);
      expect(res.body).toMatchObject({ cityId, area: 'Ugbowo', distanceToMainRoadM: 150, ownerOnPlatform: true, ownerVerified: true, units: [] });
      expect(res.body.location.lat).toBeCloseTo(HERE.lat + (seq * 100) / 111_320, 5);
      expect(res.body.possibleDuplicates).toEqual([]);
      await api().get(`/v1/buildings/${res.body.id}`).set(bearer(landlord.token)).expect(200);
    });

    it('refuses tenants, users below level 2, and cities that are not open', async () => {
      const tenant = await person(['TENANT']);
      const refused = await api().post('/v1/buildings').set(bearer(tenant.token)).send(building()).expect(403);
      expect(refused.body.code).toBe('NOT_A_LISTER');

      const unverified = await person(['LANDLORD'], 1);
      const level = await api().post('/v1/buildings').set(bearer(unverified.token)).send(building()).expect(403);
      expect(level.body.code).toBe('VERIFICATION_REQUIRED');

      const landlord = await person(['LANDLORD']);
      const closed = await prisma.city.findFirstOrThrow({ where: { enabled: false } }).catch(async () =>
        prisma.city.create({ data: { regionId, name: `Closed town ${process.pid}` } }),
      );
      const notOpen = await api().post('/v1/buildings').set(bearer(landlord.token)).send(building({ cityId: closed.id })).expect(400);
      expect(notOpen.body.code).toBe('CITY_NOT_AVAILABLE');
    });

    it('flags a building within the duplicate radius for the verification team', async () => {
      const first = await person(['LANDLORD']);
      const second = await person(['LANDLORD']);
      const a = await api().post('/v1/buildings').set(bearer(first.token)).send(building({ location: north(5000) })).expect(201);
      const b = await api().post('/v1/buildings').set(bearer(second.token)).send(building({ location: north(5005) })).expect(201);
      expect(b.body.possibleDuplicates).toEqual([a.body.id]);
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { entityType: 'Building', entityId: b.body.id } });
      expect(task).toMatchObject({ type: 'DUPLICATE_RESOLUTION', countryCode: 'NG', status: 'OPEN' });
    });

    it('records the landlord for an agent listing with a letter of authority, and keeps buildings private', async () => {
      const agent = await person(['AGENT']);
      const res = await api()
        .post('/v1/buildings')
        .set(bearer(agent.token))
        .send(building({ offPlatformOwner: { name: 'Mr Aigbe', phone: '+234 0806 000 0001' } }))
        .expect(201);
      expect(res.body).toMatchObject({ ownerOnPlatform: false, ownerVerified: false, offPlatformOwnerName: 'Mr Aigbe' });
      const stored = await prisma.building.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.offPlatformOwnerPhone).toBe('+2348060000001');

      const landlord = await person(['LANDLORD']);
      const notAgent = await api()
        .post('/v1/buildings')
        .set(bearer(landlord.token))
        .send(building({ offPlatformOwner: { name: 'Someone', phone: '+2348060000002' } }))
        .expect(400);
      expect(notAgent.body.code).toBe('BAD_REQUEST');

      // Someone else cannot see it; an agent with approved authority can.
      const stranger = await person(['LANDLORD']);
      await api().get(`/v1/buildings/${res.body.id}`).set(bearer(stranger.token)).expect(404);
      const other = await person(['AGENT']);
      await prisma.propertyAuthority.create({ data: { buildingId: res.body.id, agentId: other.id, method: 'LETTER', status: 'APPROVED' } });
      await api().get(`/v1/buildings/${res.body.id}`).set(bearer(other.token)).expect(200);
      const expired = await person(['AGENT']);
      await prisma.propertyAuthority.create({
        data: { buildingId: res.body.id, agentId: expired.id, method: 'LETTER', status: 'APPROVED', validUntil: new Date(Date.now() - 1000) },
      });
      await api().get(`/v1/buildings/${res.body.id}`).set(bearer(expired.token)).expect(404);
    });
  });

  describe('units and the parts checklist', () => {
    it('makes one part per bedroom, bathroom and toilet, keeps notes, and rebuilds the checklist without losing photos', async () => {
      const landlord = await person(['LANDLORD']);
      const b = await api().post('/v1/buildings').set(bearer(landlord.token)).send(building()).expect(201);

      const unit = await api()
        .post(`/v1/buildings/${b.body.id}/units`)
        .set(bearer(landlord.token))
        .send({
          label: 'Flat 3',
          propertyTypeId: flatTypeId,
          bedrooms: 3,
          bathrooms: 2,
          toilets: 3,
          floorLevel: 1,
          floorArea: 120.5,
          details: { furnishing: 'UNFURNISHED', power: ['PREPAID_METER', 'GENERATOR'], water: ['BOREHOLE'], whoMayRent: ['FAMILIES'] },
        })
        .expect(201);
      const codes = unit.body.parts.map((p: { code: string }) => p.code);
      expect(codes).toEqual(
        expect.arrayContaining(['bedroom_1', 'bedroom_2', 'bedroom_3', 'bathroom_1', 'bathroom_2', 'toilet_1', 'toilet_2', 'toilet_3', 'walkthrough']),
      );
      expect(codes).not.toContain('bedroom_4');
      expect(unit.body.parts.find((p: { code: string }) => p.code === 'walkthrough')).toMatchObject({ mediaKind: 'VIDEO', minPhotos: 0, captured: 0, complete: false });
      expect(unit.body).toMatchObject({ floorArea: 120.5, areaUnit: 'SQM', checklistComplete: false, details: { furnishing: 'UNFURNISHED' } });

      // A note on a part (decision 56).
      const noted = await api().patch(`/v1/units/${unit.body.id}/parts/bedroom_1`).set(bearer(landlord.token)).send({ note: ' Newly tiled ' }).expect(200);
      expect(noted.body.parts.find((p: { code: string }) => p.code === 'bedroom_1').note).toBe('Newly tiled');
      await api().patch(`/v1/units/${unit.body.id}/parts/no_such_part`).set(bearer(landlord.token)).send({ note: 'x' }).expect(404);

      // A photo already taken of bedroom 3.
      const bedroom3 = await prisma.unitPart.findUniqueOrThrow({ where: { unitId_code: { unitId: unit.body.id, code: 'bedroom_3' } } });
      await prisma.mediaAsset.create({
        data: { buildingId: b.body.id, unitId: unit.body.id, unitPartId: bedroom3.id, kind: 'PHOTO', status: 'READY', originalKey: 'test/key', capturedAt: new Date(), uploadedById: landlord.id },
      });

      const changed = await api()
        .patch(`/v1/units/${unit.body.id}`)
        .set(bearer(landlord.token))
        .send({ bedrooms: 2, toilets: 4, details: { parkingSpaces: 2 } })
        .expect(200);
      const parts = new Map(changed.body.parts.map((p: { code: string }) => [p.code, p]));
      expect(parts.has('toilet_4')).toBe(true);
      expect(parts.get('bedroom_1')).toMatchObject({ note: 'Newly tiled' });
      // Bedroom 3 is no longer needed, but its photo is kept: the part stays, as optional.
      expect(parts.get('bedroom_3')).toMatchObject({ required: false, captured: 1 });
      expect(changed.body.details).toMatchObject({ furnishing: 'UNFURNISHED', parkingSpaces: 2 });

      const cleared = await api().patch(`/v1/units/${unit.body.id}/parts/bedroom_1`).set(bearer(landlord.token)).send({ note: null }).expect(200);
      expect(cleared.body.parts.find((p: { code: string }) => p.code === 'bedroom_1').note).toBeNull();

      const whole = await api().get(`/v1/buildings/${b.body.id}`).set(bearer(landlord.token)).expect(200);
      expect(whole.body.units.map((u: { label: string }) => u.label)).toEqual(['Flat 3']);
    });

    it("refuses a repeated unit name, details outside the country's choices, and other people's units", async () => {
      const landlord = await person(['LANDLORD']);
      const b = await api().post('/v1/buildings').set(bearer(landlord.token)).send(building()).expect(201);
      const unit = { label: 'Shop 1', propertyTypeId: flatTypeId, bedrooms: 1, bathrooms: 1, toilets: 1 };
      const made = await api().post(`/v1/buildings/${b.body.id}/units`).set(bearer(landlord.token)).send(unit).expect(201);
      const again = await api().post(`/v1/buildings/${b.body.id}/units`).set(bearer(landlord.token)).send(unit).expect(409);
      expect(again.body.code).toBe('UNIT_LABEL_TAKEN');

      for (const details of [{ power: ['NUCLEAR'] }, { furnishing: 'PALATIAL' }, { colour: 'blue' }, { power: ['SOLAR', 'SOLAR'] }]) {
        const res = await api().post(`/v1/buildings/${b.body.id}/units`).set(bearer(landlord.token)).send({ ...unit, label: 'Other', details }).expect(400);
        expect(res.body.code).toBe('INVALID_DETAILS');
      }

      const stranger = await person(['LANDLORD']);
      await api().get(`/v1/units/${made.body.id}`).set(bearer(stranger.token)).expect(404);
      await api().patch(`/v1/units/${made.body.id}`).set(bearer(stranger.token)).send({ bedrooms: 2 }).expect(404);
      await api().post(`/v1/buildings/${b.body.id}/units`).set(bearer(stranger.token)).send({ ...unit, label: 'Mine' }).expect(404);
    });
  });
});
