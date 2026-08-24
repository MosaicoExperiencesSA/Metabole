/**
 * IL SEGMENTO SI DERIVA DALLE COLONNE VERE, NON DA QUELLE DI UN ALTRO CRM — 20/8.
 *
 * `funnel-segment.ts` aveva un elenco di colonne «calde»: `contacted, interested, recall,
 * appointment, negotiation, trial, paid, won`. Misurato contro le colonne vere del prodotto:
 * **sei di quelle otto in Metabole non esistono**, e **dieci delle dodici vere l'elenco non le
 * conosceva**. Una cliente che aveva già fatto la prima visita risultava **lead freddo** in ogni
 * evento del funnel e nelle email del ciclo di vita: riceveva i messaggi pensati per chi non ha
 * mai risposto.
 *
 * ⚠️ Non era un errore che si vedeva: era una risposta, sbagliata, data con sicurezza.
 *
 * Questi test tengono la regola legata alle colonne che il prodotto ha davvero, prendendole dal
 * seed invece che riscrivendole qui — perché riscriverle qui sarebbe **lo stesso difetto**, un
 * secondo elenco che non sa delle colonne nuove.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { deriveSegment } from './funnel-segment';

/** Le colonne del prodotto, lette dal seed: l'unico posto dove sono scritte. */
const COLONNE: string[] = (() => {
  const seed = readFileSync(join(__dirname, '..', '..', 'prisma', 'seed.ts'), 'utf8');
  const i = seed.indexOf('async function seedPipelineStages');
  const blocco = seed.slice(i, seed.indexOf('const existing', i));
  return [...blocco.matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]);
})();

/**
 * Ordine e `isSystem` letti dallo stesso blocco `defaults` del seed. ⚠️ Si leggono **per chiave**, e
 * non per posizione nel testo: la posizione non è quella che il motore guarda.
 */
const { ORDINE, DI_SISTEMA } = (() => {
  const seed = readFileSync(join(__dirname, '..', '..', 'prisma', 'seed.ts'), 'utf8');
  const i = seed.indexOf('async function seedPipelineStages');
  const blocco = seed.slice(i, seed.indexOf('const existing', i));
  const ordine = new Map<string, number>();
  const sistema = new Map<string, boolean>();
  for (const riga of blocco.split('\n')) {
    const k = /key: '([a-z_]+)'/.exec(riga);
    if (!k) continue;
    const o = /order: (\d+)/.exec(riga);
    const sy = /isSystem: (true|false)/.exec(riga);
    if (o) ordine.set(k[1], Number(o[1]));
    if (sy) sistema.set(k[1], sy[1] === 'true');
  }
  return { ORDINE: ordine, DI_SISTEMA: sistema };
})();

describe('le colonne del prodotto sono quelle che credo', () => {
  it('il seed ne dichiara dodici, e ci sono quelle che contano', () => {
    expect(COLONNE.length).toBeGreaterThanOrEqual(12);
    for (const k of ['lead_in', 'worked', 'primo_accesso_effettuato', 'questionnaire_done', 'trial', 'paid', 'first_visit', 'follow_up', 'path_ended']) {
      expect(COLONNE).toContain(k);
    }
  });
});

describe('freddo è solo «Nuovo contatto»', () => {
  it('`lead_in` è freddo: è la colonna in cui una scheda nasce senza che sia successo niente', () => {
    expect(deriveSegment({ stage: 'lead_in' })).toBe('lead_freddo');
  });

  it('⚠️ senza colonna, freddo: non è «non si sa», è «non è successo niente»', () => {
    expect(deriveSegment({})).toBe('lead_freddo');
    expect(deriveSegment({ stage: null })).toBe('lead_freddo');
  });

  it('⛔ TUTTE le altre colonne del prodotto sono calde o ex cliente, nessuna resta fredda', () => {
    const fredde = COLONNE.filter((k) => k !== 'lead_in' && deriveSegment({ stage: k }) === 'lead_freddo');
    expect(fredde).toEqual([]);
  });

  it('i casi che erano sbagliati prima, uno per uno', () => {
    expect(deriveSegment({ stage: 'questionnaire_done' })).toBe('lead_caldo');
    expect(deriveSegment({ stage: 'coach_assigned' })).toBe('lead_caldo');
    expect(deriveSegment({ stage: 'coach_call' })).toBe('lead_caldo');
    expect(deriveSegment({ stage: 'first_visit' })).toBe('lead_caldo');
    expect(deriveSegment({ stage: 'follow_up' })).toBe('lead_caldo');
    expect(deriveSegment({ stage: 'worked' })).toBe('lead_caldo');
  });

  it('⚠️ una colonna creata domani nasce CALDA: è il verso che ha evitato il difetto', () => {
    expect(deriveSegment({ stage: 'colonna_inventata_domani' })).toBe('lead_caldo');
  });
});

