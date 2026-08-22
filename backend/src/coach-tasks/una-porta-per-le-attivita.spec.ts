import { Logger } from '@nestjs/common';
import { apriAttivitaCoach } from './porta-delle-attivita';
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

/**
 * ⛔ **«NON LANCIA MAI» — la promessa che il docstring faceva a vuoto** (22/8).
 *
 * `apriAttivitaCoach` dichiarava, da quando esiste: *«Non lancia mai: chi chiama sta facendo il
 * lavoro vero (il giro notturno, un sollecito) e un avviso che non parte non deve fermarlo»*. Dentro
 * non c'era **nessun `try`**: le due query su `coachTask` propagavano tutto a chi chiamava.
 *
 * ⛔ Si è visto agganciando la terza condizione del §3 all'**erogazione del menu**: da lì in poi un
 * intoppo su `coachTask` avrebbe fatto fallire la consegna del menu della cliente — cioè esattamente
 * il lavoro vero che questa funzione dichiara di non voler fermare. E lo stesso valeva già per
 * l'altro chiamante dentro `menu.service`, il cui commento ripeteva la promessa in buona fede.
 *
 * ⚠️ Il commento sbagliato è la parte che costa: chi leggeva «non lancia mai» non aveva ragione di
 * mettere un `try` attorno. È lo stesso difetto del 20/8 su «nessun tipo può sfuggire» — una regola
 * scritta e non tenuta, in un posto dove nessuno andava a controllare.
 */
describe('⛔ la porta non lancia mai — e adesso è vero', () => {
  const DATI = {
    clientId: 'c1', kind: 'prova', refId: 'r1',
    title: 't', description: 'd', dueDate: new Date('2026-08-29T00:00:00Z'),
  };
  const push = {} as never;

  it.each([
    ['la lettura', { findUnique: jest.fn().mockRejectedValue(new Error('db via')), create: jest.fn() }],
    ['la scrittura', { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockRejectedValue(new Error('db via')) }],
  ])('⛔ se %s fallisce, non lancia: torna «non-riuscita»', async (_titolo, coachTask) => {
    const prisma = { coachTask } as never;
    await expect(apriAttivitaCoach(prisma, push, DATI)).resolves.toBe('non-riuscita');
  });

  /**
   * ⛔ E **non in silenzio**: un'attività che non nasce senza dirlo è indistinguibile da una
   * situazione che non c'è. *Se degradi, dillo.*
   */
  it('⛔ e lo scrive: un guasto muto sembra «non c\'era niente da aprire»', async () => {
    const avviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma = { coachTask: { findUnique: jest.fn().mockRejectedValue(new Error('db via')), create: jest.fn() } } as never;
    await apriAttivitaCoach(prisma, push, DATI);
    expect(avviso).toHaveBeenCalled();
    // ⚠️ Con dentro cliente e tipo: un log che dice «non riuscita» e basta non si può inseguire.
    expect(String(avviso.mock.calls[0]?.[0])).toContain('c1');
    expect(String(avviso.mock.calls[0]?.[0])).toContain('prova');
    avviso.mockRestore();
  });

  /**
   * ⚠️ E quando va bene, **tutti e due** gli esiti di prima non sono cambiati.
   *
   * ⛔ Qui il test si intitolava «i due esiti buoni restano quelli» e ne provava **uno**
   * (`gia-presente`) — trovato in revisione il 22/8. Il ramo mancante era proprio quello che conta:
   * `'creata'` è l'unico che esegue `avvisaAttivitaNuova` **dentro** il `try` nuovo, cioè l'unico in
   * cui un avviso che non parte potrebbe fermare il menu della cliente. Un titolo che promette due
   * casi e ne prova uno è peggio di un titolo che ne promette uno: chi legge non torna a guardare.
   */
  it('⚠️ già presente: non ricrea e non avvisa', async () => {
    const gia = { coachTask: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }), create: jest.fn() } } as never;
    await expect(apriAttivitaCoach(gia, push, DATI)).resolves.toBe('gia-presente');
    expect((gia as unknown as { coachTask: { create: jest.Mock } }).coachTask.create).not.toHaveBeenCalled();
  });

  it('⛔ creata: torna «creata», e un avviso che non parte NON fa saltare l\'erogazione', async () => {
    const avviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const nuova = {
      coachTask: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 't-nuova', ...DATI }),
      },
      // ⚠️ `avvisaAttivitaNuova` legge il profilo per sapere a chi mandare: qui esplode di proposito.
      clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('db giù')) },
    } as never;
    await expect(apriAttivitaCoach(nuova, push, DATI)).resolves.toBe('creata');
    expect((nuova as unknown as { coachTask: { create: jest.Mock } }).coachTask.create).toHaveBeenCalled();
    avviso.mockRestore();
  });
});
