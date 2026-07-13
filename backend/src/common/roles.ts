/**
 * Ruoli applicativi (allineati all'enum Prisma `Role`).
 * Definiti anche qui per non dipendere dal client generato nei test.
 */
export const ROLES = [
  'client',
  'coach',
  'nutritionist',
  'head_nutritionist',
  'sales',
  'marketing',
  'head_marketing',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

/** Ruoli assegnabili allo staff (il cliente si registra da sé, non si assegna). */
export const STAFF_ROLES: Role[] = ['coach', 'nutritionist', 'head_nutritionist', 'sales', 'marketing', 'head_marketing', 'admin'];

/** Etichette leggibili dei ruoli di sistema (per liste e matrice permessi). */
export const SYSTEM_ROLE_LABELS: Record<Role, string> = {
  client: 'Cliente',
  coach: 'Coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
  sales: 'Commerciale',
  marketing: 'Marketing',
  head_marketing: 'Responsabile Marketing',
  admin: 'Admin',
};

export function isSystemRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
