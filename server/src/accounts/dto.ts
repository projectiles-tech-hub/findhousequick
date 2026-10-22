import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OTP_PURPOSES, type OtpPurpose } from './otp.service.js';
import type { UserTypeName } from './verification-level.js';

/** International format with country code, e.g. +2348031234567 (E.164). */
export const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;
const USER_TYPES: UserTypeName[] = ['TENANT', 'LANDLORD', 'AGENT'];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

const phone = () =>
  ApiProperty({ example: '+2348031234567', description: 'International format, starting with + and the country code' });

export class RequestOtpDto {
  @phone()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be in international format, e.g. +2348031234567' })
  phone!: string;

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
  @phone()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be in international format, e.g. +2348031234567' })
  phone!: string;

  @ApiProperty({ example: '042917', description: 'The code sent by SMS for purpose REGISTER' })
  @Matches(/^[0-9]{6}$/, { message: 'otp must be 6 digits' })
  otp!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email?: string;

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

export class LoginDto {
  @phone()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be in international format, e.g. +2348031234567' })
  phone!: string;

  @ApiPropertyOptional({ description: 'Give either password or otp' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'The code sent by SMS for purpose LOGIN' })
  @IsOptional()
  @Matches(/^[0-9]{6}$/, { message: 'otp must be 6 digits' })
  otp?: string;

  @ApiPropertyOptional({ description: "Device name shown in the user's list of signed-in devices" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: 'pcm' })
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
