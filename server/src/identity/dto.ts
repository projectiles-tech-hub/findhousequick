import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartIdentityCheckDto {
  @ApiProperty({ example: 'NIN', description: "One of the country's accepted ID types (country settings)" })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_]{2,40}$/, { message: 'idType must be an ID type code such as NIN' })
  idType!: string;

  @ApiProperty({ writeOnly: true, description: 'Encrypted on arrival; only the last four characters are shown again' })
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  idNumber!: string;

  @ApiProperty({ description: 'The user agrees to the identity check. Must be true.' })
  @Equals(true, { message: 'consent must be true: the user must agree to the identity check' })
  consent!: boolean;
}

export class AgentProfileDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Company registration number, e.g. a CAC number in Nigeria' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  registrationNumber?: string;
}
