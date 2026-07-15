/**
 * Estrae data di nascita e sesso dal codice fiscale italiano.
 * Struttura: 6 lettere + 2 cifre (anno) + 1 lettera (mese) + 2 cifre (giorno,
 * +40 per le donne) + 4 (comune) + 1 (controllo). Il secolo è dedotto: se
 * 2000+aa risulta nel futuro si usa 1900+aa. Ritorna null se il CF non è valido.
 */
const CF_MONTHS: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, H: 5, L: 6, M: 7, P: 8, R: 9, S: 10, T: 11 };
const CF_REGEX = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;

export function parseCodiceFiscale(cfRaw: string | null | undefined): { birthDate: Date | null; sex: 'M' | 'F' | null } {
  const cf = (cfRaw ?? '').trim().toUpperCase();
  if (!CF_REGEX.test(cf)) return { birthDate: null, sex: null };
  const yy = parseInt(cf.slice(6, 8), 10);
  const monthCh = cf[8];
  if (!(monthCh in CF_MONTHS)) return { birthDate: null, sex: null };
  const month = CF_MONTHS[monthCh];
  let day = parseInt(cf.slice(9, 11), 10);
  const sex: 'M' | 'F' = day > 40 ? 'F' : 'M';
  if (day > 40) day -= 40;
  if (day < 1 || day > 31) return { birthDate: null, sex: null };
  const nowYear = new Date().getFullYear();
  let year = 2000 + yy;
  if (year > nowYear) year = 1900 + yy;
  // UTC per non far slittare il giorno col fuso orario.
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    return { birthDate: null, sex: null };
  }
  return { birthDate: d, sex };
}

/** true se la stringa ha la forma di un codice fiscale valido (non verifica il carattere di controllo). */
export function isCodiceFiscaleShape(cfRaw: string | null | undefined): boolean {
  return CF_REGEX.test((cfRaw ?? '').trim().toUpperCase());
}
