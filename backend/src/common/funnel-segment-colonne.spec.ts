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
