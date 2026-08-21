/**
 * L'OROLOGIO — i test della geometria.
 *
 * Un quadrante sbagliato non dà errore: disegna. La lancetta finisce due gradi più in là, l'arco
 * mostra le ore **complementari**, e nessuno se ne accorge finché una cliente non dice «ma io
 * mangio alle 12». Questi test guardano i numeri che poi diventano pixel.
 */
import { describe, expect, it } from 'vitest';
import {
  MINUTI_AL_GIORNO,
  angoloInMinuti,
  arcoFinestra,
  arrotondaAlPasso,
  contoAllaRovescia,
  minutiInAngolo,
  oraAdesso,
  oraDelGiorno,
  puntoSulQuadrante,
  quantoManca,
} from './orologio';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;

describe('⚠️ il quadrante è di ventiquattro ore, con la mezzanotte in alto', () => {
  it('mezzanotte è zero gradi, mezzogiorno centottanta', () => {
    expect(minutiInAngolo(0)).toBe(0);
    expect(minutiInAngolo(H(12))).toBe(180);
    expect(minutiInAngolo(H(6))).toBe(90);
    expect(minutiInAngolo(H(18))).toBe(270);
  });

  /**
   * ⛔ Su un quadrante da **dodici** ore mezzogiorno tornerebbe a zero, e una finestra di otto ore
   * sarebbe disegnata larga il doppio. È l'errore che si vede solo confrontando il disegno con
   * l'orario scritto sotto.
   */
  it('⛔ le 12:00 NON tornano al punto di partenza: sono l\'opposto', () => {
    expect(minutiInAngolo(H(12))).not.toBe(minutiInAngolo(0));
    expect(MINUTI_AL_GIORNO).toBe(1440);
  });

  it('l\'angolo e l\'orario sono l\'uno l\'inverso dell\'altro', () => {
    for (const min of [0, H(1), H(6, 30), H(12), H(18, 45), H(23, 55)]) {
      expect(angoloInMinuti(minutiInAngolo(min))).toBe(min);
    }
  });

  it('un angolo fuori giro rientra invece di uscire dal quadrante', () => {
    expect(angoloInMinuti(360)).toBe(0);
    expect(angoloInMinuti(-90)).toBe(H(18));
    expect(angoloInMinuti(450)).toBe(H(6));
  });
});

describe('⚠️ dove cade il punto sul quadrante', () => {
  const CX = 100;
  const CY = 100;
  const R = 80;
  const vicino = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.001);

  /**
   * ⚠️ In SVG l'angolo zero guarda a **destra** e la Y cresce verso il **basso**. Senza il −90° la
   * mezzanotte finirebbe a destra e tutto il quadrante sarebbe ruotato di sei ore — un errore che
   * il disegno non denuncia, perché resta un cerchio bellissimo.
   */
  it('⛔ mezzanotte è in ALTO, non a destra', () => {
    const p = puntoSulQuadrante(0, R, CX, CY);
    vicino(p.x, CX);
    vicino(p.y, CY - R);
  });

  it('le 06:00 a destra, mezzogiorno in basso, le 18:00 a sinistra', () => {
    vicino(puntoSulQuadrante(H(6), R, CX, CY).x, CX + R);
    vicino(puntoSulQuadrante(H(12), R, CX, CY).y, CY + R);
    vicino(puntoSulQuadrante(H(18), R, CX, CY).x, CX - R);
  });

  it('ogni punto resta sul cerchio, a qualunque ora', () => {
    for (let min = 0; min < MINUTI_AL_GIORNO; min += 37) {
      const p = puntoSulQuadrante(min, R, CX, CY);
      const distanza = Math.hypot(p.x - CX, p.y - CY);
      expect(Math.abs(distanza - R)).toBeLessThan(0.001);
    }
  });
});

