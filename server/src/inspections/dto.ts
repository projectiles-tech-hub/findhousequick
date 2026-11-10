import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IsStandardPhone, toStandardPhone } from '../common/phone.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SlotsQuery {
  @ApiProperty({ example: '2026-11-16' })
  @Matches(DATE)
  from!: string;

  @ApiProperty({ example: '2026-11-22', description: 'At most 14 days after from' })
  @Matches(DATE)
  to!: string;
}

export class BookInspectionDto {
  @ApiProperty({ description: 'Start time of a free slot' })
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class InspectionStatusDto {
  @ApiProperty({ enum: ['CONFIRM', 'RESCHEDULE', 'CANCEL', 'COMPLETE', 'NO_SHOW'] })
  @IsIn(['CONFIRM', 'RESCHEDULE', 'CANCEL', 'COMPLETE', 'NO_SHOW'])
  action!: 'CONFIRM' | 'RESCHEDULE' | 'CANCEL' | 'COMPLETE' | 'NO_SHOW';

  @ApiPropertyOptional({ description: 'The new free slot, with RESCHEDULE' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SafetyShareDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  contactName!: string;

  @ApiProperty()
  @Transform(toStandardPhone)
  @IsStandardPhone()
  contactPhone!: string;
}

export class FollowUpDto {
  @ApiPropertyOptional({ description: 'Tenant only. Did the property match the listing?' })
  @IsOptional()
  @IsBoolean()
  matchedListing?: boolean;

  @ApiPropertyOptional({ description: 'Did this lead to a rental?' })
  @IsOptional()
  @IsBoolean()
  rented?: boolean;
}

export class InspectionsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
