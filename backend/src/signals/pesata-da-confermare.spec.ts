import { domandaPerLaCliente, domandaPerLoStaff, pesataDaConfermare, toccaIlGiorno } from './pesata-da-confermare';
import { saltoPeggiore } from './peso-incoerente';

const g = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const p = (iso: string, weightKg: number) => ({ date: g(iso), weightKg });

describe('pesataDaConfermare — la domanda che si fa mentre il numero si digita', () => {
  it('il caso della voce: 73 kg otto giorni fa, oggi ne scrive 113', () => {
    const d = pesataDaConfermare([p('2026-08-26', 73)], 113, g('2026-09-03'));
    expect(d).not.toBeNull();
    expect(d!.altra).toEqual({ date: g('2026-08-26'), weightKg: 73 });
    expect(d!.scritto).toBe(113);
    expect(d!.dove).toBe('prima');
    expect(d!.giorni).toBe(8);
    expect(d!.salto).toBe(40);
  });

  it('un numero normale non chiede niente: 73 → 72,4 in una settimana', () => {
    expect(pesataDaConfermare([p('2026-08-27', 73)], 72.4, g('2026-09-03'))).toBeNull();
  });

  /**
   * ⛔ La sentinella dei controesempi di `peso-incoerente.ts`. Sono clienti **vere e frequenti**, e
   * a nessuna di loro la sua app deve chiedere se ha sbagliato a scrivere: il prezzo di una domanda
   * di troppo non è zero, è che la prossima domanda non viene letta.
   */
  it.each([
    ['prima settimana di piano su 130 kg (glicogeno e acqua)', p('2026-08-27', 130), 124.5, '2026-09-03'],
    ['post-parto, 78 → 71 in nove giorni', p('2026-08-25', 78), 71, '2026-09-03'],
    ['avvio di diuretico su edema, 95 → 89 in cinque giorni', p('2026-08-29', 95), 89, '2026-09-03'],
    ['rientro da due settimane di vacanza a +8 kg', p('2026-08-20', 72), 80, '2026-09-03'],
    ['dieci chili in due mesi: è un percorso riuscito', p('2026-07-04', 90), 80, '2026-09-03'],
  ])('non chiede niente: %s', (_titolo, precedente, scritto, quando) => {
    expect(pesataDaConfermare([precedente], scritto as number, g(quando as string))).toBeNull();
  });

  it('la coppia col giorno DOPO conta quanto quella col giorno prima (correzione di una riga in mezzo)', () => {
    // 73 il 20, 74 il 30: correggere il 25 a 113 rompe tutt'e due i lati.
    const d = pesataDaConfermare([p('2026-08-20', 73), p('2026-08-30', 74)], 113, g('2026-08-25'));
    expect(d).not.toBeNull();
    // Salti uguali (40 e 39): vince quello più grosso, cioè il lato di sinistra.
    expect(d!.salto).toBe(40);
    expect(d!.dove).toBe('prima');
  });

  it('se il lato che non torna è SOLO quello dopo, lo dice — e `dove` vale «dopo»', () => {
    // Il 20 non c'è niente; il 30 c'è una 74. Scrivere 114 il 25 rompe solo il lato destro.
    const d = pesataDaConfermare([p('2026-08-30', 74)], 114, g('2026-08-25'));
    expect(d).not.toBeNull();
    expect(d!.dove).toBe('dopo');
    expect(d!.altra).toEqual({ date: g('2026-08-30'), weightKg: 74 });
    expect(d!.giorni).toBe(5);
  });

  /**
   * ⛔ Il difetto che questa riga chiude: senza togliere la riga di pari data, chi **corregge** la
   * pesata di oggi si sentirebbe chiedere conferma confrontando il numero nuovo con quello vecchio
   * dello stesso giorno — cioè la schermata difenderebbe il numero sbagliato proprio mentre
   * qualcuno lo sta riparando.
   */
  it('la riga dello STESSO giorno è quella che si sta sostituendo: non fa coppia con sé stessa', () => {
    const oggi = g('2026-09-03');
    // Oggi c'è già una 113 digitata male; lei la corregge in 73, coerente col 72,8 di ieri.
    const d = pesataDaConfermare([p('2026-09-02', 72.8), p('2026-09-03', 113)], 73, oggi);
    expect(d).toBeNull();
  });

  it('senza altre pesate non c\'è niente da chiedere (prima pesata in assoluto)', () => {
    expect(pesataDaConfermare([], 113, g('2026-09-03'))).toBeNull();
    expect(pesataDaConfermare([p('2026-09-03', 70)], 113, g('2026-09-03'))).toBeNull();
  });

  /**
   * ⚠️ Un salto vecchio e già segnalato non deve ricomparire a ogni pesata: un avviso che compare
   * sempre non è un avviso. Qui la coppia rotta è fra il 1 e il 2 luglio, e oggi si scrive un numero
   * che con la riga di ieri sta benissimo.
   */
  it('un salto che NON tocca il giorno scritto resta fuori', () => {
    const d = pesataDaConfermare(
      [p('2026-07-01', 73), p('2026-07-02', 113), p('2026-09-02', 112.5)],
      112,
      g('2026-09-03'),
    );
    expect(d).toBeNull();
  });

  it('le soglie arrivano da fuori: alzandole, la stessa coppia smette di chiedere', () => {
    const pesate = [p('2026-08-26', 73)];
    expect(pesataDaConfermare(pesate, 113, g('2026-09-03'), 10, 7)).not.toBeNull();
    expect(pesataDaConfermare(pesate, 113, g('2026-09-03'), 50, 7)).toBeNull();
    expect(pesataDaConfermare(pesate, 113, g('2026-09-03'), 10, 40)).toBeNull();
  });

  it('numeri e date storti non fanno esplodere niente: rispondono `null`', () => {
    expect(pesataDaConfermare([p('2026-08-26', 73)], Number.NaN, g('2026-09-03'))).toBeNull();
    expect(pesataDaConfermare([p('2026-08-26', 73)], 113, new Date('non-una-data'))).toBeNull();
    expect(
      pesataDaConfermare(
        [{ date: new Date('boh'), weightKg: 73 }, p('2026-08-26', 73)],
        113,
        g('2026-09-03'),
      ),
    ).not.toBeNull();
  });

  it('l\'ora del giorno non sposta niente: le misure sono colonne DATE', () => {
    const conOra = [{ date: new Date('2026-08-26T22:30:00.000Z'), weightKg: 73 }];
    const d = pesataDaConfermare(conOra, 113, new Date('2026-09-03T09:00:00.000Z'));
    expect(d!.giorni).toBe(8);
  });

  /**
   * ⛔ **La regola clinica è una sola.** Se un domani qualcuno riscrivesse il confronto qui dentro
   * invece di chiamare `saltiImpossibili`, la schermata direbbe «va bene» un istante prima che il
   * guardrail apra la segnalazione. Questo test tiene le due risposte incollate.
   */
  it('dice sì esattamente quando lo direbbe il guardrail sulla stessa coppia', () => {
    for (const [scritto, giorni] of [[113, 8], [83, 8], [84, 8], [90, 60], [124.5, 7]] as const) {
      const quando = g('2026-09-03');
      const prima = new Date(quando.getTime() - giorni * 86_400_000);
      const pesate = [{ date: prima, weightKg: 73 }];
      const mia = pesataDaConfermare(pesate, scritto, quando);
      const suo = saltoPeggiore([...pesate, { date: quando, weightKg: scritto }]);
      expect(!!mia).toBe(!!suo);
      if (mia && suo) {
        expect(mia.salto).toBe(suo.salto);
        expect(mia.giorni).toBe(suo.giorni);
        expect(mia.ritmo).toBe(suo.ritmo);
      }
    }
  });
});

