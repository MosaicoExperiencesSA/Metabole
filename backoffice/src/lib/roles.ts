import { api } from '../api/client';
import { ROLE_LABEL, type Role } from './labels';

export interface RoleInfo {
  key: string;
  label: string;
  color: string | null;
  isSystem: boolean;
  baseRole: Role;
}

/** Elenco ruoli (sistema staff + personalizzati). */
export function fetchRoles(): Promise<RoleInfo[]> {
  return api<RoleInfo[]>('/admin/roles');
}

/** Etichetta di un ruolo dato l'utente (usa il ruolo personalizzato se presente). */
export function userRoleLabel(
  user: { role: Role; customRole?: { label: string } | null },
): string {
  return user.customRole?.label ?? ROLE_LABEL[user.role];
}
