import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { IsStandardPhone, toStandardPhone } from '../common/phone.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LatLngDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class OffPlatformOwnerDto {
  @ApiProperty({ description: "The landlord's name" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '+2348031234567' })
  @Transform(toStandardPhone)
  @IsStandardPhone()
  phone!: string;
}

export class CreateBuildingDto {
  @ApiProperty({ description: 'A city that is switched on' })
  @IsUUID()
  cityId!: string;

  @ApiProperty({ example: 'Ugbowo', description: 'Neighbourhood' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  area!: string;

  @ApiProperty({ example: 'Ekosodin Road' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  street!: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  houseNumber?: string;

  @ApiPropertyOptional({ example: 'Opposite the filling station' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  landmark?: string;

  @ApiPropertyOptional({ description: 'Distance to the main road in metres (decision 56)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  distanceToMainRoadM?: number;

  @ApiProperty({ type: LatLngDto, description: "The phone's live GPS reading, taken in the app while standing at the building" })
  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @ApiProperty({ description: 'Accuracy of the GPS reading in metres' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  locationAccuracyM!: number;

  @ApiPropertyOptional({ type: OffPlatformOwnerDto, description: 'For agents listing with a letter of authority when the landlord is not on the app' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OffPlatformOwnerDto)
  offPlatformOwner?: OffPlatformOwnerDto;
}

export class CreateUnitDto {
  @ApiProperty({ example: 'Flat 3' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ description: "One of the country's property types" })
  @IsUUID()
  propertyTypeId!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms!: number;

  @ApiProperty({ minimum: 0, description: 'Counted separately from bathrooms (decision 56)' })
  @IsInt()
  @Min(0)
  @Max(50)
  toilets!: number;

  @ApiPropertyOptional({ description: '0 for the ground floor' })
  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floorLevel?: number;

  @ApiPropertyOptional({ description: "In the country's area unit" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  floorArea?: number;

  @ApiPropertyOptional({ description: "Finishing, power, water, security, access and occupancy; checked against the country's choices" })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class UpdateUnitDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  toilets?: number;

  @ApiPropertyOptional({ description: 'Only the details to change; the rest are kept' })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class PartNoteDto {
  @ApiProperty({ type: String, nullable: true, maxLength: 300, example: 'Newly tiled', description: 'Send null or an empty note to remove it' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note!: string | null;
}
