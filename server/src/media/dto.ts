import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';
import { LatLngDto } from '../properties/dto.js';

export const MEDIA_KINDS = ['PHOTO', 'VIDEO', 'PHOTO_360', 'FLOOR_PLAN'] as const;
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/heic'] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4'] as const;

/** 25 MB for a photo, 500 MB for a video. About cameras, not countries, so fixed here. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export class StartMediaUploadDto {
  @ApiProperty({ example: 'bedroom_2', description: "The checklist part this photo or video is for" })
  @Matches(/^[a-z][a-z0-9_]{0,59}$/, { message: 'partCode must be a part code such as bedroom_2' })
  partCode!: string;

  @ApiProperty({ enum: MEDIA_KINDS })
  @IsIn(MEDIA_KINDS)
  kind!: (typeof MEDIA_KINDS)[number];

  @ApiProperty({ enum: [...PHOTO_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] })
  @IsIn([...PHOTO_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES])
  contentType!: string;

  @ApiProperty({ maximum: MAX_VIDEO_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  sizeBytes!: number;

  @ApiProperty({ description: 'SHA-256 of the whole file in lower-case hex; checked when the upload is complete' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-f0-9]{64}$/, { message: 'sha256 must be 64 hex characters' })
  sha256!: string;

  @ApiProperty({ description: "When the app's camera took the photo or finished the video" })
  @IsISO8601({ strict: true })
  capturedAt!: string;

  @ApiProperty({ type: LatLngDto, description: 'GPS reading taken at the moment of capture' })
  @ValidateNested()
  @Type(() => LatLngDto)
  captureLocation!: LatLngDto;

  @ApiPropertyOptional({ description: 'Accuracy of the GPS reading in metres' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  captureAccuracyM?: number;

  @ApiPropertyOptional({ description: 'The current occupant agreed to interior photos (Specification 5.3)' })
  @IsOptional()
  @IsBoolean()
  occupantConsent?: boolean;
}