describe('le parole', () => {
  const caso = pesataDaConfermare([p('2026-08-26', 73)], 113, g('2026-09-03'))!;

  it('alla cliente si CHIEDE, non si dice che ha sbagliato', () => {
    const f = domandaPerLaCliente(caso);
    expect(f).toBe(
      'La pesata che abbiamo prima di questa è del 26/08/2026: eri 73 kg. Hai scritto 113 kg: sono 40 kg in 8 giorni. È giusto?',
    );
    expect(f).toMatch(/È giusto\?$/);
    expect(f).not.toMatch(/sbagli|errore|impossibil/i);
  });

  /**
   * ⚠️ Qui non è ancora successo niente: la segnalazione nasce solo se lei risponde «sì» e il
   * numero si salva. Nominarla adesso sarebbe usare la nutrizionista come minaccia per ottenere una
   * correzione — e otterrebbe un «no» proprio da chi quel peso ce l'ha davvero.
   */
  it('e non nomina la nutrizionista, perché a questo punto non c\'è nessuna segnalazione', () => {
    expect(domandaPerLaCliente(caso)).not.toMatch(/nutrizionist|coach|segnal/i);
  });

  it('i decimali si scrivono con la virgola, come li scrive lei', () => {
    const mezzo = pesataDaConfermare([p('2026-08-26', 72.5)], 113, g('2026-09-03'))!;
    expect(domandaPerLaCliente(mezzo)).toContain('72,5 kg');
    expect(domandaPerLaCliente(mezzo)).toContain('40,5 kg');
    expect(domandaPerLaCliente(mezzo)).not.toContain('72.5');
    expect(domandaPerLaCliente(mezzo)).not.toContain('40.5');
  });

  it('«un giorno» al singolare, che è il caso di chi si pesa due volte di fila', () => {
    const ieri = pesataDaConfermare([p('2026-09-02', 73)], 113, g('2026-09-03'))!;
    expect(domandaPerLaCliente(ieri)).toContain('in un giorno');
  });

  it('col lato «dopo» la frase resta leggibile', () => {
    const dopo = pesataDaConfermare([p('2026-08-30', 74)], 114, g('2026-08-25'))!;
    expect(domandaPerLaCliente(dopo)).toBe(
      'La tua pesata del 30/08/2026: eri 74 kg. Hai scritto 114 kg: sono 40 kg in 5 giorni. È giusto?',
    );
  });

  /**
   * ⛔ **La frase non deve mentire quando lei sta CORREGGENDO la pesata di oggi.** «L'ultima volta
   * che ti sei pesata, il 26 agosto» era falso in quel ramo: l'ultima volta che si è pesata è
   * stamattina, ed è proprio la riga che stiamo escludendo dal confronto.
   */
  it('⛔ non dice «l\'ultima volta che ti sei pesata»: in correzione sarebbe falso', () => {
    expect(domandaPerLaCliente(caso)).not.toMatch(/ultima volta/i);
  });

  /**
   * ⚠️ Allo staff serve il **giorno della riga che sta toccando**: dal backoffice si corregge anche
   * una pesata di due mesi fa, e senza la data non si sa quale delle due righe si sta scrivendo.
   */
  it('allo staff si dice il giorno della riga che sta scrivendo, e il ritmo', () => {
    const f = domandaPerLoStaff(caso);
    expect(f).toBe(
      'Il 26/08/2026 la pesata è 73 kg. Con 113 kg il 03/09/2026 sarebbero 40 kg in 8 giorni (35 kg/settimana). Confermi il valore?',
    );
    expect(f).not.toContain('La pesata che abbiamo');
  });
});

