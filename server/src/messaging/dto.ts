import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
