import { dividiNome } from '../../common/dividi-nome';

/**
 * Invito a Gaia — gli elenchi dietro le caselle del pannello (17/9, richiesta di Simone: «se clicco
 * sui campi mi si deve aprire la lista con nome, cognome, mail e il pulsante per andare nella sua
 * scheda»).
 *
 * Qui stanno le parti senza database: quali elenchi esistono, come si legge un nome importato,
 * come si scrive il motivo di uno scarto.
 */
export const TIPI_ELENCO = ['inviati', 'oggi', 'cliccati', 'entrati', 'promemoria', 'coda', 'scartati'] as const;
export type TipoElenco = (typeof TIPI_ELENCO)[number];

export const PER_PAGINA = 50;

export interface RigaElenco {
  recordId: string;
  clientId: string | null;
  nome: string;
  cognome: string;
  email: string;
  /** La data che conta per quell'elenco (invio, clic, entrata, promemoria, nascita della scheda). */
  quando: string | null;
  /** Solo negli scartati: perché non ha ricevuto l'invito. */
  motivo: string | null;
}

/**
 * Nome e cognome come li vede lo staff. Le schede nuove li hanno separati; quelle importate hanno
 * spesso solo il nome intero (e a volte `firstName` con la sola prima parola): si divide con la
 * stessa regola di `sistema:nomi`, e se non si può si lascia tutto nel nome invece di inventare.
 */
export function nomeECognome(r: { firstName?: string | null; lastName?: string | null; name?: string | null }): { nome: string; cognome: string } {
  const nome = r.firstName?.trim() ?? '';
  const cognome = r.lastName?.trim() ?? '';
  if (nome && cognome) return { nome, cognome };
  const intero = r.name?.trim() ?? '';
  if (intero) {
    const diviso = dividiNome(intero);
    if (diviso) return diviso;
    return { nome: intero, cognome: cognome };
  }
  return { nome, cognome };
}

const MOTIVI: Record<string, string> = {
  'saltato:email': 'Indirizzo email non valido',
  'saltato:doppione': 'Indirizzo già invitato con un’altra scheda',
  'saltato:account': 'Ha già un account',
  'saltato:consenso': 'Si è disiscritta o ha negato il consenso',
  'saltato:canale': 'Non vuole essere contattata via email',
  'saltato:cambiata': 'La scheda è cambiata dopo un invio fallito',
  fallito: 'Invio non riuscito (si riprova più tardi)',
};

export function motivoLeggibile(esito: string | null | undefined): string | null {
  if (!esito) return null;
  return MOTIVI[esito] ?? esito;
}

/** Pagina richiesta, ripulita: da 1 in su, numeri strani = 1. */
export function paginaValida(p: unknown): number {
  const n = Number(p);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}

/** Testo di ricerca, ripulito: niente spazi ai bordi, massimo 80 caratteri, vuoto = nessun filtro. */
export function cercaValida(c: unknown): string | null {
  const t = typeof c === 'string' ? c.trim().slice(0, 80) : '';
  return t.length >= 2 ? t : null;
}