/**
 * ⛔ **IL SALTO PEGGIORE DEI NOVANTA GIORNI NON È «QUESTA PESATA»** (trovato in revisione).
 *
 * `controllaPesoIncoerente` risponde la coppia peggiore della finestra, e una volta che una coppia
 * rotta esiste quel campo non torna vuoto per tre mesi — anche dopo che il nutrizionista l'ha
 * guardata e chiusa. Una schermata che dicesse «questa pesata è lontana dalle precedenti» ogni volta
 * che quel campo è pieno, lo direbbe **a ogni pesata normale fino a dicembre**.
 */
describe('toccaIlGiorno', () => {
  it('la coppia che finisce oggi riguarda la pesata appena scritta', () => {
    expect(toccaIlGiorno({ dal: g('2026-08-26'), al: g('2026-09-03') }, g('2026-09-03'))).toBe(true);
  });

  it('e anche quella che comincia oggi (una riga corretta in mezzo alla storia)', () => {
    expect(toccaIlGiorno({ dal: g('2026-09-03'), al: g('2026-09-10') }, g('2026-09-03'))).toBe(true);
  });

  it('⛔ una coppia rotta di due mesi fa NON riguarda la pesata di oggi', () => {
    expect(toccaIlGiorno({ dal: g('2026-07-01'), al: g('2026-07-02') }, g('2026-09-03'))).toBe(false);
  });

  it('l\'ora del giorno non sposta niente, e un giorno storto vale «no»', () => {
    expect(toccaIlGiorno({ dal: g('2026-08-26'), al: new Date('2026-09-03T21:00:00.000Z') }, g('2026-09-03'))).toBe(true);
    expect(toccaIlGiorno({ dal: g('2026-08-26'), al: g('2026-09-03') }, new Date('boh'))).toBe(false);
  });
});