describe('«Percorso concluso» è un ex cliente', () => {
  it('ha comprato e ha finito (Simone, 20/8)', () => {
    expect(deriveSegment({ stage: 'path_ended' })).toBe('ex_cliente');
  });

  it('⚠️ e ci arriva anche senza `historicalPaidCents`: quello sono i soldi spesi PRIMA di Metabole', () => {
    expect(deriveSegment({ stage: 'path_ended', historicalPaidCents: 0 })).toBe('ex_cliente');
  });
});

describe('«Non ha seguito» è un ex cliente anche lei (24/8)', () => {
  it('⛔ ha PAGATO e il piano è finito: le email da mandarle sono quelle di chi torna', () => {
    // Lasciarla fuori la farebbe scivolare in `lead_caldo`, cioè le manderebbe le email di chi non
    // ha ancora comprato — a una che ha già pagato e non è mai partita. È il caso peggiore dei due.
    expect(deriveSegment({ stage: 'non_seguita' })).toBe('ex_cliente');
    expect(deriveSegment({ stage: 'non_seguita', historicalPaidCents: 0 })).toBe('ex_cliente');
  });

  /**
   * ⛔ **LE DUE PROPRIETÀ DA CUI DIPENDE TUTTO, E CHE NIENTE TENEVA FERME** (trovate in revisione il
   * 24/8: rompendo il seed la suite restava verde su 5013 test).
   *
   *  1. `order` **maggiore** di `path_ended`: `avanzaStatoSeIndietro` non retrocede e si ferma anche
   *     al pareggio, quindi con un ordine più basso o uguale la colonna resta **vuota per sempre** —
   *     e una colonna vuota si legge come «non è successo a nessuno», non come «è rotta».
   *  2. `isSystem: true`: il seed ricrea le colonne solo alla **prima** installazione; su un
   *     database già avviato — cioè in produzione — arrivano soltanto quelle di sistema. Senza,
   *     questa colonna non nascerebbe mai e nessuno se ne accorgerebbe.
   *
   * ⚠️ Il test di prima guardava `COLONNE[length-1]`, cioè la posizione **nel testo del file**: è
   * l'asserzione che dà sicurezza senza darne, e infatti non vedeva né l'una né l'altra.
   */
  it('⛔ nel seed sta DOPO «Percorso concluso» ed è di sistema', () => {
    expect(COLONNE).toContain('non_seguita');
    expect(ORDINE.get('non_seguita')).toBeGreaterThan(ORDINE.get('path_ended') as number);
    expect(DI_SISTEMA.get('non_seguita')).toBe(true);
  });
});

describe('quello che decideva prima decide ancora', () => {
  it('il segmento scritto a mano sulla scheda vince su tutto', () => {
    expect(deriveSegment({ segment: 'lead_freddo', stage: 'paid', historicalPaidCents: 5000 })).toBe('lead_freddo');
  });

  it('chi ha speso soldi prima di Metabole è ex cliente, in qualunque colonna stia', () => {
    expect(deriveSegment({ stage: 'lead_in', historicalPaidCents: 1 })).toBe('ex_cliente');
  });

  it('lo stato precedente importato («cliente attivo») vale ancora', () => {
    expect(deriveSegment({ stage: 'lead_in', previousStatus: 'Cliente attivo' })).toBe('ex_cliente');
    expect(deriveSegment({ stage: 'lead_in', previousStatus: 'Acquisito 2024' })).toBe('ex_cliente');
  });
});
