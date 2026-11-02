import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import { checkIdempotencyKey } from '../common/idempotency.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { StartMediaUploadDto } from './dto.js';
import { MediaService } from './media.service.js';

@ApiTags('Media')
@ApiBearerAuth()
@Controller()
@RequireLevel(2)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('units/:unitId/media')
  @RequireFeature('platform.new_listings')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Repeating the request with the same key resumes the same upload' })
  @ApiOperation({
    summary: 'Start a photo or video upload for one part of the unit',
    description:
      "Only media taken with the app's camera, at the building, is accepted. The file is sent in parts of `partSizeBytes`, " +
      'one to each of `partUrls`, with `uploadHeaders`; then call /media/{id}/complete. Asking again with the same ' +
      'Idempotency-Key returns fresh links and `receivedParts`, so an interrupted upload carries on.',
  })
  @ApiCreatedResponse({ description: 'Resumable upload created' })
  @ApiResponse({ status: 400, description: 'UNKNOWN_PART, WRONG_MEDIA_KIND, WRONG_CONTENT_TYPE or FILE_TOO_LARGE' })
  @ApiResponse({ status: 409, description: 'LISTING_LOCKED (listing waiting for review, live or paused) or MEDIA_ALREADY_UPLOADED' })
  @ApiResponse({ status: 422, description: 'CAPTURE_TOO_FAR, CAPTURE_TOO_OLD or CAPTURE_TIME_INVALID' })
  start(
    @CurrentUser() user: RequestUser,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: StartMediaUploadDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.media.start(user, unitId, dto, checkIdempotencyKey(idempotencyKey));
  }

  @Get('units/:unitId/media')
  @RequireLevel(1)
  @ApiOperation({ summary: 'Photos and videos taken for the unit, by part (those who may manage the building)' })
  @ApiOkResponse({ description: 'Media items; display copies behind links that run out after 15 minutes' })
  list(@CurrentUser() user: RequestUser, @Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.media.list(user, unitId);
  }

  @Post('media/:mediaId/complete')
  @HttpCode(202)
  @ApiOperation({ summary: 'Confirm an upload finished; starts processing (quality check, location data removal, watermarking)' })
  @ApiAcceptedResponse({ description: 'Processing started. Status becomes READY, or REJECTED with reasons such as BLURRY or TOO_DARK' })
  @ApiResponse({ status: 400, description: 'UPLOAD_MISMATCH: the file is not the one declared; start again' })
  @ApiResponse({ status: 409, description: 'UPLOAD_NOT_FOUND: some parts have not arrived (receivedParts lists those that have)' })
  complete(@CurrentUser() user: RequestUser, @Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.media.complete(user, mediaId);
  }

  @Delete('media/:mediaId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a photo or video, while the unit has no listing waiting for review, live or paused' })
  @ApiResponse({ status: 204, description: 'Removed' })
  @ApiResponse({ status: 409, description: 'LISTING_LOCKED' })
  async remove(@CurrentUser() user: RequestUser, @Param('mediaId', ParseUUIDPipe) mediaId: string): Promise<void> {
    await this.media.remove(user, mediaId);
  }
}
