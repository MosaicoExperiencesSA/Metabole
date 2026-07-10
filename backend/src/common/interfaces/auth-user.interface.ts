import { Role } from '../roles';

/** Utente autenticato come presente in request.user (dal payload JWT). */
export interface AuthUser {
  sub: string; // user id
  email: string;
  role: Role; // ruolo di SISTEMA (guida i controlli RBAC del backend)
  /** Chiave del ruolo personalizzato, se assegnato (solo etichetta + menu). */
  customRoleKey?: string | null;
  /** Presente solo nelle sessioni di impersonazione: id dell'admin che sta operando. */
  impersonatedBy?: string;
}
