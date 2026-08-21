/**
 * LA VERIFICA DELLA NUTRIZIONISTA — i test.
 *
 * Il caso che conta di più è **il riferimento di unicità**, perché è quello che decide se
 * l'attività compare una volta o tutti i giorni. Con l'orario dentro, l'adattamento graduale — che
 * sposta la finestra di un'ora **ogni notte** — riaprirebbe la verifica a ogni passo, e in una
 * settimana la coach imparerebbe a saltare quella colonna. *Un avviso che compare sempre non è un
 * avviso.*
 */
import { decidiCambio } from '../menu/cambio-finestra';
import { motivoPerLaNutrizionista } from '../menu/chiedi-la-finestra';
import { derivaDaOrologio } from '../menu/orologio-digiuno';
import {
  GIORNI_PER_LA_VERIFICA,
  TIPO_DIGIUNO_ESTREMO,
  TIPO_FINESTRA_NON_TRADUCIBILE,
  riferimentoDigiunoEstremo,
  riferimentoNonTraducibile,
  scadenzaVerifica,
  testoDigiunoEstremo,
  testoFinestraNonTraducibile,
} from './verifica-digiuno';
import { TIPO_FINESTRA_MAI_CHIESTA } from './finestra-mai-chiesta';

describe('⛔ il riferimento: quante volte si chiede', () => {
  /**
   * ⛔ La proprietà che tiene in piedi tutto: **spostare l'orario non riapre la verifica**. Il
   * metodo A sposta la finestra un'ora per notte; se il riferimento contenesse l'orario, la coach
   * riceverebbe la stessa verifica ogni mattina per giorni.
   */
  it('⛔ traslare la finestra di un\'ora NON cambia il riferimento', () => {
    const alle12 = derivaDaOrologio(12 * 60, '16:8')!;
    const alle13 = derivaDaOrologio(13 * 60, '16:8')!;
    // Stessa durata, posizione diversa: i pasti sono gli stessi, e infatti la finestra pure.
    expect(alle12.fastingWindow).toBe(alle13.fastingWindow);
    expect(alle12.fastingWindow).toBeDefined();
    expect(riferimentoDigiunoEstremo('16:8', alle12.fastingWindow!))
      .toBe(riferimentoDigiunoEstremo('16:8', alle13.fastingWindow!));
  });

  it('⚠️ ma cambiare protocollo sì: è una scelta nuova, e va guardata di nuovo', () => {
    expect(riferimentoDigiunoEstremo('16:8', 'skip_breakfast'))
      .not.toBe(riferimentoDigiunoEstremo('20:4', 'skip_breakfast'));
  });

  it('⚠️ e cambiare i pasti anche, a parità di protocollo', () => {
    expect(riferimentoDigiunoEstremo('16:8', 'skip_breakfast'))
      .not.toBe(riferimentoDigiunoEstremo('16:8', 'skip_breakfast_and_snacks'));
  });

  /**
   * ⚠️ L'altra attività si segnala **una volta per finestra di partenza**, non a ogni ripensamento:
   * il fatto da raccontare è il passaggio da quella finestra lì, e succede una volta sola.
   */
  it('la finestra non traducibile si riferisce a quella di PARTENZA', () => {
    expect(riferimentoNonTraducibile('skip_dinner')).toBe('da:skip_dinner');
    expect(riferimentoNonTraducibile('skip_dinner')).not.toBe(riferimentoNonTraducibile('skip_lunch'));
  });

  /**
   * ⛔ I tre tipi di attività del digiuno devono essere **tre nomi diversi**: due che si chiamano
   * uguale condividerebbero la chiave `clientId + kind + refId`, e una zittirebbe l'altra.
   */
  it('⛔ i tipi non si sovrappongono fra loro né con «la domanda mai fatta»', () => {
    const tipi = [TIPO_DIGIUNO_ESTREMO, TIPO_FINESTRA_NON_TRADUCIBILE, TIPO_FINESTRA_MAI_CHIESTA];
    expect(new Set(tipi).size).toBe(3);
  });
});

