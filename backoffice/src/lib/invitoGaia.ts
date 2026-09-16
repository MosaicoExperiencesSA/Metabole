/**
 * Pannello «Invito a Gaia» (16/9): le frasi che dipendono dai numeri, fuori dal componente per
 * poterle provare.
 */
export type InvitoPanoramica = {
  impostazioni: { attivo: boolean; alGiorno: number; promemoriaGiorni: number; oraDa: number; oraA: number; linkOre: number };
  conteggi: { inviati: number; oggi: number; falliti: number; scartati: number; promemoria: number; cliccati: number; entrati: number; inCoda: number };
  obbligoConsenso: boolean;
  modelliSpenti: string[];
  ultimoInvio: string | null;
  nellaFinestraOra: boolean;
};

/** Quanti giorni servono per scrivere a tutta la coda, al ritmo impostato. */
export function giorniPerLaCoda(inCoda: number, alGiorno: number): number | null {
  if (!Number.isFinite(inCoda) || !Number.isFinite(alGiorno) || alGiorno <= 0) return null;
  return Math.ceil(Math.max(0, inCoda) / alGiorno);
}

/** Percentuale leggibile, senza divisioni per zero. */
export function percento(parte: number, totale: number): string {
  if (!totale || totale <= 0) return '—';
  const p = (parte / totale) * 100;
  return `${p < 10 ? p.toFixed(1).replace('.', ',') : Math.round(p)}%`;
}

/** Il testo della conferma prima di accendere: cosa succede davvero, con i numeri. */
export function testoAccensione(p: InvitoPanoramica): string {
  const { alGiorno, oraDa, oraA, promemoriaGiorni } = p.impostazioni;
  const oggi = Math.max(0, Math.min(alGiorno - p.conteggi.oggi, p.conteggi.inCoda));
  return (
    `${p.nellaFinestraOra ? 'Da adesso' : `Dalla prossima fascia oraria (dalle ${oraDa})`} partiranno fino a ${alGiorno} email al giorno (fra le ${oraDa} e le ${oraA}) ` +
    `ai lead in «Nuovo contatto», tranne chi si è disiscritto o ha negato il consenso. ` +
    `${p.conteggi.inCoda <= 0 ? 'Al momento non c’è nessuno in coda. ' : oggi > 0 ? `Oggi ne partono fino a ${oggi}. ` : 'La quota di oggi è già raggiunta: si riparte domani. '}` +
    `Dopo ${promemoriaGiorni} giorni chi non è entrata riceve un promemoria.`
  );
}

/** Le note del giro, in italiano. */
export function notaGiro(nota: string | null): string {
  if (!nota) return 'completato';
  if (nota === 'spento') return 'invito spento';
  if (nota === 'fuori dalla finestra oraria') return 'fuori orario, nessun invio';
  if (nota === 'giro già in corso') return 'un giro era già in corso';
  return nota;
}

/**
 * I numeri del modulo, controllati: una casella vuota NON è zero (zero ore = invii da mezzanotte,
 * zero email = invio fermo, e nessuno dei due si scrive svuotando un campo per sbaglio).
 */
export function leggiNumeri(b: { alGiorno: string; promemoriaGiorni: string; oraDa: string; oraA: string }):
  | { ok: true; valori: { alGiorno: number; promemoriaGiorni: number; oraDa: number; oraA: number } }
  | { ok: false; errore: string } {
  const campi = [
    ['alGiorno', 'Email al giorno', 0, 1000],
    ['promemoriaGiorni', 'Promemoria dopo', 1, 90],
    ['oraDa', 'Dalle ore', 0, 23],
    ['oraA', 'Alle ore', 1, 24],
  ] as const;
  const valori = {} as Record<(typeof campi)[number][0], number>;
  for (const [k, nome, min, max] of campi) {
    const t = b[k].trim();
    if (!/^\d+$/.test(t)) return { ok: false, errore: `${nome}: scrivi un numero intero.` };
    const n = Number(t);
    if (n < min || n > max) return { ok: false, errore: `${nome}: deve stare fra ${min} e ${max}.` };
    valori[k] = n;
  }
  if (valori.oraDa >= valori.oraA) return { ok: false, errore: 'L’ora di inizio deve venire prima dell’ora di fine.' };
  return { ok: true, valori };
}
