import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

/** I metodi che non cambiano niente. Tutto il resto, sotto impersonazione, è rifiutato. */
const LETTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * L'unica scrittura ammessa: uscire. Senza, chi è entrato resterebbe dentro fino alla scadenza
 * del token, e «Torna admin» darebbe un errore proprio mentre si prova a fare la cosa giusta.
 */
const CONSENTITE = ['/auth/logout'];

/**
 * «ENTRA COME» È IN SOLA LETTURA (decisione di Simone dell'11/8).
 *
 * Il token di impersonazione porta `impersonatedBy`, ma finora nessuna rotta lo guardava: chi
 * entrava nei panni di una cliente poteva anche agire al posto suo, e l'audit di quelle azioni
 * diceva che le aveva fatte lei. Per una persona che ci mette dentro peso, misure e documenti
 * sanitari non è un dettaglio: è la differenza fra «qualcuno ha guardato» e «qualcuno ha deciso
 * al posto mio senza che io lo sappia».
 *
 * Quindi: sotto impersonazione passano solo le letture. Il rifiuto dice **perché**, altrimenti
 * chi sta aiutando una cliente al telefono vede un 403 muto e pensa a un guasto.
 */
@Injectable()
export class SolaLetturaImpersonazioneGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    // Nessuna impersonazione in corso: questa guardia non esiste.
    if (!user?.impersonatedBy) return true;
    if (LETTURA.has(String(req.method).toUpperCase())) return true;

    // Il prefisso globale è `api/v1`: si confronta la CODA del percorso, non il percorso intero.
    const percorso = String(req.path ?? req.url ?? '').split('?')[0].replace(/\/+$/, '');
    if (CONSENTITE.some((c) => percorso.endsWith(c))) return true;

    throw new ForbiddenException(
      'Sei entrato in questo account in SOLA LETTURA: puoi vedere tutto quello che vede lei, ma non modificare niente. Per cambiare qualcosa esci e fallo dal backoffice, così resta scritto chi lo ha fatto.',
    );
  }
}
