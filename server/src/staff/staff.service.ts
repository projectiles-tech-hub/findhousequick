import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { Prisma, StaffRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Contact } from '../accounts/contact.js';

export const STAFF_ROLES: StaffRole[] = ['SUPER_ADMIN', 'COUNTRY_MANAGER', 'VERIFIER', 'FIELD_OFFICER', 'SUPPORT', 'FINANCE'];

const staffSelect = {
  userId: true,
  roles: true,
  countryScopes: true,
  active: true,
  totpEnabledAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { firstName: true, lastName: true, phone: true } },
} satisfies Prisma.StaffMemberSelect;

type StaffRow = Prisma.StaffMemberGetPayload<{ select: typeof staffSelect }>;

/** A staff member as the admin panel sees them. Authenticator secrets are never included. */
export function toStaffView(s: StaffRow) {
  return {
    userId: s.userId,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    phone: s.user.phone,
    roles: s.roles,
    countryScopes: s.countryScopes,
    active: s.active,
    authenticator: s.totpEnabledAt !== null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export interface StaffChange {
  roles?: StaffRole[];
  countryScopes?: string[];
  active?: boolean;
}

/** Adding, changing and listing staff (ADR 0005). Super admins only; enforced by the controller. */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.staffMember.findMany({ select: staffSelect, orderBy: { createdAt: 'asc' } });
    return rows.map(toStaffView);
  }

  /**
   * Makes an existing registered user a staff member, found by confirmed phone number or confirmed email address
   * (decision 38). The person must have registered in the app and confirmed that contact first, so staff rights
   * can never be given through a phone number or email address nobody has proved they own.
   */
  async add(actorId: string, contact: Contact, roles: StaffRole[], countryScopes: string[]) {
    await this.assertCountries(countryScopes);
    const select = { id: true, status: true, phoneVerifiedAt: true, emailVerifiedAt: true, staff: { select: { userId: true } } } as const;
    const found =
      contact.channel === 'SMS'
        ? await this.prisma.user.findUnique({ where: { phone: contact.destination }, select })
        : await this.prisma.user.findUnique({ where: { email: contact.destination }, select });
    const confirmed = found && (contact.channel === 'SMS' ? found.phoneVerifiedAt : found.emailVerifiedAt);
    const user = confirmed ? found : null;
    if (!user || user.status === 'DELETED') {
      throw apiError(
        404,
        'USER_NOT_FOUND',
        'No registered account has confirmed this phone number or email address. Ask the person to register and confirm it first.',
      );
    }
    if (user.status !== 'ACTIVE') {
      throw apiError(400, 'ACCOUNT_SUSPENDED', 'This account is suspended and cannot be made staff.');
    }
    if (user.staff) {
      throw apiError(409, 'ALREADY_STAFF', 'This person is already a staff member. Change their record instead.');
    }
    const created = await this.prisma.staffMember.create({
      data: { userId: user.id, roles, countryScopes },
      select: staffSelect,
    });
    await this.audit(actorId, 'staff.added', user.id, { after: { roles, countryScopes, active: true } });
    return toStaffView(created);
  }

  async update(actorId: string, userId: string, change: StaffChange) {
    const before = await this.prisma.staffMember.findUnique({ where: { userId }, select: staffSelect });
    if (!before) throw apiError(404, 'STAFF_NOT_FOUND', 'No staff member with this id.');
    if (change.countryScopes) await this.assertCountries(change.countryScopes);

    // A super admin cannot lock themselves out, so the platform always keeps at least one super admin.
    if (userId === actorId) {
      if (change.active === false) throw apiError(400, 'CANNOT_CHANGE_SELF', 'You cannot deactivate yourself.');
      if (change.roles && !change.roles.includes('SUPER_ADMIN')) {
        throw apiError(400, 'CANNOT_CHANGE_SELF', 'You cannot remove your own super admin role.');
      }
    }

    const after = await this.prisma.staffMember.update({
      where: { userId },
      data: {
        ...(change.roles !== undefined && { roles: change.roles }),
        ...(change.countryScopes !== undefined && { countryScopes: change.countryScopes }),
        ...(change.active !== undefined && { active: change.active }),
      },
      select: staffSelect,
    });
    await this.audit(actorId, 'staff.changed', userId, {
      before: { roles: before.roles, countryScopes: before.countryScopes, active: before.active },
      after: { roles: after.roles, countryScopes: after.countryScopes, active: after.active },
    });
    return toStaffView(after);
  }

  /** Countries must exist (or be "*" for all), so a typing mistake cannot give someone no reach or the wrong reach. */
  private async assertCountries(scopes: string[]): Promise<void> {
    if (scopes.includes('*')) {
      if (scopes.length > 1) throw apiError(400, 'BAD_REQUEST', 'Use "*" on its own to mean all countries.');
      return;
    }
    const found = await this.prisma.country.findMany({ where: { code: { in: scopes } }, select: { code: true } });
    const missing = scopes.filter((c) => !found.some((f) => f.code === c));
    if (missing.length) {
      throw apiError(400, 'UNKNOWN_COUNTRY', `These countries are not set up: ${missing.join(', ')}.`);
    }
  }

  private async audit(actorId: string, action: string, userId: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.auditLog.create({ data: { actorId, action, entityType: 'StaffMember', entityId: userId, metadata } });
  }
}
