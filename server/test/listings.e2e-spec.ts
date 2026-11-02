import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import type { StaffRole, UserType } from '../src/generated/prisma/client.js';
import { ListingsService } from '../src/listings/listings.service.js';
import { MediaProcessor } from '../src/media/media.processor.js';
import { PART_SIZE_BYTES } from '../src/media/media.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
/** Benin City, near Ugbowo. */
const HERE = { lat: 6.3912, lng: 5.6198 };
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const naira = (n: number) => ({ amountMinor: String(n * 100), currency: 'NGN' });

/** A sharp, well-lit test photo with a fine pattern, so it passes the quality checks. */
async function goodPhoto(seed = 0): Promise<Buffer> {
  const w = 1200;
  const h = 900;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x >> 3) + (y >> 3) + seed) % 2 === 0 ? 210 : 70;
      raw.fill(v, (y * w + x) * 3, (y * w + x) * 3 + 3);
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

describe('Media, listings, submission and agent authority (API, step 5 part 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let processor: MediaProcessor;
  let seq = 0;
  let cityId: string;
  let regionId: string;
  let flatTypeId: string;
  let original: { region: boolean; city: boolean };
  let photo: Buffer;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const pathOf = (url: string) => new URL(url).pathname;
  const newPhone = () => `+234807${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  const north = (metres: number) => ({ lat: HERE.lat + metres / 111_320, lng: HERE.lng });

  interface Person {
    id: string;
    token: string;
  }

  async function person(types: UserType[], staff?: StaffRole[]): Promise<Person> {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `list${process.pid}.${seq}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Osaro',
        lastName: `Lister ${seq}`,
        countryCode: 'NG',
        types,
        ...(staff ? { staff: { create: { roles: staff, countryScopes: ['NG'] } } } : {}),
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    if (staff) await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { twoStepAt: new Date() } });
    return { id: user.id, token: res.body.accessToken };
  }

  /** A building and a one-bedroom flat; returns their ids and where the building stands. */
  async function buildingWithFlat(p: Person, over: Record<string, unknown> = {}) {
    const at = north(++seq * 300);
    const b = await api()
      .post('/v1/buildings')
      .set(bearer(p.token))
      .send({ cityId, area: 'Ugbowo', street: `Uselu-Lagos Road ${seq}`, houseNumber: String(seq), location: at, locationAccuracyM: 5, ...over })
      .expect(201);
    const u = await api()
      .post(`/v1/buildings/${b.body.id}/units`)
      .set(bearer(p.token))
      .send({ label: 'Flat 1', propertyTypeId: flatTypeId, bedrooms: 1, bathrooms: 1, toilets: 1 })
      .expect(201);
    return { buildingId: b.body.id as string, unitId: u.body.id as string, at, parts: u.body.parts as { code: string; mediaKind: string; minPhotos: number; required: boolean }[] };
  }

  const mediaStart = (p: Person, unitId: string, body: Record<string, unknown>, key?: string) => {
    const r = api().post(`/v1/units/${unitId}/media`).set(bearer(p.token));
    if (key) r.set('Idempotency-Key', key);
    return r.send(body);
  };

  /** Uploads one photo through the API, then processes it as the media worker would. */
  async function uploadPhoto(p: Person, unitId: string, at: { lat: number; lng: number }, partCode: string, data = photo) {
    const start = await mediaStart(p, unitId, {
      partCode,
      kind: 'PHOTO',
      contentType: 'image/jpeg',
      sizeBytes: data.length,
      sha256: sha(data),
      capturedAt: new Date().toISOString(),
      captureLocation: at,
      captureAccuracyM: 8,
    }).expect(201);
    await api().put(pathOf(start.body.partUrls[0])).set(start.body.uploadHeaders).send(data).expect(200);
    const done = await api().post(`/v1/media/${start.body.mediaId}/complete`).set(bearer(p.token)).expect(202);
    expect(done.body.status).toBe('PROCESSING');
    await processor.process(start.body.mediaId);
    return start.body.mediaId as string;
  }

  /** Marks every required part as photographed (and the walkthrough as recorded), straight in the database. */
  async function fillChecklist(unitId: string, buildingId: string, uploaderId: string) {
    const parts = await prisma.unitPart.findMany({ where: { unitId, required: true } });
    for (const part of parts) {
      const have = await prisma.mediaAsset.count({ where: { unitPartId: part.id, status: 'READY' } });
      const need = Math.max(part.minPhotos, 1) - have;
      for (let i = 0; i < need; i++) {
        await prisma.mediaAsset.create({
          data: {
            buildingId,
            unitId,
            unitPartId: part.id,
            kind: part.mediaKind === 'VIDEO' ? 'VIDEO' : 'PHOTO',
            status: 'READY',
            originalKey: `test/${part.id}/${i}`,
            capturedAt: new Date(),
            uploadedById: uploaderId,
          },
        });
      }
    }
  }

  async function ownershipDocument(p: Person, buildingId: string) {
    const data = Buffer.from(`%PDF-1.4 Certificate of Occupancy ${seq}`);
    const start = await api()
      .post('/v1/documents')
      .set(bearer(p.token))
      .send({ documentTypeCode: 'CERTIFICATE_OF_OCCUPANCY', purpose: 'OWNERSHIP', buildingId, contentType: 'application/pdf', sizeBytes: data.length, sha256: sha(data) })
      .expect(201);
    await api().put(pathOf(start.body.uploadUrl)).set(start.body.uploadHeaders).send(data).expect(200);
    await api().post(`/v1/documents/${start.body.documentId}/complete`).set(bearer(p.token)).expect(200);
    return start.body.documentId as string;
  }

  const draft = (unitId: string, over: Record<string, unknown> = {}) => ({
    unitId,
    kind: 'LONG_TERM',
    title: 'Clean one bedroom flat in Ugbowo',
    description: 'A clean one bedroom flat close to the university, with a prepaid meter and a borehole.',
    rent: naira(600_000),
    rentPeriod: 'YEAR',
    agencyFee: naira(60_000),
    legalFee: naira(30_000),
    cautionDeposit: naira(50_000),
    serviceCharge: naira(0),
    ...over,
  });

  const decide = (staff: Person, taskId: string, outcome: string) =>
    api().post(`/v1/admin/review-tasks/${taskId}/decision`).set(bearer(staff.token)).send({ outcome, notes: 'Desk review done' });
  const openTask = (entityId: string) => prisma.reviewTask.findFirstOrThrow({ where: { entityId, status: { in: ['OPEN', 'ASSIGNED'] } } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    processor = app.get(MediaProcessor);
    const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' }, include: { region: true } });
    cityId = city.id;
    regionId = city.regionId;
    original = { region: city.region.enabled, city: city.enabled };
    await prisma.region.update({ where: { id: regionId }, data: { enabled: true } });
    await prisma.city.update({ where: { id: cityId }, data: { enabled: true } });
    flatTypeId = (await prisma.propertyType.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'NG', code: 'flat' } } })).id;
    photo = await goodPhoto();
  });

  afterAll(async () => {
    await prisma.city.update({ where: { id: cityId }, data: { enabled: original.city } });
    await prisma.region.update({ where: { id: regionId }, data: { enabled: original.region } });
    await app.close();
  });

  describe('photo and video upload', () => {
    it('accepts a photo taken at the building, and makes watermarked display copies behind expiring links', async () => {
      const landlord = await person(['LANDLORD']);
      const { unitId, at } = await buildingWithFlat(landlord);
      const id = await uploadPhoto(landlord, unitId, at, 'living_room');
      const list = (await api().get(`/v1/units/${unitId}/media`).set(bearer(landlord.token)).expect(200)).body;
      const item = list.find((m: { id: string }) => m.id === id);
      expect(item.status).toBe('READY');
      expect(Object.keys(item.display).sort()).toEqual(['expiresAt', 'large', 'medium', 'small']);
      // The display copy is a watermarked JPEG, smaller than the original, with no hidden location data.
      const small = await api().get(pathOf(item.display.small)).responseType('blob').expect(200);
      const meta = await sharp(small.body as Buffer).metadata();
      expect(meta.width).toBe(480);
      expect(meta.exif).toBeUndefined();
      const row = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
      expect(row.perceptualHash).toMatch(/^[0-9a-f]{16}$/);
      // The checklist counts it.
      const unit = (await api().get(`/v1/units/${unitId}`).set(bearer(landlord.token)).expect(200)).body;
      expect(unit.parts.find((p: { code: string }) => p.code === 'living_room').captured).toBe(1);
    });

    it('rejects a blurred photo with its reason, so the app asks for a retake', async () => {
      const landlord = await person(['LANDLORD']);
      const { unitId, at } = await buildingWithFlat(landlord);
      const blurred = await sharp(photo).blur(10).jpeg().toBuffer();
      const id = await uploadPhoto(landlord, unitId, at, 'kitchen', blurred);
      const list = (await api().get(`/v1/units/${unitId}/media`).set(bearer(landlord.token)).expect(200)).body;
      const item = list.find((m: { id: string }) => m.id === id);
      expect(item.status).toBe('REJECTED');
      expect(item.rejectionReasons).toContain('BLURRY');
      expect(item.display).toBeNull();
    });

    it('refuses media taken away from the building, too long ago, or of the wrong kind for the part', async () => {
      const landlord = await person(['LANDLORD']);
      const { unitId, at } = await buildingWithFlat(landlord);
      const base = { partCode: 'kitchen', kind: 'PHOTO', contentType: 'image/jpeg', sizeBytes: photo.length, sha256: sha(photo), capturedAt: new Date().toISOString(), captureLocation: at };
      const far = await mediaStart(landlord, unitId, { ...base, captureLocation: north(seq * 300 + 5_000) }).expect(422);
      expect(far.body.code).toBe('CAPTURE_TOO_FAR');
      const old = await mediaStart(landlord, unitId, { ...base, capturedAt: new Date(Date.now() - 80 * 3_600_000).toISOString() }).expect(422);
      expect(old.body.code).toBe('CAPTURE_TOO_OLD');
      expect((await mediaStart(landlord, unitId, { ...base, kind: 'VIDEO', contentType: 'video/mp4' }).expect(400)).body.code).toBe('WRONG_MEDIA_KIND');
      expect((await mediaStart(landlord, unitId, { ...base, partCode: 'walkthrough' }).expect(400)).body.code).toBe('WRONG_MEDIA_KIND');
      expect((await mediaStart(landlord, unitId, { ...base, partCode: 'swimming_pool' }).expect(400)).body.code).toBe('UNKNOWN_PART');
      expect((await mediaStart(landlord, unitId, { ...base, kind: 'PHOTO_360' }).expect(403)).body.code).toBe('FEATURE_UNAVAILABLE');
      // Someone who may not manage the building is told the unit does not exist.
      const stranger = await person(['LANDLORD']);
      await mediaStart(stranger, unitId, base).expect(404);
    });

    it('resumes an interrupted upload in parts, and refuses a file that is not the one declared', async () => {
      const landlord = await person(['LANDLORD']);
      const { unitId, at } = await buildingWithFlat(landlord);
      // A "video" just over one part long: two parts. Its content is not a real video.
      const data = Buffer.alloc(PART_SIZE_BYTES + 1000, 7);
      const body = { partCode: 'walkthrough', kind: 'VIDEO', contentType: 'video/mp4', sizeBytes: data.length, sha256: sha(data), capturedAt: new Date().toISOString(), captureLocation: at };
      const first = await mediaStart(landlord, unitId, body, 'walk-1').expect(201);
      expect(first.body.partUrls).toHaveLength(2);
      await api().put(pathOf(first.body.partUrls[0])).set(first.body.uploadHeaders).send(data.subarray(0, PART_SIZE_BYTES)).expect(200);
      // The connection drops; finishing now says what is missing.
      const early = await api().post(`/v1/media/${first.body.mediaId}/complete`).set(bearer(landlord.token)).expect(409);
      expect(early.body).toMatchObject({ code: 'UPLOAD_NOT_FOUND', receivedParts: [1], partCount: 2 });
      // Asking again with the same key carries on with the same upload.
      const again = await mediaStart(landlord, unitId, body, 'walk-1').expect(201);
      expect(again.body.mediaId).toBe(first.body.mediaId);
      expect(again.body.receivedParts).toEqual([1]);
      await api().put(pathOf(again.body.partUrls[1])).set(again.body.uploadHeaders).send(data.subarray(PART_SIZE_BYTES)).expect(200);
      await api().post(`/v1/media/${first.body.mediaId}/complete`).set(bearer(landlord.token)).expect(202);
      // Confirming twice is harmless.
      await api().post(`/v1/media/${first.body.mediaId}/complete`).set(bearer(landlord.token)).expect(202);
      await processor.process(first.body.mediaId);
      expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: first.body.mediaId } })).status).toBe('REJECTED');

      // A file that differs from what was declared is removed.
      const wrong = await mediaStart(landlord, unitId, { ...body, partCode: 'walkthrough', sizeBytes: 100, sha256: sha(Buffer.alloc(100, 1)) }).expect(201);
      await api().put(pathOf(wrong.body.partUrls[0])).set(wrong.body.uploadHeaders).send(Buffer.alloc(100, 2)).expect(200);
      expect((await api().post(`/v1/media/${wrong.body.mediaId}/complete`).set(bearer(landlord.token)).expect(400)).body.code).toBe('UPLOAD_MISMATCH');
    });
  });

  describe('listings', () => {
    it('takes a landlord from draft to live, through a desk review', async () => {
      const landlord = await person(['LANDLORD']);
      const verifier = await person(['TENANT'], ['VERIFIER']);
      const { buildingId, unitId, at } = await buildingWithFlat(landlord);

      // Every fee must be entered, in the country's currency.
      expect((await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId, { legalFee: undefined })).expect(400)).body.message).toMatch(/legalFee/);
      expect((await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId, { rent: { amountMinor: '100', currency: 'USD' } })).expect(400)).body.code).toBe('WRONG_CURRENCY');
      expect((await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId, { rentPeriod: 'NIGHT' })).expect(400)).body.message).toMatch(/year or month/);

      const created = (await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId)).expect(201)).body;
      expect(created).toMatchObject({ status: 'DRAFT', moveInCost: { total: { amountMinor: '74000000', currency: 'NGN' }, inspectionFee: 'FREE' } });
      expect((await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId)).expect(409)).body.code).toBe('LISTING_EXISTS');

      // Not ready: photos, the walkthrough and an ownership document are missing.
      const incomplete = (await api().post(`/v1/listings/${created.id}/submit`).set(bearer(landlord.token)).expect(422)).body;
      const kinds = new Set(incomplete.missing.map((m: { kind: string }) => m.kind));
      expect([...kinds].sort()).toEqual(['OWNERSHIP_DOCUMENT', 'PART_MEDIA', 'WALKTHROUGH']);

      await uploadPhoto(landlord, unitId, at, 'living_room');
      await fillChecklist(unitId, buildingId, landlord.id);
      await ownershipDocument(landlord, buildingId);
      const submitted = (await api().post(`/v1/listings/${created.id}/submit`).set(bearer(landlord.token)).expect(200)).body;
      expect(submitted.status).toBe('IN_REVIEW');
      expect(submitted.coverImage).toMatch(/^http/);

      // While waiting for review, nothing changes.
      expect((await api().patch(`/v1/listings/${created.id}`).set(bearer(landlord.token)).send({ title: 'A new title here' }).expect(409)).body.code).toBe('LISTING_LOCKED');
      const anyMedia = await prisma.mediaAsset.findFirstOrThrow({ where: { unitId, status: 'READY' } });
      expect((await api().delete(`/v1/media/${anyMedia.id}`).set(bearer(landlord.token)).expect(409)).body.code).toBe('LISTING_LOCKED');

      // The landlord cannot review his own listing, even if he is also staff.
      const task = await openTask(created.id);
      expect(task.type).toBe('LISTING_REVIEW');
      await decide(verifier, task.id, 'APPROVE').expect(200);
      const live = (await api().get(`/v1/listings/${created.id}`).set(bearer(landlord.token)).expect(200)).body;
      expect(live.status).toBe('LIVE');
      expect(new Date(live.expiresAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
      const docs = await prisma.document.findMany({ where: { buildingId, purpose: 'OWNERSHIP' } });
      expect(docs.every((d) => d.status === 'PASSED')).toBe(true);

      // A live listing can change its text and fees, and fee changes are recorded; not its kind of rent.
      await api().patch(`/v1/listings/${created.id}`).set(bearer(landlord.token)).send({ agencyFee: naira(50_000) }).expect(200);
      const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id, action: 'listing.fees_changed' } });
      expect(log.metadata).toMatchObject({ agencyFee: { from: '6000000', to: '5000000' } });
      expect((await api().patch(`/v1/listings/${created.id}`).set(bearer(landlord.token)).send({ rentPeriod: 'MONTH' }).expect(409)).body.code).toBe('FIELD_LOCKED');

      // Pause, resume, confirm still available, and close.
      expect((await api().post(`/v1/listings/${created.id}/status`).set(bearer(landlord.token)).send({ action: 'PAUSE' }).expect(200)).body.status).toBe('PAUSED');
      expect((await api().post(`/v1/listings/${created.id}/status`).set(bearer(landlord.token)).send({ action: 'RESUME' }).expect(200)).body.status).toBe('LIVE');
      await api().post(`/v1/listings/${created.id}/confirm-available`).set(bearer(landlord.token)).expect(200);
      const mine = (await api().get('/v1/me/listings?status=LIVE').set(bearer(landlord.token)).expect(200)).body;
      expect(mine.items.map((l: { id: string }) => l.id)).toContain(created.id);
      expect((await api().post(`/v1/listings/${created.id}/status`).set(bearer(landlord.token)).send({ action: 'CLOSE' }).expect(200)).body.status).toBe('REMOVED');
    });

    it('returns a rejected listing to the lister, who can correct it and submit again', async () => {
      const landlord = await person(['LANDLORD']);
      const verifier = await person(['TENANT'], ['VERIFIER']);
      const { buildingId, unitId } = await buildingWithFlat(landlord);
      const listing = (await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId)).expect(201)).body;
      await fillChecklist(unitId, buildingId, landlord.id);
      await ownershipDocument(landlord, buildingId);
      await api().post(`/v1/listings/${listing.id}/submit`).set(bearer(landlord.token)).expect(200);
      await decide(verifier, (await openTask(listing.id)).id, 'REJECT').expect(200);
      const back = (await api().get(`/v1/listings/${listing.id}`).set(bearer(landlord.token)).expect(200)).body;
      expect(back).toMatchObject({ status: 'REJECTED', review: { outcome: 'REJECT', notes: 'Desk review done' } });
      await api().patch(`/v1/listings/${listing.id}`).set(bearer(landlord.token)).send({ title: 'Corrected title for the flat' }).expect(200);
      expect((await api().post(`/v1/listings/${listing.id}/submit`).set(bearer(landlord.token)).expect(200)).body.status).toBe('IN_REVIEW');
    });

    it('expires a live listing whose lister did not confirm it is still available', async () => {
      const landlord = await person(['LANDLORD']);
      const { unitId } = await buildingWithFlat(landlord);
      const listing = (await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId)).expect(201)).body;
      await prisma.listing.update({ where: { id: listing.id }, data: { status: 'LIVE', expiresAt: new Date(Date.now() - 60_000) } });
      expect(await app.get(ListingsService).expireOverdue()).toBeGreaterThanOrEqual(1);
      expect((await api().get(`/v1/listings/${listing.id}`).set(bearer(landlord.token)).expect(200)).body.status).toBe('EXPIRED');
    });
  });

  describe('agent authority', () => {
    it('lets an agent list for a landlord who is not on the app, after the team confirms the letter', async () => {
      const agent = await person(['AGENT']);
      const verifier = await person(['TENANT'], ['VERIFIER']);
      const { buildingId, unitId } = await buildingWithFlat(agent, { offPlatformOwner: { name: 'Mr Osagie Igbinedion', phone: '+2348031110000' } });
      const listing = (await api().post('/v1/listings').set(bearer(agent.token)).send(draft(unitId)).expect(201)).body;
      await fillChecklist(unitId, buildingId, agent.id);
      expect((await api().post(`/v1/listings/${listing.id}/submit`).set(bearer(agent.token)).expect(422)).body.missing.map((m: { kind: string }) => m.kind)).toEqual(['AUTHORITY']);

      // An agent cannot upload ownership documents; he sends the letter and the landlord's identity document.
      await api().post('/v1/documents').set(bearer(agent.token)).send({ documentTypeCode: 'CERTIFICATE_OF_OCCUPANCY', purpose: 'OWNERSHIP', buildingId, contentType: 'application/pdf', sizeBytes: 10, sha256: sha(Buffer.alloc(10)) }).expect(404);
      const upload = async (code: string) => {
        const data = Buffer.from(`${code} ${seq++}`);
        const s = await api().post('/v1/documents').set(bearer(agent.token)).send({ documentTypeCode: code, purpose: 'AUTHORITY_LETTER', buildingId, contentType: 'application/pdf', sizeBytes: data.length, sha256: sha(data) }).expect(201);
        await api().put(pathOf(s.body.uploadUrl)).set(s.body.uploadHeaders).send(data).expect(200);
        await api().post(`/v1/documents/${s.body.documentId}/complete`).set(bearer(agent.token)).expect(200);
        return s.body.documentId as string;
      };
      const letterDocumentId = await upload('LETTER_OF_AUTHORITY');
      const landlordIdDocumentId = await upload('NIN_SLIP');
      expect((await api().post(`/v1/buildings/${buildingId}/authorities`).set(bearer(agent.token)).send({ method: 'LETTER', letterDocumentId }).expect(400)).body.code).toBe('DOCUMENTS_REQUIRED');
      const authority = (await api().post(`/v1/buildings/${buildingId}/authorities`).set(bearer(agent.token)).send({ method: 'LETTER', letterDocumentId, landlordIdDocumentId }).expect(201)).body;
      expect(authority.status).toBe('REQUESTED');
      expect((await api().post(`/v1/buildings/${buildingId}/authorities`).set(bearer(agent.token)).send({ method: 'LETTER', letterDocumentId, landlordIdDocumentId }).expect(409)).body.code).toBe('AUTHORITY_EXISTS');

      const task = await openTask(authority.id);
      expect(task.type).toBe('AUTHORITY_CONFIRMATION');
      await decide(verifier, task.id, 'APPROVE').expect(200);
      expect((await api().post(`/v1/listings/${listing.id}/submit`).set(bearer(agent.token)).expect(200)).body.status).toBe('IN_REVIEW');
    });

    it('lets a landlord on the app approve an agent, and withdraw him at once', async () => {
      const landlord = await person(['LANDLORD']);
      const agent = await person(['AGENT']);
      const { buildingId, unitId } = await buildingWithFlat(landlord);
      const listing = (await api().post('/v1/listings').set(bearer(landlord.token)).send(draft(unitId)).expect(201)).body;

      // Before approval the agent cannot see the listing, and must use the in-app route.
      await api().get(`/v1/listings/${listing.id}`).set(bearer(agent.token)).expect(404);
      expect((await api().post(`/v1/buildings/${buildingId}/authorities`).set(bearer(agent.token)).send({ method: 'LETTER' }).expect(400)).body.code).toBe('WRONG_METHOD');
      const req = (await api().post(`/v1/buildings/${buildingId}/authorities`).set(bearer(agent.token)).send({ method: 'IN_APP_APPROVAL' }).expect(201)).body;

      // Only the landlord decides.
      await api().post(`/v1/authorities/${req.id}/decision`).set(bearer(agent.token)).send({ decision: 'APPROVE' }).expect(404);
      expect((await api().post(`/v1/authorities/${req.id}/decision`).set(bearer(landlord.token)).send({ decision: 'APPROVE' }).expect(200)).body.status).toBe('APPROVED');
      await api().get(`/v1/listings/${listing.id}`).set(bearer(agent.token)).expect(200);
      const list = (await api().get(`/v1/buildings/${buildingId}/authorities`).set(bearer(landlord.token)).expect(200)).body;
      expect(list[0]).toMatchObject({ agentId: agent.id, status: 'APPROVED' });

      await api().post(`/v1/authorities/${req.id}/decision`).set(bearer(landlord.token)).send({ decision: 'REVOKE' }).expect(200);
      await api().get(`/v1/listings/${listing.id}`).set(bearer(agent.token)).expect(404);
    });
  });
});
