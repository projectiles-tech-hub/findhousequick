import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const REVIEW_TASK_TYPES = [
  'LISTING_REVIEW',
  'IDENTITY_REVIEW',
  'AGENT_PROFILE_REVIEW',
  'AUTHORITY_CONFIRMATION',
  'DUPLICATE_RESOLUTION',
  'SITE_VISIT',
  'RANDOM_AUDIT',
  'REPORT',
] as const;
export const REVIEW_TASK_STATUSES = ['OPEN', 'ASSIGNED', 'DONE', 'CANCELLED'] as const;
export const REVIEW_OUTCOMES = [
  'APPROVE',
  'REJECT',
  'NEEDS_SITE_VISIT',
  'MERGE_DUPLICATE',
  'WARN_USER',
  'REMOVE_BADGE',
  'SUSPEND_USER',
  'BAN_USER',
  'NO_ACTION',
] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListReviewTasksQuery {
  @ApiPropertyOptional({ enum: REVIEW_TASK_TYPES })
  @IsOptional()
  @IsIn(REVIEW_TASK_TYPES)
  type?: (typeof REVIEW_TASK_TYPES)[number];

  @ApiPropertyOptional({ enum: REVIEW_TASK_STATUSES, description: 'Default: OPEN and ASSIGNED' })
  @IsOptional()
  @IsIn(REVIEW_TASK_STATUSES)
  status?: (typeof REVIEW_TASK_STATUSES)[number];

  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class ReviewDecisionDto {
  @ApiProperty({ enum: REVIEW_OUTCOMES, description: 'Identity and agent company reviews take APPROVE or REJECT' })
  @IsIn(REVIEW_OUTCOMES)
  outcome!: (typeof REVIEW_OUTCOMES)[number];

  @ApiProperty({ description: 'Why; kept with the decision', maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  notes!: string;
}

export class ViewDocumentDto {
  @ApiProperty({ description: 'Why the document is being viewed; recorded in the audit log', maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
