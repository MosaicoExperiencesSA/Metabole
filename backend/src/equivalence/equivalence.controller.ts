import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateEquivalenceGroupDto,
  UpdateEquivalenceGroupDto,
} from './dto/equivalence.dto';
import { EquivalenceService } from './equivalence.service';

/** Gestione gruppi di equivalenza dal backoffice (nutrizionista/capo/admin). */
@Controller('equivalence-groups')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class EquivalenceController {
  constructor(private readonly service: EquivalenceService) {}

  @Get()
  list(@Query('status') status?: string, @Query('productId') productId?: string) {
    return this.service.list({ status, productId });
  }

  @Post()
  create(@Body() dto: CreateEquivalenceGroupDto, @CurrentUser() user: AuthUser) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquivalenceGroupDto, @CurrentUser() user: AuthUser) {
    return this.service.update(user.sub, id, dto);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/unapprove')
  unapprove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.unapprove(user.sub, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(user.sub, id);
  }
}
