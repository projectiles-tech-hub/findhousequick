import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import type { RequestUser } from '../controls/request-context.js';
import { AddStaffDto, UpdateStaffDto } from './dto.js';
import { oneContact } from '../accounts/contact.js';
import { StaffOnly } from './staff.guard.js';
import { StaffService } from './staff.service.js';

/** Managing staff (ADR 0005). Super admins only; every change is written to the audit log. */
@ApiTags('Admin')
@Controller('admin/staff')
@StaffOnly('SUPER_ADMIN')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'All staff members, with roles and countries' })
  @ApiOkResponse({ description: 'Staff members' })
  list() {
    return this.staff.list();
  }

  @Post()
  @ApiOperation({ summary: 'Make a registered user a staff member, by confirmed phone number or email address (decision 38)' })
  @ApiCreatedResponse({ description: 'Staff member added' })
  @ApiResponse({ status: 404, description: 'No account has confirmed this phone number or email address (USER_NOT_FOUND)' })
  @ApiResponse({ status: 409, description: 'Already a staff member (ALREADY_STAFF)' })
  add(@CurrentUser() actor: RequestUser, @Body() dto: AddStaffDto) {
    return this.staff.add(actor.id, oneContact(dto), dto.roles, dto.countryScopes);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: "Change a staff member's roles or countries, or deactivate them",
    description: 'You cannot deactivate yourself or remove your own super admin role.',
  })
  @ApiOkResponse({ description: 'Updated staff member' })
  @ApiResponse({ status: 404, description: 'No such staff member (STAFF_NOT_FOUND)' })
  update(
    @CurrentUser() actor: RequestUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(actor.id, userId, dto);
  }
}
