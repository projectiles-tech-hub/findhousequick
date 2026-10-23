import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsStandardPhone, toStandardPhone } from '../common/phone.js';
import { IsStandardEmail, toStandardEmail, type Channel } from './contact.js';
import { OTP_PURPOSES, type OtpPurpose } from './otp.service.js';
import type { UserTypeName } from './verification-level.js';

const USER_TYPES: UserTypeName[] = ['TENANT', 'LANDLORD', 'AGENT'];
const CHANNELS: Channel[] = ['SMS', 'EMAIL'];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * A phone number field: turned into the standard international form first (see src/common/phone.ts),
 * then checked, so every service only ever sees the standard form.
 */
const PhoneField = (required = true) =>
  applyDecorators(
    (required ? ApiProperty : ApiPropertyOptional)({
      example: '+2348031234567',
      description: 'International format, starting with + and the country code. Stored in standard form.',
    }),
    ...(required ? [] : [IsOptional()]),
    Transform(toStandardPhone),
    IsStandardPhone(),
  );

/** An email field: trimmed and put in lower case first, then checked. */
const EmailField = (required = true) =>
  applyDecorators(
    (required ? ApiProperty : ApiPropertyOptional)({ example: 'ada@example.com', format: 'email' }),
    ...(required ? [] : [IsOptional()]),
    Transform(toStandardEmail),
    IsStandardEmail(),
  );

const CodeField = (description: string) =>
  applyDecorators(ApiProperty({ example: '042917', description }), Matches(/^[0-9]{6}$/, { message: 'code must be 6 digits' }));

/** Requests that name one contact give either `phone` or `email`, not both (checked in the service). */
class OneContact {
  @PhoneField(false)
  phone?: string;

  @EmailField(false)
  email?: string;
}

export class RequestOtpDto extends OneContact {
  @ApiProperty({ enum: OTP_PURPOSES })
  @IsIn(OTP_PURPOSES)
  purpose!: OtpPurpose;
}

export class ConsentDto {
  @ApiProperty({ description: 'Version of the terms of use the user agreed to' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  termsVersion!: string;

  @ApiProperty({ description: 'Version of the privacy policy the user agreed to' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  privacyVersion!: string;
}

export class RegisterDto {
  @PhoneField()
  phone!: string;

  @EmailField()
  email!: string;

  @ApiProperty({
    enum: CHANNELS,
    description: 'Which contact the REGISTER code was sent to (decision 35). That contact is confirmed now; the other is confirmed later.',
  })
  @IsIn(CHANNELS)
  signUpWith!: Channel;

  @CodeField('The code sent for purpose REGISTER to the contact named in signUpWith')
  otp!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'NG' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be a two-letter country code' })
  countryCode!: string;

  @ApiProperty({ enum: USER_TYPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(USER_TYPES, { each: true })
  types!: UserTypeName[];

  @ApiPropertyOptional({ example: 'en', description: "One of the country's languages; defaults to the country's main language" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({ type: ConsentDto, description: 'Required: the user must agree to the terms and privacy policy' })
  @IsDefined({ message: 'consent is required: the user must agree to the terms and privacy policy' })
  @IsObject()
  @ValidateNested()
  @Type(() => ConsentDto)
  consent!: ConsentDto;
}

export class LoginDto extends OneContact {
  @ApiPropertyOptional({ description: 'Give either password or otp' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'The code sent for purpose LOGIN to the phone number or email address given' })
  @IsOptional()
  @Matches(/^[0-9]{6}$/, { message: 'otp must be 6 digits' })
  otp?: string;

  @ApiPropertyOptional({ description: "Device name shown in the user's list of signed-in devices" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device?: string;
}

export class ResetPasswordDto extends OneContact {
  @CodeField('The code sent for purpose RESET_PASSWORD to the phone number or email address given')
  otp!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;
}

/** Phone numbers and email addresses are changed through /me/contacts, never here (ADR 0006). */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'pcm', description: "One of the languages switched on for the user's country (decision 40)" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ enum: USER_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(USER_TYPES, { each: true })
  types?: UserTypeName[];
}

export class ContactCodeDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel!: Channel;

  @ApiProperty({
    description: 'The phone number or email address to confirm: the one already on the account, or a new one to replace it',
  })
  @IsString()
  @MaxLength(254)
  value!: string;
}

export class ContactConfirmDto extends ContactCodeDto {
  @CodeField('The code sent for purpose CONFIRM_CONTACT to that phone number or email address')
  code!: string;

  @ApiPropertyOptional({
    description: 'Required when replacing a phone number or email address that is already confirmed',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}
