import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import { contextFromRequest, type RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { CallsService } from './calls.service.js';
import { ConversationsService } from './conversations.service.js';
import { CallStatusDto, CursorQuery, MessagesQuery, SendMessageDto, StartConversationDto } from './dto.js';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly calls: CallsService,
  ) {}

  @Post('conversations')
  @RequireFeature('contact.chat')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Start (or reopen) a conversation about a live listing' })
  @ApiCreatedResponse({ description: 'Conversation' })
  @ApiResponse({ status: 400, description: 'OWN_LISTING' })
  start(@CurrentUser() user: RequestUser, @Body() dto: StartConversationDto, @Req() req: Request) {
    return this.conversations.start(user, dto.listingId, dto.firstMessage, contextFromRequest(req));
  }

  @Get('conversations')
  @ApiOperation({ summary: "The user's conversations, most recent first" })
  @ApiOkResponse({ description: 'A page of conversations with nextCursor' })
  list(@CurrentUser() user: RequestUser, @Query() q: CursorQuery) {
    return this.conversations.list(user, q.cursor);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Messages in a conversation, newest first. Opening the newest page marks it read.' })
  @ApiOkResponse({ description: 'A page of messages with nextCursor' })
  messages(@CurrentUser() user: RequestUser, @Param('conversationId', ParseUUIDPipe) id: string, @Query() q: MessagesQuery) {
    return this.conversations.messages(user, id, q.cursor);
  }

  @Post('conversations/:conversationId/messages')
  @RequireFeature('contact.chat')
  @ApiOperation({
    summary: 'Send a message',
    description: 'Phone numbers, bank details, email addresses and moves off the platform are detected: the message is sent, with a warning, and the finding is logged.',
  })
  @ApiCreatedResponse({ description: 'The message, with warning (or null)' })
  send(@CurrentUser() user: RequestUser, @Param('conversationId', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto, @Req() req: Request) {
    return this.conversations.send(user, id, dto.body, contextFromRequest(req));
  }

  @Post('conversations/:conversationId/share-phones')
  @HttpCode(200)
  @RequireFeature('contact.phone_reveal')
  @ApiOperation({ summary: 'Agree to share phone numbers (once an inspection is booked; both sides must agree)' })
  @ApiOkResponse({ description: 'The conversation; phones included once both sides have agreed' })
  @ApiResponse({ status: 409, description: 'INSPECTION_NOT_BOOKED' })
  sharePhones(@CurrentUser() user: RequestUser, @Param('conversationId', ParseUUIDPipe) id: string) {
    return this.conversations.sharePhones(user, id);
  }

  @Post('conversations/:conversationId/calls')
  @RequireFeature('contact.in_app_call')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Start a voice call inside the app with the other party (decision 44)' })
  @ApiCreatedResponse({ description: 'The call, ringing, with the connection values for the calling service' })
  @ApiResponse({ status: 409, description: 'CALL_IN_PROGRESS' })
  @ApiResponse({ status: 503, description: 'CALLS_UNAVAILABLE' })
  call(@CurrentUser() user: RequestUser, @Param('conversationId', ParseUUIDPipe) id: string) {
    return this.calls.start(user, id);
  }

  @Post('calls/:callId/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Answer, decline or end a call' })
  @ApiOkResponse({ description: 'The call; answering also returns the connection values' })
  @ApiResponse({ status: 409, description: 'NOT_THE_CALLEE, CALL_NOT_RINGING or CALL_OVER' })
  callStatus(@CurrentUser() user: RequestUser, @Param('callId', ParseUUIDPipe) id: string, @Body() dto: CallStatusDto) {
    return this.calls.changeStatus(user, id, dto.action);
  }
}
