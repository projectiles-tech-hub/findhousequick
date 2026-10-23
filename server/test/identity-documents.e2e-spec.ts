import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import type { StaffRole } from '../src/generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../src/integrations/storage/private-storage.js';
import { RetentionService } from '../src/jobs/retention.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
const PHOTO = Buffer.from('pretend this is a photo of a driving licence');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('Identity documents and the verification queue (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: PrivateStorage;
  let seq = 0;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const newPhone = () => `+234808${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  const newNin = () => `${String(Date.now()).slice(-6)}${String(++seq).padStart(5, '0')}`;
  /** The path part of an absolute link from the server, for supertest. */
  const pathOf = (url: string) => new URL(url).pathname;

  interface Person {
    id: string;
    token: string;
  }

  async function person(opts: { level?: 1 | 2; types?: ('TENANT' | 'AGENT')[]; staff?: { roles: StaffRole[]; scopes?: string[]; twoStep?: boolean } } = {}) {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `docs${process.pid}.${seq}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: opts.level === 2 ? new Date() : null,
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Chidi',
        lastName: 'Okafor',
        countryCode: 'NG',
        types: opts.types ?? ['TENANT'],
        ...(opts.staff ? { staff: { create: { roles: opts.staff.roles, countryScopes: opts.staff.scopes ?? ['NG'] } } } : {}),
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    if (opts.staff && opts.staff.twoStep !== false) {
      // Two-step login itself is tested in the staff tests; here the device is simply marked as having passed it.
      await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { twoStepAt: new Date() } });
    }
    return { id: user.id, token: res.body.accessToken } as Person;
  }

  const verifier = () => person({ staff: { roles: ['VERIFIER'] } });

  /** Starts, uploads and completes an identity document photo. */
  async function uploadPhoto(p: Person, data = PHOTO, declared = data) {
    const start = await api()
      .post('/v1/documents')
      .set(bearer(p.token))
      .send({ documentTypeCode: 'DRIVERS_LICENCE', purpose: 'IDENTITY', contentType: 'image/jpeg', sizeBytes: declared.length, sha256: sha(declared) })
      .expect(201);
    await api().put(pathOf(start.body.uploadUrl)).set(start.body.uploadHeaders).send(data).expect(200);
    return start.body.documentId as string;
  }

  /** A check that ended with "face does not match", so a document photo may be added. */
  async function failedCheck(p: Person, nin = newNin()) {
    const check = (await api().post('/v1/identity/checks').set(bearer(p.token)).send({ idType: 'NIN', idNumber: nin, consent: true }).expect(201)).body;
    await api()
      .post('/v1/identity/provider-results/test')
      .send({ reference: check.providerSession.reference, idFound: true, nameOnId: 'Chidi Okafor', livenessPassed: true, faceMatched: false })
      .expect(200);
    return check.id as string;
  }

  const taskFor = (entityId: string) => prisma.reviewTask.findFirstOrThrow({ where: { entityId, status: { in: ['OPEN', 'ASSIGNED'] } } });
  const decide = (staff: Person, taskId: string, outcome: string) =>
    api().post(`/v1/admin/review-tasks/${taskId}/decision`).set(bearer(staff.token)).send({ outcome, notes: 'Checked against the photo' });
  const levelOf = async (p: Person) => (await api().get('/v1/me').set(bearer(p.token)).expect(200)).body.verificationLevel;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(PRIVATE_STORAGE);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('private document upload', () => {
    it('uploads through a short-lived link and checks the file before accepting it', async () => {
      const p = await person();
      const id = await uploadPhoto(p);
      const done = await api().post(`/v1/documents/${id}/complete`).set(bearer(p.token)).expect(200);
      expect(done.body).toMatchObject({ id, documentTypeCode: 'DRIVERS_LICENCE', purpose: 'IDENTITY', status: 'PENDING', uploaded: true });
      await api().post(`/v1/documents/${id}/complete`).set(bearer(p.token)).expect(200);
      const doc = await prisma.document.findUniqueOrThrow({ where: { id } });
      expect(await storage.inspect(doc.storageKey)).toEqual({ sizeBytes: PHOTO.length, sha256: sha(PHOTO) });
    });

    it('removes a file that is not the one declared', async () => {
      const p = await person();
      const other = Buffer.from('a different file of a different length entirely');
      const start = await api()
        .post('/v1/documents')
        .set(bearer(p.token))
        .send({ documentTypeCode: 'DRIVERS_LICENCE', purpose: 'IDENTITY', contentType: 'image/jpeg', sizeBytes: other.length, sha256: sha(PHOTO) })
        .expect(201);
      await api().put(pathOf(start.body.uploadUrl)).set(start.body.uploadHeaders).send(other).expect(200);
      expect((await api().post(`/v1/documents/${start.body.documentId}/complete`).set(bearer(p.token)).expect(400)).body.code).toBe('UPLOAD_MISMATCH');
      const doc = await prisma.document.findUniqueOrThrow({ where: { id: start.body.documentId } });
      expect(await storage.inspect(doc.storageKey)).toBeNull();
    });

    it('says when the file has not arrived, and refuses altered links, wrong types and oversized files', async () => {
      const p = await person();
      const start = await api()
        .post('/v1/documents')
        .set(bearer(p.token))
        .send({ documentTypeCode: 'NIN_SLIP', purpose: 'IDENTITY', contentType: 'image/png', sizeBytes: PHOTO.length, sha256: sha(PHOTO) })
        .expect(201);
      expect((await api().post(`/v1/documents/${start.body.documentId}/complete`).set(bearer(p.token)).expect(409)).body.code).toBe('UPLOAD_NOT_FOUND');
      const path = pathOf(start.body.uploadUrl);
      await api().put(`${path.slice(0, -2)}xx`).set('Content-Type', 'image/png').send(PHOTO).expect(403);
      await api().put(path).set('Content-Type', 'image/jpeg').send(PHOTO).expect(400);
      await api().put(path).set('Content-Type', 'image/png').send(Buffer.concat([PHOTO, PHOTO])).expect(413);
    });

    it('accepts only the country’s identity document types, and only identity documents so far', async () => {
      const p = await person();
      const body = { purpose: 'IDENTITY', contentType: 'image/jpeg', sizeBytes: 10, sha256: sha(PHOTO) };
      expect((await api().post('/v1/documents').set(bearer(p.token)).send({ ...body, documentTypeCode: 'NIN' }).expect(400)).body.code).toBe(
        'DOCUMENT_TYPE_NOT_ACCEPTED',
      );
      expect(
        (await api().post('/v1/documents').set(bearer(p.token)).send({ ...body, documentTypeCode: 'SURVEY_PLAN', purpose: 'OWNERSHIP' }).expect(400)).body
          .code,
      ).toBe('PURPOSE_NOT_AVAILABLE');
    });

    it('returns the same document for the same Idempotency-Key', async () => {
      const p = await person();
      const send = () =>
        api()
          .post('/v1/documents')
          .set(bearer(p.token))
          .set('Idempotency-Key', `key-${seq}`)
          .send({ documentTypeCode: 'DRIVERS_LICENCE', purpose: 'IDENTITY', contentType: 'image/jpeg', sizeBytes: PHOTO.length, sha256: sha(PHOTO) });
      const a = (await send().expect(201)).body;
      const b = (await send().expect(201)).body;
      expect(b.documentId).toBe(a.documentId);
    });

    it('needs level 1', async () => {
      const phone = newPhone();
      await prisma.user.create({
        data: { phone, phoneVerifiedAt: new Date(), passwordHash: await hashPassword(PASSWORD), firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'] },
      });
      const token = (await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200)).body.accessToken;
      expect((await api().post('/v1/documents').set(bearer(token)).send({}).expect(403)).body.code).toBe('VERIFICATION_REQUIRED');
    });
  });

  describe('adding a document photo to a check (decision 49)', () => {
    it('sends the check to the verification team', async () => {
      const p = await person();
      const checkId = await failedCheck(p);
      const docId = await uploadPhoto(p);
      // Not complete yet.
      expect((await api().post(`/v1/identity/checks/${checkId}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(409)).body.code).toBe(
        'UPLOAD_NOT_COMPLETE',
      );
      await api().post(`/v1/documents/${docId}/complete`).set(bearer(p.token)).expect(200);
      const res = await api().post(`/v1/identity/checks/${checkId}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(200);
      expect(res.body).toMatchObject({ status: 'MANUAL_REVIEW', nextAction: null, documentAttached: true });
      expect((await taskFor(checkId)).type).toBe('IDENTITY_REVIEW');
    });

    it('is refused when the check did not ask for one, or the document is someone else’s', async () => {
      const p = await person();
      const stranger = await person();
      const pending = (await api().post('/v1/identity/checks').set(bearer(p.token)).send({ idType: 'NIN', idNumber: newNin(), consent: true }).expect(201)).body;
      const docId = await uploadPhoto(p);
      await api().post(`/v1/documents/${docId}/complete`).set(bearer(p.token)).expect(200);
      expect((await api().post(`/v1/identity/checks/${pending.id}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(409)).body.code).toBe(
        'DOCUMENT_NOT_REQUESTED',
      );
      const strangerCheck = await failedCheck(stranger);
      await api().post(`/v1/identity/checks/${strangerCheck}/document`).set(bearer(stranger.token)).send({ documentId: docId }).expect(404);
    });
  });

  describe('the verification queue', () => {
    it('lets a verifier pass a check after looking at the photo; the user reaches level 2', async () => {
      const p = await person();
      const staff = await verifier();
      const checkId = await failedCheck(p);
      const docId = await uploadPhoto(p);
      await api().post(`/v1/documents/${docId}/complete`).set(bearer(p.token)).expect(200);
      await api().post(`/v1/identity/checks/${checkId}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(200);

      const ng = await prisma.country.findUniqueOrThrow({ where: { code: 'NG' } });
      const settings = ng.settings as Record<string, object>;
      await prisma.country.update({ where: { code: 'NG' }, data: { settings: { ...settings, retention: { identityImagesDays: 30 } } } });
      try {
        const list = (await api().get('/v1/admin/review-tasks?type=IDENTITY_REVIEW').set(bearer(staff.token)).expect(200)).body;
        const item = list.items.find((t: { entityId: string }) => t.entityId === checkId);
        expect(item.details).toMatchObject({ accountName: 'Chidi Okafor', idType: 'NIN', failureReason: 'FACE_MISMATCH', documentId: docId });
        expect(item.details.idNumberLast4).toHaveLength(4);

        const view = await api().post(`/v1/admin/documents/${docId}/view`).set(bearer(staff.token)).send({ reason: 'Identity review' }).expect(200);
        const file = await api().get(pathOf(view.body.url)).buffer(true).parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
        expect(Buffer.compare(file.body as Buffer, PHOTO)).toBe(0);
        const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'document.viewed', entityId: docId } });
        expect(log).toMatchObject({ actorId: staff.id, metadata: { reason: 'Identity review' } });

        const decided = await decide(staff, item.id, 'APPROVE').expect(200);
        expect(decided.body).toMatchObject({ status: 'DONE', outcome: 'APPROVE', assignedToId: staff.id });
        expect(await levelOf(p)).toBe(2);
        const doc = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
        expect(doc.status).toBe('PASSED');
        const days = (doc.deleteAfter!.getTime() - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(29.9);
        expect(days).toBeLessThan(30.1);
        expect((await decide(staff, item.id, 'REJECT').expect(409)).body.code).toBe('TASK_CLOSED');
      } finally {
        await prisma.country.update({ where: { code: 'NG' }, data: { settings: ng.settings as object } });
      }
    });

    it('after a rejection, the user can try again but cannot reuse the same document', async () => {
      const p = await person();
      const staff = await verifier();
      const first = await failedCheck(p);
      const docId = await uploadPhoto(p);
      await api().post(`/v1/documents/${docId}/complete`).set(bearer(p.token)).expect(200);
      await api().post(`/v1/identity/checks/${first}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(200);
      await decide(staff, (await taskFor(first)).id, 'REJECT').expect(200);
      expect((await api().get(`/v1/identity/checks/${first}`).set(bearer(p.token))).body).toMatchObject({ status: 'FAILED', nextAction: null });
      expect(await levelOf(p)).toBe(1);

      const second = await failedCheck(p);
      expect((await api().post(`/v1/identity/checks/${second}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(409)).body.code).toBe(
        'DOCUMENT_ALREADY_USED',
      );
    });

    it('never passes an ID already verified on another account', async () => {
      const nin = newNin();
      const owner = await person();
      const staff = await verifier();
      const ownerCheck = (await api().post('/v1/identity/checks').set(bearer(owner.token)).send({ idType: 'NIN', idNumber: nin, consent: true }).expect(201)).body;
      await api()
        .post('/v1/identity/provider-results/test')
        .send({ reference: ownerCheck.providerSession.reference, idFound: true, nameOnId: 'Chidi Okafor', livenessPassed: true, faceMatched: true })
        .expect(200);
      const copier = await person();
      const dup = await api().post('/v1/identity/checks').set(bearer(copier.token)).send({ idType: 'NIN', idNumber: nin, consent: true }).expect(409);
      const task = await taskFor(dup.body.check.id);
      expect(task.type).toBe('DUPLICATE_RESOLUTION');
      expect((await decide(staff, task.id, 'APPROVE').expect(409)).body.code).toBe('ID_HELD_BY_ANOTHER_ACCOUNT');
      await decide(staff, task.id, 'REJECT').expect(200);
      expect(await levelOf(copier)).toBe(1);
    });

    it('decides agent company details', async () => {
      const agent = await person({ level: 2, types: ['AGENT'] });
      const staff = await verifier();
      await api().put('/v1/me/agent-profile').set(bearer(agent.token)).send({ businessName: 'Okafor Homes' }).expect(200);
      await decide(staff, (await taskFor(agent.id)).id, 'APPROVE').expect(200);
      expect((await api().get('/v1/me/agent-profile').set(bearer(agent.token))).body.status).toBe('PASSED');
    });

    it('keeps each staff member to their own countries, roles, two-step login and other people’s cases', async () => {
      const p = await person();
      const checkId = await failedCheck(p);
      const docId = await uploadPhoto(p);
      await api().post(`/v1/documents/${docId}/complete`).set(bearer(p.token)).expect(200);
      await api().post(`/v1/identity/checks/${checkId}/document`).set(bearer(p.token)).send({ documentId: docId }).expect(200);
      const task = await taskFor(checkId);

      const ghana = await person({ staff: { roles: ['VERIFIER'], scopes: ['GH'] } });
      const list = (await api().get('/v1/admin/review-tasks').set(bearer(ghana.token)).expect(200)).body;
      expect(list.items.some((t: { id: string }) => t.id === task.id)).toBe(false);
      await decide(ghana, task.id, 'APPROVE').expect(404);
      await api().post(`/v1/admin/documents/${docId}/view`).set(bearer(ghana.token)).send({ reason: 'Looking' }).expect(404);

      const support = await person({ staff: { roles: ['SUPPORT'] } });
      expect((await decide(support, task.id, 'APPROVE').expect(403)).body.code).toBe('FORBIDDEN');
      const noTwoStep = await person({ staff: { roles: ['VERIFIER'], twoStep: false } });
      expect((await decide(noTwoStep, task.id, 'APPROVE').expect(403)).body.code).toBe('TWO_STEP_REQUIRED');
      expect((await decide(p, task.id, 'APPROVE').expect(403)).body.code).toBe('FORBIDDEN');

      // A verifier's own identity check goes to someone else.
      const self = await verifier();
      const ownCheck = await failedCheck(self);
      const ownDoc = await uploadPhoto(self);
      await api().post(`/v1/documents/${ownDoc}/complete`).set(bearer(self.token)).expect(200);
      await api().post(`/v1/identity/checks/${ownCheck}/document`).set(bearer(self.token)).send({ documentId: ownDoc }).expect(200);
      expect((await decide(self, (await taskFor(ownCheck)).id, 'APPROVE').expect(403)).body.code).toBe('OWN_CASE');

      expect((await decide(await verifier(), task.id, 'BAN_USER').expect(400)).body.code).toBe('OUTCOME_NOT_SUPPORTED');
    });
  });

  describe('retention (decision 55)', () => {
    it('deletes photos whose retention period has ended, and only those', async () => {
      const p = await person();
      const staff = await verifier();
      const expired = await uploadPhoto(p);
      const kept = await uploadPhoto(p, Buffer.from('another photo'));
      for (const id of [expired, kept]) await api().post(`/v1/documents/${id}/complete`).set(bearer(p.token)).expect(200);
      await prisma.document.update({ where: { id: expired }, data: { deleteAfter: new Date(Date.now() - 60_000) } });
      await prisma.document.update({ where: { id: kept }, data: { deleteAfter: new Date(Date.now() + 86_400_000) } });

      expect(await app.get(RetentionService).purgeExpiredDocuments()).toBeGreaterThanOrEqual(1);
      const [gone, still] = await Promise.all([
        prisma.document.findUniqueOrThrow({ where: { id: expired } }),
        prisma.document.findUniqueOrThrow({ where: { id: kept } }),
      ]);
      expect(gone.deletedAt).not.toBeNull();
      expect(await storage.inspect(gone.storageKey)).toBeNull();
      expect(still.deletedAt).toBeNull();
      expect(await storage.inspect(still.storageKey)).not.toBeNull();
      expect((await api().post(`/v1/admin/documents/${expired}/view`).set(bearer(staff.token)).send({ reason: 'Check' }).expect(410)).body.code).toBe(
        'DOCUMENT_GONE',
      );
    });
  });
});
