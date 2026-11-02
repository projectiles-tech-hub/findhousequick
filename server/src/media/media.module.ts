import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module.js';
import { MediaController } from './media.controller.js';
import { MediaProcessor } from './media.processor.js';
import { MediaQueue } from './media.queue.js';
import { MediaService } from './media.service.js';

/** Photo and video upload and processing (Release 1 step 5, part 1; ADR 0009). */
@Module({
  imports: [PropertiesModule],
  controllers: [MediaController],
  providers: [MediaService, MediaProcessor, MediaQueue],
  exports: [MediaService, MediaProcessor],
})
export class MediaModule {}
