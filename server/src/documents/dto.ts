import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, Matches, Max, Min } from 'class-validator';

export const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const DOCUMENT_PURPOSES = ['IDENTITY', 'OWNERSHIP', 'AUTHORITY_LETTER', 'DISPUTE_EVIDENCE', 'OTHER'] as const;
/** 20 MB. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export class StartDocumentUploadDto {
  @ApiProperty({ example: 'DRIVERS_LICENCE', description: "One of the country's document types for the purpose" })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_]{2,60}$/, { message: 'documentTypeCode must be a document type code such as DRIVERS_LICENCE' })
  documentTypeCode!: string;

  @ApiProperty({ enum: DOCUMENT_PURPOSES, description: 'Only IDENTITY is open so far; the others come with properties' })
  @IsIn(DOCUMENT_PURPOSES)
  purpose!: (typeof DOCUMENT_PURPOSES)[number];

  @ApiProperty({ enum: DOCUMENT_CONTENT_TYPES })
  @IsIn(DOCUMENT_CONTENT_TYPES)
  contentType!: (typeof DOCUMENT_CONTENT_TYPES)[number];

  @ApiProperty({ maximum: MAX_DOCUMENT_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_BYTES)
  sizeBytes!: number;

  @ApiProperty({ description: 'SHA-256 of the file in lower-case hex; checked when the upload is complete' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-f0-9]{64}$/, { message: 'sha256 must be 64 hex characters' })
  sha256!: string;
}
