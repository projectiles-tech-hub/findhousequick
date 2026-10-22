import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../accounts/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Is the server up and able to reach its database?' })
  async check() {
    try {
      const [{ postgis }] = await this.prisma.$queryRaw<{ postgis: string }[]>`SELECT postgis_lib_version() AS postgis`;
      return { status: 'ok', database: 'ok', postgis, time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
  }
}
