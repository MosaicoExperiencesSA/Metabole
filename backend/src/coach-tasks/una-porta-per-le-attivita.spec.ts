import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ⚠️ **UN'ATTIVITÀ DELLA COACH NASCE DA UNA PORTA SOLA, E QUELLA PORTA AVVISA.**
 *
 * Come `nutrient-facts/una-porta-sola.spec.ts`, questo test guarda il **sorgente**. Il difetto che
 * chiude è del 20/8 e nessuna mutazione lo avrebbe trovato, perché non stava dentro una funzione:
 * stava in chi scriveva `prisma.coachTask.create` per conto suo.
 *
 * In testa a `avvisaAttivitaNuova` c'era scritto: «Chiamata da `ensureTask`, l'unico punto in cui
 * nasce ogni attività: **nessun tipo può sfuggire**». ⛔ Due sfuggivano:
 *
 *  - **`measures_missing`** — «Misure non inserite: il menu è fermo» — creata a mano dentro il
 *    sollecito misure. Alla cliente arrivava la sua notifica, alla coach **niente**: l'attività
 *    compariva in elenco e la coach scopriva il menu fermo solo se apriva la lista;
 *  - **`pause_regain`** — peso in salita durante una pausa — creata a mano in `pause.service.ts`.
 *    Quella però NON è silenziosa (vedi l'eccezione dichiarata qui sotto).
 *
 * ⚠️ La parte che costa non è la riga: è che **la regola era scritta e non era vera**. Chi la
 * leggeva non aveva ragione di controllare.
 */

/** Chi può scrivere su `coachTask.create`, e perché. Aggiungere qui è una scelta, non una svista. */
const PERMESSI = new Map<string, string>([
  // La porta: crea e avvisa insieme, e le due cose non si possono più separare.
  ['coach-tasks/porta-delle-attivita.ts', 'è la porta'],
  /**
   * ⚠️ **L'ECCEZIONE DICHIARATA.** `pause.service.ts` crea `pause_regain` per conto suo, e va bene
   * così: due righe sotto, `avvisaStaffPausa` avvisa coach **e** nutrizionista, e se la cliente non
   * ha nessuno assegnato ripiega sui capi — cioè copre PIÙ di quanto coprirebbe la push
   * dell'attività, che senza coach assegnata tace. Passare dalla porta qui vorrebbe dire due
   * notifiche per lo stesso fatto, e *un avviso che arriva sempre doppio si impara a ignorarlo*.
   */
  ['pause/pause.service.ts', 'ha il suo avviso, più largo: avvisaStaffPausa (coach + nutrizionista + capi)'],
]);

/** `prisma.coachTask.create` — anche spezzato su più righe, che è come sfuggiva alla ricerca. */
const SCRITTURA = /coachTask\s*\.?\s*\n?\s*\.?(create|upsert|createMany)\s*\(/;

function tuttiIFile(radice: string): string[] {
  const out: string[] = [];
  const gira = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const pieno = join(dir, nome);
      if (statSync(pieno).isDirectory()) gira(pieno);
      else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
    }
  };
  gira(radice);
  return out;
}

describe('le attività della coach nascono da una porta sola', () => {
  const radice = join(__dirname, '..');

  it('nessuno scrive su coachTask fuori dalla porta (o dall’eccezione dichiarata)', () => {
    const colpevoli = tuttiIFile(radice)
      .filter((f) => SCRITTURA.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(radice.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !PERMESSI.has(rel));
    expect(colpevoli).toEqual([]);
  });

  it('la ricerca trova anche la scrittura spezzata su due righe (era così che sfuggiva)', () => {
    // ⚠️ Al primo giro la cercavo con `prisma.coachTask.create` su una riga sola, e questo test
    // sarebbe stato verde con il difetto dentro: `notifications.service.ts` andava a capo dopo
    // `.coachTask`. Una ricerca che non trova il caso vero è peggio di nessuna ricerca.
    expect(SCRITTURA.test('await this.prisma.coachTask\n            .create({')).toBe(true);
    expect(SCRITTURA.test('await this.prisma.coachTask.create({')).toBe(true);
    expect(SCRITTURA.test('await this.prisma.coachTask.findUnique({')).toBe(false);
  });

  it('i file dichiarati nei permessi esistono davvero', () => {
    for (const rel of PERMESSI.keys()) {
      expect(readFileSync(join(radice, rel), 'utf8').length).toBeGreaterThan(0);
    }
  });
});
