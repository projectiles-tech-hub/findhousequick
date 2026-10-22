import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { StaffRole } from '../src/generated/prisma/client.js';
import type { StaffActor } from '../src/controls/controls.service.js';

export async function createTestApp(extra: { controllers?: any[] } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extra.controllers ?? [],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

let counter = 0;

/** Creates a user with a staff record and returns the actor used by the controls service. */
export async function createStaff(
  prisma: PrismaService,
  roles: StaffRole[],
  countryScopes: string[] = ['*'],
): Promise<StaffActor> {
  counter++;
  const user = await prisma.user.create({
    data: {
      phone: `+23480${String(Date.now()).slice(-6)}${String(counter).padStart(2, '0')}`,
      passwordHash: 'not-used-in-tests',
      firstName: 'Staff',
      lastName: `Member ${counter}`,
      countryCode: 'NG',
      staff: { create: { roles, countryScopes } },
    },
  });
  return { userId: user.id, roles, countryScopes };
}
