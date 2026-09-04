/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — file estratto da Metabole e ripulito.
 * Manuale: kit/manuale/03-permessi.md
 * Da fare mentre lo copi: niente
 * ⚠️ I commenti che raccontano decisioni ed errori passati sono TENUTI apposta:
 *    sono il motivo per cui il file è fatto così. Non toglierli mentre adatti.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import {
  AdminPermissionsController,
  MePermissionsController,
} from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [RolesModule],
  controllers: [AdminPermissionsController, MePermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
