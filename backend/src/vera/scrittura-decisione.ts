/**
 * LA PORTA PER LAVORARE UNA DECISIONE DELLA CODA «DA VALIDARE» — un token, come le altre.
 *
 * Stessa ragione pratica di `SCRITTURA_RICETTA` e `SCRITTURA_COMBINAZIONE`: importare
 * `NutritionistService` qui trascinerebbe nel grafo di compilazione dei test di Vera mezza
 * applicazione. Il servizio vero resta quello, legato con `useExisting` in `VeraModule`.
 *
 * ⚠️ **Un metodo solo, ed è quello che i pulsanti della coda usano già.** Le regole — quali azioni
 * sono ammesse per quale causa, il perimetro della nutrizionista, «una decisione si lavora una volta
 * sola» — vivono là dentro e **non si duplicano qui**. Se una regola stesse anche in Vera, il giorno
 * che Nocanty ne cambia una la coda e la chat farebbero due cose diverse sulla stessa riga — ed è
 * esattamente il difetto che questo progetto ha già pagato più volte.
 */
import type { AuthUser } from '../common/interfaces/auth-user.interface';

export interface ScritturaDecisione {
  eseguiAzione(user: AuthUser, decisionId: string, azione: string, note?: string): Promise<unknown>;
}

export const SCRITTURA_DECISIONE = 'VERA_SCRITTURA_DECISIONE';
