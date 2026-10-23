import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';
import { IsStandardPhone, toStandardPhone } from '../common/phone.js';
import { IsStandardEmail, toStandardEmail } from '../accounts/contact.js';
import type { StaffRole } from '../generated/prisma/client.js';
import { STAFF_ROLES } from './staff.service.js';

const upper = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v)) : value;

const RolesField = (required: boolean) =>
  applyDecorators(
    (required ? ApiProperty : ApiPropertyOptional)({ enum: STAFF_ROLES, isArray: true }),
    IsArray(),
    ArrayMinSize(1),
    ArrayUnique(),
    IsIn(STAFF_ROLES, { each: true }),
  );

const CountriesField = (required: boolean) =>
  applyDecorators(
    (required ? ApiProperty : ApiPropertyOptional)({
      type: [String],
      example: ['NG'],
      description: 'Country codes the staff member may act on, or ["*"] for all countries',
    }),
    Transform(upper),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(250),
    ArrayUnique(),
    Matches(/^([A-Z]{2}|\*)$/, { each: true, message: 'countryScopes must be two-letter country codes or "*"' }),
  );

export class AddStaffDto {
  @ApiPropertyOptional({ example: '+2348031234567', description: 'Confirmed phone number of a registered account. Give phone or email.' })
  @IsOptional()
  @Transform(toStandardPhone)
  @IsStandardPhone()
  phone?: string;

  @ApiPropertyOptional({ example: 'ada@example.com', description: 'Confirmed email address of a registered account (decision 38). Give phone or email.' })
  @IsOptional()
  @Transform(toStandardEmail)
  @IsStandardEmail()
  email?: string;

  @RolesField(true)
  roles!: StaffRole[];

  @CountriesField(true)
  countryScopes!: string[];
}

export class UpdateStaffDto {
  @RolesField(false)
  @IsOptional()
  roles?: StaffRole[];

  @CountriesField(false)
  @IsOptional()
  countryScopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class TwoStepVerifyDto {
  @ApiProperty({ enum: ['AUTHENTICATOR', 'EMAIL', 'SMS'] })
  @IsIn(['AUTHENTICATOR', 'EMAIL', 'SMS'])
  method!: 'AUTHENTICATOR' | 'EMAIL' | 'SMS';

  @ApiProperty({ example: '042917' })
  @Matches(/^[0-9]{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class AuthenticatorConfirmDto {
  @ApiProperty({ example: '042917', description: 'The code the authenticator app shows now' })
  @Matches(/^[0-9]{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
