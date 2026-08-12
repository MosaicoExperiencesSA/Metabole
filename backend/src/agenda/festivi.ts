/**
 * LE FESTIVITÀ ITALIANE — «nei festivi li chiudiamo noi in automatico» (Simone, 12/8).
 *
 * Il nutrizionista scrive la sua settimana tipo una volta e vale per tutte le settimane. Il primo
 * gennaio, però, quel «lunedì dalle 9» non deve comparire fra gli orari prenotabili: non è una cosa
 * che deve ricordarsi lui ogni anno, ed è l'unica parte del calendario che sappiamo già.
 *
 * ## Perché è un file e non una lista di date
 *
 * Otto delle undici sono a data fissa e si potrebbero scrivere a mano. Le altre due — Pasqua e il
 * lunedì dell'Angelo — si muovono ogni anno, e una lista scritta a mano vuol dire che qualcuno,
 * un anno, si dimentica di aggiornarla: gli slot del giorno di Pasqua tornerebbero prenotabili e
 * nessun errore lo direbbe. Qui la Pasqua si **calcola**, e il file non scade.
 *
 * ⚠️ Il santo patrono NON c'è, ed è una scelta: cambia da città a città (Milano il 7 dicembre,
 * Roma il 29 giugno) e noi non sappiamo dove ciascun nutrizionista lavora. Per quello ci sono le
 * ferie, che si mettono a mano.
 */

/**
 * La domenica di Pasqua, con l'algoritmo di Meeus/Jones/Butcher (calendario gregoriano).
 *
 * Non è codice da capire leggendolo — è aritmetica del calendario, e va verificata sui risultati:
 * i test la confrontano con le date vere di sette anni consecutivi, che è l'unico modo onesto di
 * dire che funziona.
 */
export function pasqua(anno: number): { mese: number; giorno: number } {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese, giorno };
}

const due = (n: number) => String(n).padStart(2, '0');
const iso = (anno: number, mese: number, giorno: number) => `${anno}-${due(mese)}-${due(giorno)}`;

/** Le feste a data fissa, come `MM-GG`. */
const FISSE: { md: string; nome: string }[] = [
  { md: '01-01', nome: 'Capodanno' },
  { md: '01-06', nome: 'Epifania' },
  { md: '04-25', nome: 'Liberazione' },
  { md: '05-01', nome: 'Festa dei lavoratori' },
  { md: '06-02', nome: 'Festa della Repubblica' },
  { md: '08-15', nome: 'Ferragosto' },
  { md: '11-01', nome: 'Ognissanti' },
  { md: '12-08', nome: 'Immacolata' },
  { md: '12-25', nome: 'Natale' },
  { md: '12-26', nome: 'Santo Stefano' },
];

/** Tutte le festività di un anno, come `YYYY-MM-DD` → nome. */
export function festivitaDellAnno(anno: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of FISSE) out.set(`${anno}-${f.md}`, f.nome);

  const p = pasqua(anno);
  out.set(iso(anno, p.mese, p.giorno), 'Pasqua');
  // Il lunedì dell'Angelo è il giorno dopo, e può cadere nel mese successivo (Pasqua il 31 marzo).
  const lunedi = new Date(Date.UTC(anno, p.mese - 1, p.giorno + 1));
  out.set(lunedi.toISOString().slice(0, 10), "Lunedì dell'Angelo");
  return out;
}

/** Il nome della festività, o `null` se quel giorno si lavora. `data` è `YYYY-MM-DD`. */
export function festivita(data: string): string | null {
  const anno = Number(data.slice(0, 4));
  if (!Number.isFinite(anno)) return null;
  return festivitaDellAnno(anno).get(data) ?? null;
}

export const eFestivo = (data: string): boolean => festivita(data) !== null;

/**
 * La domenica conta come giorno non lavorativo? **No, non qui.**
 *
 * Se un nutrizionista mette uno slot di domenica è perché la domenica riceve, e chiuderglielo
 * d'ufficio sarebbe decidere al posto suo. Le festività sono un'altra cosa: sono giorni in cui la
 * CLIENTE non si aspetta di trovare posto, ed è per questo che li chiudiamo noi.
 */
