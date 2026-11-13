import { BlocksService } from './blocks.service.js';
import { Module } from '@nestjs/common';
import { CallsService } from './calls.service.js';
import { ConversationsService } from './conversations.service.js';
import { MessagingController } from './messaging.controller.js';

/** Chat and voice calls between tenants and listers (Specification 6.1, decision 44). */
@Module({
  controllers: [MessagingController],
  providers: [ConversationsService, CallsService, BlocksService],
  exports: [ConversationsService, CallsService],
})
export class MessagingModule {}
