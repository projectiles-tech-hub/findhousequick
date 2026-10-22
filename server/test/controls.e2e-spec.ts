import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ControlsService, type StaffActor } from '../src/controls/controls.service.js';
import { RequireFeature } from '../src/controls/require-feature.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createStaff, createTestApp } from './helpers.js';

/** A route used only by these tests, to check that switched-off features are refused. */
@Controller('test-short-lets')
class ShortLetProbeController {
  @Get()
  @RequireFeature('listings.short_let')
  ok() {
    return { ok: true };
  }
}

describe('Country and feature controls (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let controls: ControlsService;
  let superAdmin: StaffActor;
  let secondSuperAdmin: StaffActor;
  let ngManager: StaffActor;
  let ghManager: StaffActor;
  let beninCityId: string;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ShortLetProbeController] });
    prisma = app.get(PrismaService);
    controls = app.get(ControlsService);
    superAdmin = await createStaff(prisma, ['SUPER_ADMIN']);
    secondSuperAdmin = await createStaff(prisma, ['SUPER_ADMIN']);
    ngManager = await createStaff(prisma, ['COUNTRY_MANAGER'], ['NG']);
    ghManager = await createStaff(prisma, ['COUNTRY_MANAGER'], ['GH']);
    beninCityId = (await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the server as healthy', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('returns switches and Nigerian settings to the apps', async () => {
    const res = await request(app.getHttpServer()).get('/v1/controls').set('X-Country', 'NG').expect(200);
    expect(res.body.features['contact.chat']).toBe(true);
    expect(res.body.features['money.escrow']).toBe(false);
    expect(res.body.country).toMatchObject({ code: 'NG', currency: 'NGN' });
    expect(res.body.country.settings.fees).toEqual({
      escrowTenantBps: 150,
      escrowLandlordBps: 150,
      completedRentalTenantBps: 200,
      completedRentalLandlordBps: 200,
    });
    // Only switched-on languages are offered.
    expect(res.body.country.languages).toEqual(['en', 'pcm']);
  });

  it('returns no country for an unknown country code', async () => {
    const res = await request(app.getHttpServer()).get('/v1/controls').set('X-Country', 'ZZ').expect(200);
    expect(res.body.country).toBeNull();
  });

  it('switches a normal feature on for one city immediately, and the server enforces it', async () => {
    await request(app.getHttpServer()).get('/v1/test-short-lets').set('X-City', beninCityId).expect(403);

    const rule = await controls.createRule(
      { flagKey: 'listings.short_let', scope: 'CITY', scopeValue: beninCityId, enabled: true, reason: 'Pilot' },
      ngManager,
    );
    expect(rule.status).toBe('ACTIVE');

    await request(app.getHttpServer()).get('/v1/test-short-lets').set('X-City', beninCityId).expect(200);
    const elsewhere = await request(app.getHttpServer()).get('/v1/test-short-lets').expect(403);
    expect(elsewhere.body).toMatchObject({ code: 'FEATURE_UNAVAILABLE', feature: 'listings.short_let' });

    const changes = await prisma.controlChange.findMany({ where: { entityId: rule.id } });
    expect(changes.map((c) => c.action)).toEqual(['RULE_CREATED']);
  });

  it('needs a second person, including a super admin, to switch a critical feature on', async () => {
    const rule = await controls.createRule(
      { flagKey: 'money.escrow', scope: 'COUNTRY', scopeValue: 'NG', enabled: true, reason: 'Launch escrow' },
      ngManager,
    );
    expect(rule.status).toBe('PENDING_APPROVAL');
    expect(await controls.isEnabled('money.escrow', { countryCode: 'NG' })).toBe(false);

    await expect(controls.approveRule(rule.id, ngManager)).rejects.toThrow(/different staff member/);
    const otherNgManager = await createStaff(prisma, ['COUNTRY_MANAGER'], ['NG']);
    await expect(controls.approveRule(rule.id, otherNgManager)).rejects.toThrow(/Managing Director/);

    const approved = await controls.approveRule(rule.id, superAdmin);
    expect(approved).toMatchObject({ status: 'ACTIVE', approvedById: superAdmin.userId });
    expect(await controls.isEnabled('money.escrow', { countryCode: 'NG' })).toBe(true);

    const actions = (await prisma.controlChange.findMany({ where: { entityId: rule.id }, orderBy: { createdAt: 'asc' } })).map(
      (c) => c.action,
    );
    expect(actions).toEqual(['RULE_PROPOSED', 'RULE_APPROVED']);
  });

  it('applies an emergency pause immediately and lets it beat every other rule', async () => {
    const pause = await controls.createRule(
      { flagKey: 'money.escrow', scope: 'GLOBAL', scopeValue: null, enabled: false, emergency: true, reason: 'Fraud attack' },
      superAdmin,
    );
    expect(pause.status).toBe('ACTIVE');
    expect(await controls.isEnabled('money.escrow', { countryCode: 'NG' })).toBe(false);

    // Lifting the pause would switch a critical feature back on, so it cannot be done by archiving.
    await expect(controls.archiveRule(pause.id, superAdmin, 'Resolved')).rejects.toThrow(/approved/);

    const resume = await controls.createRule(
      { flagKey: 'money.escrow', scope: 'GLOBAL', scopeValue: null, enabled: true, emergency: true, reason: 'Resolved' },
      superAdmin,
    );
    expect(resume.status).toBe('PENDING_APPROVAL');
    await controls.approveRule(resume.id, secondSuperAdmin);
    expect(await controls.isEnabled('money.escrow', { countryCode: 'NG' })).toBe(true);
  });

  it('keeps country managers inside their own countries', async () => {
    await expect(
      controls.createRule(
        { flagKey: 'contact.chat', scope: 'COUNTRY', scopeValue: 'NG', enabled: false, reason: 'Test' },
        ghManager,
      ),
    ).rejects.toThrow(/not assigned to country NG/);
    await expect(
      controls.createRule(
        { flagKey: 'contact.chat', scope: 'GLOBAL', scopeValue: null, enabled: false, reason: 'Test' },
        ngManager,
      ),
    ).rejects.toThrow(/super admins/);
  });

  it('rejects invalid rules', async () => {
    await expect(
      controls.createRule({ flagKey: 'no.such', scope: 'GLOBAL', scopeValue: null, enabled: true, reason: 'x' }, superAdmin),
    ).rejects.toThrow(/Unknown feature/);
    await expect(
      controls.createRule({ flagKey: 'contact.chat', scope: 'GLOBAL', scopeValue: null, enabled: true, reason: ' ' }, superAdmin),
    ).rejects.toThrow(/reason/);
    await expect(
      controls.createRule({ flagKey: 'contact.chat', scope: 'COUNTRY', scopeValue: null, enabled: true, reason: 'x' }, superAdmin),
    ).rejects.toThrow(/scope value/);
  });
});
