/**
 * Regola aziendale dei codici invito (decisa il 14/7/2026):
 * **5 lettere del cognome + iniziale del nome + progressivo a 2 cifre da 01**
 * (es. AnnaLisa Volpetti → VOLPEA01). Vale per ogni codice generato in
 * automatico: ref code coach e codice cliente "porta un'amica".
 *
 * I codici sono salvati in MAIUSCOLO; l'inserimento è case-insensitive
 * (chi risolve fa trim+toUpperCase). Con la stessa forma nei due spazi,
 * l'unicità va verificata su ENTRAMBE le tabelle (staff.refCode e
 * clientProfile.referralCode): il chiamante passa il proprio `isTaken`.
 */

/** Base del codice: 5 lettere del cognome + iniziale del nome (senza accenti/spazi). */
export function refCodeBase(firstName?: string | null, lastName?: string | null): string | null {
  const clean = (s: string | null | undefined) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // via gli accenti (è→e)
      .replace(/[^a-zA-Z]/g, '') // solo lettere (via spazi, apostrofi…)
      .toUpperCase();
  const surname = clean(lastName);
  const first = clean(firstName);
  if (!surname || !first) return null;
  return surname.slice(0, 5) + first[0];
}

/** Primo codice libero `base`+NN (01..99) secondo `isTaken`; null se esauriti. */
export async function nextRuleCode(
  base: string,
  isTaken: (code: string) => Promise<boolean>,
): Promise<string | null> {
  for (let n = 1; n <= 99; n++) {
    const code = base + String(n).padStart(2, '0');
    if (!(await isTaken(code))) return code;
  }
  return null;
}

/** Estrae (nome, cognome) da un displayName "Nome Cognome": ultimo token = cognome. */
export function splitDisplayName(displayName?: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}
