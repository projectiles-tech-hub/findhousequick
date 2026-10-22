import { normalizePhone } from '../common/phone.js';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Makes the first super admin (ADR 0005, decision 30). Run once, on the server, with
 * `pnpm staff:make-super-admin +234...`, after that person has registered in the app.
 *
 * It refuses if any super admin already exists, so it cannot be used to add more later; from then on,
 * super admins manage staff through the admin endpoints. A database lock makes sure two copies run at
 * the same moment cannot both succeed.
 */
export async function makeFirstSuperAdmin(prisma: PrismaClient, rawPhone: string): Promise<{ userId: string; phone: string; name: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error(`"${rawPhone}" is not a valid phone number. Use international format, e.g. +2348031234567.`);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fhq:first-super-admin'))`;

    const existing = await tx.staffMember.count({ where: { roles: { has: 'SUPER_ADMIN' } } });
    if (existing > 0) {
      throw new Error('A super admin already exists. Add further staff through the admin endpoints instead.');
    }
    const user = await tx.user.findUnique({ where: { phone }, select: { id: true, status: true, firstName: true, lastName: true } });
    if (!user) throw new Error(`No registered account uses ${phone}. The person must register in the app first.`);
    if (user.status !== 'ACTIVE') throw new Error(`The account for ${phone} is not active (${user.status}).`);

    await tx.staffMember.upsert({
      where: { userId: user.id },
      create: { userId: user.id, roles: ['SUPER_ADMIN'], countryScopes: ['*'] },
      update: { roles: ['SUPER_ADMIN'], countryScopes: ['*'], active: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'staff.first_super_admin',
        entityType: 'StaffMember',
        entityId: user.id,
        metadata: { after: { roles: ['SUPER_ADMIN'], countryScopes: ['*'], active: true }, via: 'server command' },
      },
    });
    return { userId: user.id, phone, name: `${user.firstName} ${user.lastName}` };
  });
}
