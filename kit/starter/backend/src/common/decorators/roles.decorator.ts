/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — file estratto da Metabole e ripulito.
 * Manuale: kit/manuale/03-permessi.md
 * Da fare mentre lo copi: niente
 * ⚠️ I commenti che raccontano decisioni ed errori passati sono TENUTI apposta:
 *    sono il motivo per cui il file è fatto così. Non toglierli mentre adatti.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { SetMetadata } from '@nestjs/common';
import { Role } from '../roles';

export const ROLES_KEY = 'roles';

/** Restringe una rotta ai ruoli indicati (RBAC). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
