import { Role } from '../roles';

/** Utente autenticato come presente in request.user (dal payload JWT). */
export interface AuthUser {
  sub: string; // user id
  email: string;
  role: Role;
  /** Presente solo nelle sessioni di impersonazione: id dell'admin che sta operando. */
  impersonatedBy?: string;
}
