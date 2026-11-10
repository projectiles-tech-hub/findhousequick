import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ enum: ['ANDROID', 'IOS', 'WEB', 'DESKTOP'] })
  @IsIn(['ANDROID', 'IOS', 'WEB', 'DESKTOP'])
  platform!: 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP';

  @ApiProperty({ maxLength: 4096 })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  pushToken!: string;

  @ApiPropertyOptional({ maxLength: 4096, description: 'iPhone only, for incoming-call alerts (decision 44)' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  voipPushToken?: string;
}
