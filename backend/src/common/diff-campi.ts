/**
 * Che cosa è cambiato, campo per campo — per il log delle modifiche.
 *
 * Nasce dalla domanda di Simone dell'8/8: «nel log modifiche del lead segnamo anche i cambi dati da
 * backoffice? e i cambi da app? se non è così va implementato». La risposta era no due volte, e per
 * un motivo che si ripete: l'audit c'era, ma registrava **tre campi su diciassette** (nome, email,
 * valore) e dall'app non registrava niente del contenuto. Un log che dice «ha modificato la scheda»
 * senza dire cosa è un log che non serve a nessuno: la domanda vera è sempre «chi ha cambiato quel
 * numero di telefono, e quando».
 *
 * Regole, tutte imparate da come i dati arrivano davvero:
 *  - si registrano **solo i campi presenti** nella richiesta (`undefined` = non toccato, che è
 *    diverso da «svuotato»);
 *  - si registrano **solo quelli davvero cambiati**: un salvataggio che non cambia niente non deve
 *    riempire il log di righe vuote;
 *  - `null`, `''` e spazi sono la stessa cosa (campo vuoto), altrimenti ogni salvataggio di un
 *    campo lasciato in bianco sembrerebbe una modifica;
 *  - gli **array** (tag, canali del consenso) si confrontano per contenuto e non per ordine.
 */

export interface CampoCambiato {
  campo: string;
  prima: unknown;
  dopo: unknown;
}

const vuoto = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Confronto di un singolo valore, con le equivalenze descritte sopra. */
function uguali(a: unknown, b: unknown): boolean {
  if (vuoto(a) && vuoto(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    const na = Array.isArray(a) ? [...a].map(String).sort() : [];
    const nb = Array.isArray(b) ? [...b].map(String).sort() : [];
    return na.length === nb.length && na.every((x, i) => x === nb[i]);
  }
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : NaN;
    const tb = b instanceof Date ? b.getTime() : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return String(a) === String(b);
    return ta === tb;
  }
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return a === b;
}

/** Come finisce nel log: le date in ISO (leggibili), il resto così com'è. */
const perIlLog = (v: unknown): unknown => (v instanceof Date ? v.toISOString() : vuoto(v) ? null : v);

/**
 * I campi cambiati fra `prima` e `dopo`, limitati a quelli **richiesti** (`chiavi`): le chiavi sono
 * quelle presenti nel DTO, così un log non elenca campi che il chiamante non ha nemmeno provato a
 * modificare.
 */
export function campiCambiati(
  prima: Record<string, unknown> | null | undefined,
  dopo: Record<string, unknown> | null | undefined,
  chiavi: string[],
): CampoCambiato[] {
  const a = prima ?? {};
  const b = dopo ?? {};
  const out: CampoCambiato[] = [];
  for (const campo of [...new Set(chiavi)]) {
    if (!(campo in b)) continue; // non toccato in questa richiesta
    if (uguali(a[campo], b[campo])) continue;
    out.push({ campo, prima: perIlLog(a[campo]), dopo: perIlLog(b[campo]) });
  }
  return out;
}

/** Etichette italiane dei campi, per il log letto dallo staff. */
export const ETICHETTA_CAMPO: Record<string, string> = {
  name: 'Nome completo',
  firstName: 'Nome',
  lastName: 'Cognome',
  alias: 'Alias',
  nickname: 'Come vuole essere chiamata',
  email: 'Email',
  phone: 'Telefono',
  phone2: 'Secondo telefono',
  valueCents: 'Valore',
  previousStatus: 'Stato precedente',
  historicalPaidCents: 'Totale già pagato',
  codiceFiscale: 'Codice fiscale',
  address: 'Indirizzo',
  addressLine: 'Indirizzo',
  postalCode: 'CAP',
  city: 'Città',
  province: 'Provincia',
  country: 'Paese',
  birthDate: 'Data di nascita',
  tags: 'Tag',
  segment: 'Segmento',
  channel: 'Canale',
  marketingConsent: 'Consenso marketing',
  consentChannels: 'Canali del consenso',
};

export const etichettaCampo = (campo: string): string => ETICHETTA_CAMPO[campo] ?? campo;
