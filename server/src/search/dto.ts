import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LatLngDto } from '../properties/dto.js';

const toInt = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));
const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);
const LATLNG = /^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
const BBOX = /^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

/** Filters shared by search and saved searches. */
export class SearchFiltersDto {
  @ApiPropertyOptional({ enum: ['LONG_TERM', 'SHORT_LET'] })
  @IsOptional()
  @IsIn(['LONG_TERM', 'SHORT_LET'])
  kind?: 'LONG_TERM' | 'SHORT_LET';

  @ApiPropertyOptional({ enum: ['LONG_TERM_RESIDENTIAL', 'COMMERCIAL', 'SHORT_LET'] })
  @IsOptional()
  @IsIn(['LONG_TERM_RESIDENTIAL', 'COMMERCIAL', 'SHORT_LET'])
  category?: 'LONG_TERM_RESIDENTIAL' | 'COMMERCIAL' | 'SHORT_LET';

  @ApiPropertyOptional({ description: 'Property type code, e.g. flat' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{0,59}$/)
  propertyType?: string;

  @ApiPropertyOptional({ description: 'Minor units' })
  @IsOptional()
  @Matches(/^\d{1,15}$/)
  minRent?: string;

  @ApiPropertyOptional({ description: 'Minor units' })
  @IsOptional()
  @Matches(/^\d{1,15}$/)
  maxRent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(20)
  minBedrooms?: number;

  @ApiPropertyOptional({ enum: ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'] })
  @IsOptional()
  @IsIn(['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'])
  furnished?: string;

  @ApiPropertyOptional({ description: 'Every live listing has passed review, so this changes nothing today; kept for the apps' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  verifiedOnly?: boolean;
}

export class SearchListingsQuery extends SearchFiltersDto {
  @ApiPropertyOptional({ description: 'lat,lng for "around me" and landmark search, e.g. 6.3350,5.6037' })
  @IsOptional()
  @Matches(LATLNG, { message: 'near must be lat,lng' })
  near?: string;

  @ApiPropertyOptional({ minimum: 100, maximum: 50000, default: 1000 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(100)
  @Max(50000)
  radiusM?: number;

  @ApiPropertyOptional({ enum: ['AROUND_ME', 'LANDMARK'], default: 'AROUND_ME', description: 'What `near` is: the phone\'s location or a chosen landmark' })
  @IsOptional()
  @IsIn(['AROUND_ME', 'LANDMARK'])
  source?: 'AROUND_ME' | 'LANDMARK';

  @ApiPropertyOptional({ description: 'south,west,north,east for map search' })
  @IsOptional()
  @Matches(BBOX, { message: 'bbox must be south,west,north,east' })
  bbox?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 22, description: 'Map zoom; below 13, pins come back grouped' })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(22)
  zoom?: number;

  @ApiPropertyOptional({ enum: ['DISTANCE', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST'] })
  @IsOptional()
  @IsIn(['DISTANCE', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST'])
  sort?: 'DISTANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST';

  @ApiPropertyOptional({ description: 'Area name, for the public search pages (e.g. GRA)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @ApiPropertyOptional({ description: 'From nextCursor of the previous page' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,20}$/)
  cursor?: string;
}

export class PlacesQuery {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;
}

export class RelatedQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 12, default: 6 })
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number;
}

export class SavedAreaDto {
  @ApiPropertyOptional({ type: [LatLngDto], description: 'A drawn area: at least 3 points' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  polygon?: LatLngDto[];

  @ApiPropertyOptional({ type: LatLngDto, description: 'The middle of a circle, with radiusM' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  centre?: LatLngDto;

  @ApiPropertyOptional({ minimum: 100, maximum: 50000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50000)
  radiusM?: number;
}

export class SavedSearchDto {
  @ApiProperty({ maxLength: 60 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ type: SavedAreaDto })
  @ValidateNested()
  @Type(() => SavedAreaDto)
  area!: SavedAreaDto;

  @ApiPropertyOptional({ type: SearchFiltersDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters?: SearchFiltersDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;
}

export class SavedPlaceDto {
  @ApiProperty({ maxLength: 60, example: 'Office' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;
}
