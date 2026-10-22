import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../accounts/auth.js';
import type { FeatureScope, RuleStatus, StaffRole } from '../generated/prisma/client.js';
import { StaffOnly } from '../staff/staff.guard.js';
import { ControlsService, type StaffActor } from './controls.service.js';
import type { RequestUser } from './request-context.js';

const SCOPES: FeatureScope[] = ['GLOBAL', 'COUNTRY', 'REGION', 'CITY', 'USER_TYPE', 'USER'];
const STATUSES: RuleStatus[] = ['PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED'];

export class FeatureRuleInputDto {
  @ApiProperty({ example: 'listings.short_let' })
  @IsString()
  @MaxLength(100)
  flagKey!: string;

  @ApiProperty({ enum: SCOPES })
  @IsIn(SCOPES)
  scope!: FeatureScope;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Country code, region id, city id, user type or user id, depending on scope. Null for GLOBAL.',
  })
  @ValidateIf((o: FeatureRuleInputDto) => o.scopeValue !== null && o.scopeValue !== undefined)
  @IsString()
  @MaxLength(100)
  scopeValue: string | null = null;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  @ApiPropertyOptional({ description: 'Emergency rules beat every other rule, e.g. pausing payments.' })
  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @ApiProperty({ description: 'Why the change is being made; recorded with it.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ArchiveRuleDto {
  @ApiProperty({ description: 'Why the rule is being withdrawn; recorded with it.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ListRulesQuery {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: RuleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  flagKey?: string;
}

function actorOf(user: RequestUser): StaffActor {
  return { userId: user.id, roles: user.staff!.roles as StaffRole[], countryScopes: user.staff!.countryScopes };
}

/**
 * Feature switches for staff (ADR 0002 as confirmed in decision 28; ADR 0005). Super admins and country
 * managers only, on a device that has passed two-step login. The rules themselves are in ControlsService.
 */
@ApiTags('Admin')
@Controller('admin/feature-rules')
@StaffOnly('SUPER_ADMIN', 'COUNTRY_MANAGER')
export class FeatureRulesController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  @ApiOperation({
    summary: 'Feature rules, including those waiting for approval',
    description: 'Country managers see whole-platform and user-type rules, and the rules for their own countries.',
  })
  @ApiOkResponse({ description: 'Rules, newest first' })
  list(@CurrentUser() user: RequestUser, @Query() query: ListRulesQuery) {
    return this.controls.listRules(actorOf(user), query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a feature rule',
    description:
      'Switching off at once (no schedule, end time or percentage) applies immediately. A country manager\'s ' +
      'other changes wait for a super admin. A super admin\'s change applies at once, except switching a ' +
      'critical feature on, which waits for a second staff member.',
  })
  @ApiCreatedResponse({ description: 'Rule created (ACTIVE or PENDING_APPROVAL)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: FeatureRuleInputDto) {
    return this.controls.createRule(
      {
        flagKey: dto.flagKey,
        scope: dto.scope,
        scopeValue: dto.scopeValue ?? null,
        enabled: dto.enabled,
        rolloutPercent: dto.rolloutPercent ?? null,
        startsAt: dto.startsAt ?? null,
        endsAt: dto.endsAt ?? null,
        emergency: dto.emergency ?? false,
        reason: dto.reason,
      },
      actorOf(user),
    );
  }

  @Post(':ruleId/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve a waiting rule, or a request to withdraw a rule',
    description: 'Must be a different staff member from the one who asked; country managers\' changes need a super admin.',
  })
  @ApiOkResponse({ description: 'Approved' })
  @ApiResponse({ status: 403, description: 'SAME_PERSON or SUPER_ADMIN_APPROVAL_REQUIRED' })
  approve(@CurrentUser() user: RequestUser, @Param('ruleId', new ParseUUIDPipe()) ruleId: string) {
    return this.controls.approveRule(ruleId, actorOf(user));
  }

  @Post(':ruleId/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Withdraw a rule',
    description:
      'Super admins withdraw at once. Country managers withdraw their own waiting proposals at once; any other ' +
      'withdrawal is recorded as a request and the rule stays in force until a super admin approves it.',
  })
  @ApiOkResponse({ description: 'Archived, or withdrawal requested (archiveRequestedAt set)' })
  @ApiResponse({ status: 403, description: 'CRITICAL_OFF_RULE: create an ON rule instead' })
  archive(
    @CurrentUser() user: RequestUser,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Body() dto: ArchiveRuleDto,
  ) {
    return this.controls.archiveRule(ruleId, actorOf(user), dto.reason);
  }
}
