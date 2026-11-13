import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class StartConversationDto {
  @ApiProperty()
  @IsUUID()
  listingId!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  firstMessage?: string;
}

export class SendMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class CursorQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;
}

export class MessagesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class CallStatusDto {
  @ApiProperty({ enum: ['ANSWER', 'DECLINE', 'END'] })
  @IsIn(['ANSWER', 'DECLINE', 'END'])
  action!: 'ANSWER' | 'DECLINE' | 'END';
}

export class BlockReportDto {
  @ApiPropertyOptional({ description: 'What happened, for the trust team' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class BlockDto {
  @ApiPropertyOptional({ type: BlockReportDto, description: 'Also report the person to the trust team' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlockReportDto)
  report?: BlockReportDto;
}