describe('⛔ l\'arco della finestra, e il flag che mostra le ore sbagliate', () => {
  /**
   * ⛔ **`large-arc`.** Va acceso quando l'arco supera i 180°, cioè più di dodici ore su questo
   * quadrante. Sbagliarlo non dà errore: SVG disegna l'arco **complementare**, cioè mostra alla
   * cliente esattamente le ore in cui NON può mangiare. Le cinque finestre di oggi stanno tutte
   * sotto le dodici ore, quindi il flag è sempre zero — ma la riga deve restare giusta.
   */
  /**
   * ⚠️ **Il flag si legge in posizione 7, e la prima versione di questo test leggeva la 6** — che è
   * la rotazione dell'asse, sempre `0`. Cinque casi verdi che non guardavano niente: se ne è
   * accorto solo il caso a tredici ore, l'unico che si aspettava un `1`. Una riga di conteggio
   * sbagliata basta a rendere vuota un'intera tabella di prove.
   * `M x y A r r rotazione large sweep bx by` → 0:M 1:x 2:y 3:A 4:r 5:r 6:rotazione 7:large 8:sweep
   */
  const largeArc = (d: string): string => d.split(' ')[7];

  it.each([
    [10], // 14:10
    [8],  // 16:8
    [6],  // 18:6
    [4],  // 20:4
    [1],  // 23:1
  ])('una finestra di %s ore sta sotto il mezzo giro: large-arc spento', (ore) => {
    expect(largeArc(arcoFinestra(H(12), ore as number, 80, 100, 100))).toBe('0');
  });

  it('⛔ ma sopra le dodici ore si accende, o si disegnerebbe il digiuno al posto del pasto', () => {
    expect(largeArc(arcoFinestra(H(12), 13, 80, 100, 100))).toBe('1');
    expect(largeArc(arcoFinestra(H(12), 12, 80, 100, 100))).toBe('0');
  });

  /**
   * ⛔ **IL SECONDO FLAG, quello che la prima versione di questi test lasciava scoperto.** `sweep`
   * dice da che parte gira l'arco: a zero, SVG disegna la stessa corda **dall'altra parte**, cioè
   * ancora una volta le ore in cui la cliente NON può mangiare. I due punti di partenza e arrivo
   * restano identici, quindi nessun test che guardi solo quelli se ne accorge — e infatti la
   * mutazione passava.
   */
  const sweep = (d: string): string => d.split(' ')[8];

  it('⛔ l\'arco gira in senso orario: sweep acceso, su ogni durata e ogni posizione', () => {
    for (const ore of [1, 4, 6, 8, 10, 13]) {
      for (const inizio of [0, H(6), H(12), H(19), H(23, 30)]) {
        expect(sweep(arcoFinestra(inizio, ore, 80, 100, 100))).toBe('1');
      }
    }
  });

  it('parte dall\'apertura e arriva alla chiusura', () => {
    const d = arcoFinestra(H(12), 8, 80, 100, 100);
    const a = puntoSulQuadrante(H(12), 80, 100, 100);
    const b = puntoSulQuadrante(H(20), 80, 100, 100);
    expect(d).toContain(`M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`);
    expect(d.endsWith(`${b.x.toFixed(2)} ${b.y.toFixed(2)}`)).toBe(true);
  });

  it('una finestra che scavalca la mezzanotte è un arco solo', () => {
    const d = arcoFinestra(H(19), 8, 80, 100, 100);
    expect(d.startsWith('M')).toBe(true);
    expect(d.split('A')).toHaveLength(2);
  });
});

describe('⛔ il conto alla rovescia', () => {
  it('dentro la finestra dice quanto manca alla chiusura', () => {
    const c = contoAllaRovescia(H(14), H(12), 8);
    expect(c.stato).toBe('finestra');
    expect(c.mancaMin).toBe(H(6));
    expect(c.manca).toBe('6h');
    expect(c.sotto).toContain('20:00');
  });

  it('fuori dalla finestra dice quanto manca all\'apertura', () => {
    const c = contoAllaRovescia(H(22), H(12), 8);
    expect(c.stato).toBe('digiuno');
    expect(c.mancaMin).toBe(H(14));
    expect(c.sotto).toContain('12:00');
  });

  /**
   * ⛔ **I due minuti di confine.** All'apertura è **già** finestra; alla chiusura è **già**
   * digiuno. Sembra un dettaglio, ed è la differenza fra «puoi mangiare» e «hai finito» nel minuto
   * esatto in cui lei guarda lo schermo — la stessa convenzione delle push, o l'app e la notifica
   * si contraddicono.
   */
  it('⛔ il minuto dell\'apertura è finestra, quello della chiusura è digiuno', () => {
    expect(contoAllaRovescia(H(12), H(12), 8).stato).toBe('finestra');
    expect(contoAllaRovescia(H(20), H(12), 8).stato).toBe('digiuno');
    expect(contoAllaRovescia(H(19, 59), H(12), 8).stato).toBe('finestra');
  });

  it('funziona anche a cavallo della mezzanotte', () => {
    // Finestra 19:00 → 03:00. All'01:00 è dentro; alle 05:00 no.
    expect(contoAllaRovescia(H(1), H(19), 8).stato).toBe('finestra');
    expect(contoAllaRovescia(H(1), H(19), 8).mancaMin).toBe(H(2));
    expect(contoAllaRovescia(H(5), H(19), 8).stato).toBe('digiuno');
    expect(contoAllaRovescia(H(5), H(19), 8).mancaMin).toBe(H(14));
  });

  it('⚠️ e il tempo che manca non è mai negativo né più lungo di un giorno', () => {
    for (let ora = 0; ora < MINUTI_AL_GIORNO; ora += 13) {
      for (const apertura of [0, H(8), H(19)]) {
        const c = contoAllaRovescia(ora, apertura, 8);
        expect(c.mancaMin).toBeGreaterThan(0);
        expect(c.mancaMin).toBeLessThanOrEqual(MINUTI_AL_GIORNO);
      }
    }
  });
});

