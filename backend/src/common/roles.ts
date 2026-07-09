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
  'admin',
] as const;

export type Role = (typeof ROLES)[number];
