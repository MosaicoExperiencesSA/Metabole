import { SetMetadata } from '@nestjs/common';
import { Role } from '../roles';

export const ROLES_KEY = 'roles';

/** Restringe una rotta ai ruoli indicati (RBAC). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