describe('⛔ che ora è adesso: quella di Roma, non quella del telefono', () => {
  /**
   * ⛔ Il server calcola tutto nel fuso dell'azienda. Se l'app leggesse l'ora del **dispositivo**,
   * una cliente in viaggio si troverebbe la notifica «hai finito di mangiare» mentre lo schermo le
   * dice «puoi mangiare ancora per sei ore»: due risposte diverse alla stessa domanda, nello stesso
   * istante, dallo stesso prodotto.
   */
  it('⛔ le 20:00 di Roma sono 1200 minuti, comunque sia messo il telefono', () => {
    expect(oraAdesso(new Date('2026-08-21T20:00:00+02:00'))).toBe(H(20));
    expect(oraAdesso(new Date('2026-08-21T18:00:00Z'))).toBe(H(20));
  });

  it('⚠️ e d\'inverno lo scarto è di un\'ora, non di due: non si sottrae un numero fisso', () => {
    expect(oraAdesso(new Date('2026-01-15T11:30:00Z'))).toBe(H(12, 30));
    expect(oraAdesso(new Date('2026-08-15T11:30:00Z'))).toBe(H(13, 30));
  });

  it('⚠️ i minuti non si perdono per strada', () => {
    expect(oraAdesso(new Date('2026-08-21T08:37:00+02:00'))).toBe(H(8, 37));
  });

  it('resta sempre dentro la giornata', () => {
    for (const iso of ['2026-03-29T01:30:00Z', '2026-10-25T01:30:00Z', '2026-12-31T23:30:00Z']) {
      const m = oraAdesso(new Date(iso));
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(MINUTI_AL_GIORNO);
    }
  });
});

describe('⚠️ come si legge il tempo che manca', () => {
  it.each([
    [135, '2h 15m'],
    [46, '46m'],
    [120, '2h'],
    [0, 'meno di un minuto'],
    [0.4, 'meno di un minuto'],
  ])('%s minuti si leggono «%s»', (minuti, atteso) => {
    expect(quantoManca(minuti as number)).toBe(atteso);
  });

  it('⚠️ niente «0h 46m»: le ore si scrivono solo se ci sono', () => {
    expect(quantoManca(46)).not.toContain('0h');
  });
});

describe('⚠️ il trascinamento va a passi di cinque minuti', () => {
  it.each([
    [H(12, 2), H(12)],
    [H(12, 3), H(12, 5)],
    [H(12, 37), H(12, 35)],
    [H(23, 59), 0],
  ])('%s si arrotonda a %s', (grezzo, atteso) => {
    expect(arrotondaAlPasso(grezzo as number)).toBe(atteso);
  });

  /**
   * ⚠️ Senza il passo, un dito su un telefono darebbe orari come 12:37 — che nessuno sceglierebbe
   * scrivendoli, e che poi si ritrova nel piatto per settimane.
   */
  it('⚠️ qualunque valore esce a passi di cinque', () => {
    for (let min = 0; min < MINUTI_AL_GIORNO; min += 1) {
      expect(arrotondaAlPasso(min) % 5).toBe(0);
    }
  });

  it('l\'ora si scrive con due cifre, sempre', () => {
    expect(oraDelGiorno(H(8, 5))).toBe('08:05');
    expect(oraDelGiorno(0)).toBe('00:00');
    expect(oraDelGiorno(H(23, 59))).toBe('23:59');
  });
});
