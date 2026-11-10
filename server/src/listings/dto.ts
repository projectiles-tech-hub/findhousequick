import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MoneyDto {
  @ApiProperty({ example: '180000000', description: 'Whole minor units (kobo in Nigeria), as a string' })
  @Matches(/^\d{1,15}$/, { message: 'amountMinor must be a whole number of minor units, as a string' })
  amountMinor!: string;

  @ApiProperty({ example: 'NGN' })
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a three-letter code such as NGN' })
  currency!: string;
}

export class OccupancyRulesDto {
  @ApiPropertyOptional({ example: ['FAMILIES', 'CORPORATE'], description: "Codes from the country's whoMayRent list" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  allowed?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pets?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxOccupants?: number;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Fields a lister can set on a listing. Every field is optional when editing. */
export class ListingFieldsDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ type: MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  rent?: MoneyDto;

  @ApiPropertyOptional({ enum: ['YEAR', 'MONTH', 'WEEK', 'NIGHT'] })
  @IsOptional()
  @IsIn(['YEAR', 'MONTH', 'WEEK', 'NIGHT'])
  rentPeriod?: 'YEAR' | 'MONTH' | 'WEEK' | 'NIGHT';

  @ApiPropertyOptional({ type: MoneyDto, description: 'Enter 0 when there is none; no fee may be charged that is not shown' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  agencyFee?: MoneyDto;

  @ApiPropertyOptional({ type: MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  legalFee?: MoneyDto;

  @ApiPropertyOptional({ type: MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  cautionDeposit?: MoneyDto;

  @ApiPropertyOptional({ type: MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  serviceCharge?: MoneyDto;

  @ApiPropertyOptional({ maxLength: 300, description: 'What the service charge covers' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  serviceChargeCovers?: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  availableFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  minTermMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  maxTermMonths?: number;

  @ApiPropertyOptional({ type: OccupancyRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OccupancyRulesDto)
  occupancyRules?: OccupancyRulesDto;
}

export class CreateListingDto extends ListingFieldsDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: ['LONG_TERM', 'SHORT_LET'] })
  @IsIn(['LONG_TERM', 'SHORT_LET'])
  kind!: 'LONG_TERM' | 'SHORT_LET';
}

export class ListingStatusDto {
  @ApiProperty({ enum: ['PAUSE', 'RESUME', 'MARK_RENTED', 'CLOSE'] })
  @IsIn(['PAUSE', 'RESUME', 'MARK_RENTED', 'CLOSE'])
  action!: 'PAUSE' | 'RESUME' | 'MARK_RENTED' | 'CLOSE';

  @ApiPropertyOptional({ description: 'The tenant, when the home was rented to someone on FindHouseQuick' })
  @IsOptional()
  @IsUUID()
  rentedToUserId?: string;
}

export class MyListingsQuery {
  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED', 'RENTED', 'EXPIRED', 'REJECTED', 'REMOVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED', 'RENTED', 'EXPIRED', 'REJECTED', 'REMOVED'])
  status?: string;

  @ApiPropertyOptional({ description: 'From nextCursor of the previous page' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class RequestAuthorityDto {
  @ApiProperty({ enum: ['IN_APP_APPROVAL', 'LETTER'] })
  @IsIn(['IN_APP_APPROVAL', 'LETTER'])
  method!: 'IN_APP_APPROVAL' | 'LETTER';

  @ApiPropertyOptional({ description: 'The uploaded letter of authority (purpose AUTHORITY_LETTER), for the LETTER method' })
  @IsOptional()
  @IsUUID()
  letterDocumentId?: string;

  @ApiPropertyOptional({ description: "The landlord's identity document uploaded with the letter (purpose AUTHORITY_LETTER)" })
  @IsOptional()
  @IsUUID()
  landlordIdDocumentId?: string;

  @ApiPropertyOptional({ description: 'When the authority ends, if it does' })
  @IsOptional()
  @IsDateString({ strict: true })
  validUntil?: string;
}

export class AuthorityDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'REVOKE'] })
  @IsIn(['APPROVE', 'REJECT', 'REVOKE'])
  decision!: 'APPROVE' | 'REJECT' | 'REVOKE';

  @ApiPropertyOptional({ description: 'When the authority ends, if it does (approving only)' })
  @IsOptional()
  @IsDateString({ strict: true })
  validUntil?: string;
}
