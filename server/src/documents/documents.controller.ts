import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import { StartDocumentUploadDto } from './dto.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@RequireLevel(1)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Repeating a request with the same key returns the same document' })
  @ApiOperation({
    summary: 'Start a private document upload',
    description: 'Returns a short-lived upload address. Send the file there with PUT and the given headers, then call /complete.',
  })
  @ApiCreatedResponse({ description: 'Upload address issued' })
  @ApiResponse({ status: 400, description: 'PURPOSE_NOT_AVAILABLE or DOCUMENT_TYPE_NOT_ACCEPTED' })
  @ApiResponse({ status: 409, description: 'DOCUMENT_ALREADY_UPLOADED (same Idempotency-Key as a finished upload)' })
  start(
    @CurrentUser() user: RequestUser,
    @Body() dto: StartDocumentUploadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey !== undefined && !/^[\x21-\x7e]{1,100}$/.test(idempotencyKey)) {
      throw apiError(400, 'BAD_REQUEST', 'Idempotency-Key must be 1 to 100 visible characters.');
    }
    return this.documents.startUpload(user, dto, idempotencyKey);
  }

  @Post(':documentId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a document upload finished' })
  @ApiOkResponse({ description: 'Document recorded' })
  @ApiResponse({ status: 400, description: 'UPLOAD_MISMATCH: the file is not the one declared; start again' })
  @ApiResponse({ status: 409, description: 'UPLOAD_NOT_FOUND: the file has not arrived yet' })
  complete(@CurrentUser() user: RequestUser, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.documents.complete(user.id, documentId);
  }
}