describe('quello che legge la nutrizionista', () => {
  const ragioni = [
    'Ha scelto il 23:1 (OMAD): il manuale lo dà per chi ha già esperienza.',
    'Con questa finestra le resta un pasto solo al giorno.',
  ];

  it('dice il nome, cosa ha scelto, e tutte le ragioni', () => {
    const t = testoDigiunoEstremo('Sonia', ragioni, 'un digiuno 23:1 dalle 19:00');
    expect(t.title).toContain('Sonia');
    expect(t.description).toContain('23:1 dalle 19:00');
    for (const r of ragioni) expect(t.description).toContain(r);
  });

  /**
   * ⛔ **Dice che è già partita.** Senza questa riga «verifica il digiuno» si legge come un guasto, e
   * una nutrizionista che chiama allarmata una cliente che sta bene fa più danno del dato mancante.
   * È la lezione della voce 256, ripetuta qui perché è lo stesso tipo di messaggio.
   */
  it('⛔ dice che la cliente NON è bloccata e che i menu arrivano', () => {
    const t = testoDigiunoEstremo('Sonia', ragioni, 'un digiuno 23:1 dalle 19:00');
    expect(t.description).toMatch(/già partita/);
    expect(t.description).toMatch(/non la blocchiamo mai|non è un blocco/);
    expect(t.description).toMatch(/menu le arrivano/);
  });

  /**
   * ⛔ **E NON DÀ UN'ISTRUZIONE CHE IL SISTEMA DISFA** (corretto in revisione, 21/8).
   *
   * Tutti e due i testi dicevano «la finestra si corregge dalla scheda (Modifica → Pasti che
   * salta)». Ma `fastingWindow` la **deriva** l'orologio: il primo spostamento della cliente
   * riscrive la correzione della nutrizionista, e nessuno la avvisa — il riferimento dell'attività
   * non cambia per una traslazione, quindi non ne rinasce nemmeno una nuova. Mandarla a correggere
   * un dato che il sistema riscrive è farle perdere tempo e fiducia insieme.
   */
  it('⛔ dice cosa fare, e NON manda a correggere dalla scheda', () => {
    for (const t of [
      testoDigiunoEstremo('Sonia', ragioni, 'un digiuno 23:1 dalle 19:00'),
      testoFinestraNonTraducibile('Sonia', motivoPerLaNutrizionista('skip_dinner', '16:8 dalle 08:00')),
    ]) {
      expect(t.description).toContain('segna l\'attività fatta');
      // ⛔ La correzione la fa la cliente dall'orologio: è l'unico posto che regge.
      expect(t.description).toMatch(/orologio/);
      expect(t.description).not.toMatch(/si corregge dalla scheda|la finestra si corregge/);
    }
  });

  it('senza nome non scrive un buco: «la cliente»', () => {
    expect(testoDigiunoEstremo(null, ragioni, 'x').title).toContain('la cliente');
    expect(testoDigiunoEstremo('   ', ragioni, 'x').title).toContain('la cliente');
    expect(testoFinestraNonTraducibile(undefined, 'motivo').title).toContain('la cliente');
  });

  /**
   * ⚠️ Nessun identificativo interno: chi legge è una persona, e `skip_dinner` non è un pasto.
   * ⛔ Vale anche per il testo della finestra non traducibile, che **incornicia** un motivo scritto
   * altrove: se quella traduzione si rompesse, il codice uscirebbe da qui.
   */
  it('⚠️ nessun codice interno in nessuno dei due testi', () => {
    const testi = [
      testoDigiunoEstremo('Sonia', ragioni, 'un digiuno 23:1 dalle 19:00'),
      testoFinestraNonTraducibile('Sonia', motivoPerLaNutrizionista('skip_dinner', '16:8 dalle 08:00')),
    ];
    for (const t of testi) {
      for (const s of [t.title, t.description]) {
        expect(s).not.toMatch(/skip_|fasting[A-Z]|undefined|null|\[object/);
      }
    }
  });

  /**
   * ⚠️ Il motivo NON si riscrive qui: si incornicia quello che ha calcolato
   * `chiedi-la-finestra.ts`. Due punti che compongono lo stesso messaggio finiscono per dire due
   * cose diverse — è la regola che questo progetto paga più spesso.
   */
  it('il motivo arriva intero, non riassunto', () => {
    const motivo = motivoPerLaNutrizionista('skip_dinner', '16:8 dalle 08:00');
    expect(testoFinestraNonTraducibile('Sonia', motivo).description).toContain(motivo);
  });
});

describe('le ragioni arrivano da chi decide il cambio, non da qui', () => {
  /**
   * ⛔ Il collegamento vero: `decidiCambio` calcola le ragioni e le mette nell'esito, e da lì
   * finiscono nel testo **senza passare da nessuna decisione ripetuta**. Se un giorno le due parti
   * divergessero, questo test lo direbbe.
   */
  it('⛔ una scelta OMAD produce ragioni, e quelle ragioni finiscono nel testo', () => {
    const e = decidiCambio(
      { protocollo: '16:8', inizioMin: 12 * 60, cambiataIl: null },
      { protocollo: '23:1', inizioMin: 19 * 60 },
      { adesso: new Date('2026-08-21T07:00:00Z'), oraMin: 9 * 60 },
    );
    expect(e.permesso).toBe(true);
    expect(e.daVerificare.length).toBe(2); // protocollo estremo + un pasto solo
    const t = testoDigiunoEstremo('Sonia', e.daVerificare, 'un digiuno 23:1 dalle 19:00');
    for (const r of e.daVerificare) expect(t.description).toContain(r);
  });

  it('⚠️ e una scelta normale non produce niente da verificare', () => {
    const e = decidiCambio(
      { protocollo: '16:8', inizioMin: 12 * 60, cambiataIl: null },
      { inizioMin: 13 * 60 },
      { adesso: new Date('2026-08-21T07:00:00Z'), oraMin: 9 * 60 },
    );
    expect(e.daVerificare).toEqual([]);
  });
});

describe('la scadenza', () => {
  it('è corta: è una verifica su una cosa che sta già succedendo', () => {
    expect(GIORNI_PER_LA_VERIFICA).toBeLessThanOrEqual(3);
    const adesso = new Date('2026-08-21T09:00:00Z');
    expect(scadenzaVerifica(adesso).getTime() - adesso.getTime())
      .toBe(GIORNI_PER_LA_VERIFICA * 24 * 3_600_000);
  });
});
