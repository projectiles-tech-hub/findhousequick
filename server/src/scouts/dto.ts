import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LatLngDto } from '../properties/dto.js';

export class ScoutReportDto {
  @ApiProperty({ type: LatLngDto, description: 'Where the vacant property is: the pin the scout drops' })
  @ValidateNested()
  @Type(() => LatLngDto)
  location!: LatLngDto;

  @ApiProperty({ minLength: 5, maxLength: 500, description: 'The street, a landmark, what the place looks like' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landlordName?: string;
}

export class ScoutCursorQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class ScoutReferralsQuery extends ScoutCursorQuery {
  @ApiPropertyOptional({ enum: ['WAITING_FOR_RENTAL', 'ELIGIBLE', 'APPROVED', 'PAID', 'VOID'], description: 'Referrals with a reward in this state' })
  @IsOptional()
  @IsIn(['WAITING_FOR_RENTAL', 'ELIGIBLE', 'APPROVED', 'PAID', 'VOID'])
  status?: string;
}

export class LinkBuildingDto {
  @ApiProperty({ description: 'The building the landlord added, which he confirms is the property the scout reported' })
  @IsUUID()
  buildingId!: string;
}

export class StaffReasonDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ScoutStatusDto extends StaffReasonDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}
