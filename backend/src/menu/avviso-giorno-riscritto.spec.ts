/**
 * ⛔ **IL TESTO DELL'AVVISO ALLA CLIENTE** — 8/9, la metà che mancava alla decisione «il
 * nutrizionista vince su tutto».
 *
 * ⚠️ Il testo si prova **senza finti**, perché la parte che conta è quella che una persona legge
 * sulla schermata di blocco dopo aver fatto la spesa. Gli invii si provano dalle due porte
 * (`menu-a-mano.service.spec.ts`, `vera-chat.service.spec.ts`): qui sta la regola, lì che parta.
 */
import {
  avvisaGiornoRiscritto,
  codaPerChiHaSalvato,
  laGiornataECambiata,
  testoGiornoRiscritto,
  testoGiorniRiscritti,
  avvisaGiorniRiscritti,
  TIPO_AVVISO_GIORNO_RISCRITTO,
  KIND_GIORNO_RISCRITTO,
} from './avviso-giorno-riscritto';
import type { PrismaService } from '../prisma/prisma.service';

describe('«Il menu di … è cambiato»', () => {
  /**
   * ⛔ **Il giorno si chiama come lo chiamerebbe una persona.** «Il menu del 09/09/2026 è cambiato»
   * è un numero di pratica: chi legge deve capire in un secondo se riguarda la cena di stasera o
   * una spesa da rifare.
   */
  it('⛔ dice QUALE giorno, con la parola che userebbe lei', () => {
    expect(testoGiornoRiscritto('2026-09-09', '2026-09-09').title).toBe('Il menu di oggi è cambiato');
    expect(testoGiornoRiscritto('2026-09-10', '2026-09-09').title).toBe('Il menu di domani è cambiato');
    expect(testoGiornoRiscritto('2026-09-11', '2026-09-09').title).toBe('Il menu di dopodomani è cambiato');
  });

  /** ⚠️ Dal terzo giorno in poi serve anche il numero: «giovedì» detto di martedì è ambiguo. */
  it('⚠️ più in là il nome del giorno porta la data', () => {
    expect(testoGiornoRiscritto('2026-09-12', '2026-09-09').title).toBe('Il menu di sabato 12 settembre è cambiato');
  });

  /**
   * ⛔ **IL CORPO NOMINA LA SPESA**, e non è cortesia: aprire la lista della spesa segna aperti
   * tutti e sette i giorni, quindi chi riceve questo avviso ha quasi sempre **già comprato**. La
   * lista si ricalcola a ogni lettura e si rimescola da sola — le voci del piatto tolto spariscono
   * con la loro spunta. Senza questa riga, quel rimescolamento non ha nessuna spiegazione.
   */
  it('⛔ dice cosa fare: ricontrollare la spesa', () => {
    const { body } = testoGiornoRiscritto('2026-09-10', '2026-09-09');
    expect(body).toContain('spesa');
    expect(body).toContain('ricontrolla la lista');
  });

  /**
   * ⛔ **NON dice chi l'ha riscritto.** La rotta la usano nutrizionista, capo nutrizionista e
   * admin: «la tua nutrizionista» sarebbe vero quasi sempre e falso qualche volta, e una notifica
   * che dice il falso su chi ha toccato il suo menu è peggio di una che non lo dice.
   */
  it('⛔ non attribuisce il cambiamento a nessuno', () => {
    const { title, body } = testoGiornoRiscritto('2026-09-10', '2026-09-09');
    expect(`${title} ${body}`).not.toMatch(/nutrizionista|coach|dottoressa/i);
  });

  /** ⚠️ E non colpevolizza né allarma: il fatto, la conseguenza, cosa guardare. */
  it('⚠️ resta un fatto, non un allarme', () => {
    const { body } = testoGiornoRiscritto('2026-09-10', '2026-09-09');
    expect(body).not.toMatch(/errore|sbagli|problema|attenzione!/i);
  });

  /**
   * ⛔ **Le due costanti sono un contratto con l'app**: `kind` è quello che `rottaClienteDaNotifica`
   * legge per aprire `/menu?giorno=…` invece del menu di oggi. Cambiarlo da una parte sola vuol dire
   * un tocco che porta nel posto sbagliato, senza nessun errore da nessuna parte.
   */
  it('⛔ il tipo e il kind sono quelli che l\'app si aspetta', () => {
    expect(TIPO_AVVISO_GIORNO_RISCRITTO).toBe('menu_giorno_riscritto');
    expect(KIND_GIORNO_RISCRITTO).toBe('menu_giorno_cambiato');
  });
});

/**
 * ⛔ **IL CABLAGGIO, non solo il testo** — la revisione avversariale dell'8/9 ha misurato che
 * sostituendo `giornoLocale` con `toISOString()` dentro `avvisaGiornoRiscritto` **317 prove
 * restavano verdi**: la spec provava l'etichetta passandole due stringhe, e saltava proprio il
 * punto in cui si decide qual è «oggi».
 */
describe('avvisaGiornoRiscritto — quello che parte davvero', () => {
  const finto = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', prefs: null }) },
      notification: { create, findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    return { prisma, push, create };
  };

  /**
   * ⛔ **«OGGI» È QUELLO DI ROMA, non quello del processo.** Fra mezzanotte e le due di notte i due
   * differiscono di un giorno intero, e la parola che cambia è **proprio quella** che dice alla
   * cliente se deve muoversi adesso: «oggi» invece di «domani». È il difetto per cui esiste
   * `date-only.ts`, e questa prova è la sola cosa che tiene la funzione agganciata a quel modulo.
   */
  it('⛔ a mezzanotte e mezza di Roma «oggi» è già il giorno dopo', async () => {
    const { prisma, push } = finto();
    await avvisaGiornoRiscritto(prisma, push, {
      clientId: 'c1',
      dataISO: '2026-09-10',
      // 00:30 del 10/9 a Roma = 22:30 del 9/9 in UTC
      adesso: new Date('2026-09-09T22:30:00.000Z'),
    });
    expect(push.sendToUser.mock.calls[0][1]).toBe('Il menu di oggi è cambiato');
  });

  /** ⛔ Un giorno già passato non si avvisa: non ci sarebbe niente da fare. */
  it('⛔ su un giorno passato non parte niente', async () => {
    const { prisma, push, create } = finto();
    const esito = await avvisaGiornoRiscritto(prisma, push, {
      clientId: 'c1', dataISO: '2026-09-07', adesso: new Date('2026-09-09T10:00:00.000Z'),
    });
    expect(esito).toBe('passato');
    expect(create).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  /** ⛔ E un avviso per quella giornata non ancora letto ne blocca un secondo. */
  it('⛔ non si suona due volte finché non l\'ha letta', async () => {
    const { prisma, push, create } = finto();
    (prisma as unknown as { notification: { findMany: jest.Mock } }).notification.findMany
      .mockResolvedValue([{ payload: { giorno: '2026-09-10' } }]);
    const esito = await avvisaGiornoRiscritto(prisma, push, {
      clientId: 'c1', dataISO: '2026-09-10', adesso: new Date('2026-09-09T10:00:00.000Z'),
    });
    expect(esito).toBe('gia_detto');
    expect(create).not.toHaveBeenCalled();
  });

  /** ⚠️ E la data viaggia nel payload: è quella che fa aprire QUEL giorno. */
  it('⚠️ il payload porta kind e giorno', async () => {
    const { prisma, push, create } = finto();
    await avvisaGiornoRiscritto(prisma, push, {
      clientId: 'c1', dataISO: '2026-09-10', adesso: new Date('2026-09-09T10:00:00.000Z'),
    });
    expect(create.mock.calls[0][0].data.payload).toMatchObject({ kind: KIND_GIORNO_RISCRITTO, giorno: '2026-09-10' });
  });
});

/**
 * ⛔ **LA CODA CHE LEGGE CHI HA SALVATO — l'8/9 era all'incontrario.**
 *
 * Diceva «valuta se avvisarla» esattamente quando l'avviso era **appena partito da solo** (la
 * cliente riceveva la notizia due volte), e taceva nel caso «non lo so», che è il solo in cui la
 * strada umana è l'unica che resta.
 */
describe('cosa si dice a chi ha appena salvato', () => {
  it('⛔ avvisata → si dice che è partito, e NON si chiede di scriverle', () => {
    const coda = codaPerChiHaSalvato('avvisata', false)!;
    expect(coda).toContain('l\'abbiamo avvisata');
    expect(coda).not.toContain('valuta se avvisarla');
  });

  it('⛔ non lo sappiamo → si dice che NESSUN avviso è partito, e di scriverle', () => {
    const coda = codaPerChiHaSalvato(null, true)!;
    expect(coda).toContain('non le è partito nessun');
    expect(coda).toContain('scrivile tu');
  });

  it('⚠️ già detto e giorno passato hanno una riga loro, non il silenzio', () => {
    expect(codaPerChiHaSalvato('gia_detto', false)).toContain('non gliene abbiamo mandato un altro');
    expect(codaPerChiHaSalvato('passato', false)).toContain('già passato');
  });

  /** ⚠️ E su una giornata che non aveva aperto non c'è niente da dire. */
  it('⚠️ niente da dire quando non c\'era niente da avvisare', () => {
    expect(codaPerChiHaSalvato(null, false)).toBeNull();
  });
});

/**
 * ⛔ **«È CAMBIATO» DEV'ESSERE VERO.** Riaprire una giornata, guardarla e risalvarla identica è un
 * gesto normale: un allarme falso costa più di uno mancato, perché il prossimo non lo apre.
 */
describe('quando la giornata non è cambiata davvero', () => {
  const g = [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }];

  it('⛔ stessi piatti negli stessi pasti = non è cambiata', () => {
    expect(laGiornataECambiata(g, [...g])).toBe(false);
  });

  /** ⚠️ E l'ordine non conta: la giornata è la stessa anche se le righe arrivano girate. */
  it('⚠️ l\'ordine delle righe non è un cambiamento', () => {
    expect(laGiornataECambiata(g, [g[1], g[0]])).toBe(false);
  });

  /** ⚠️ Il contorno invece no: kcal ricalcolate o il nome di chi salva non cambiano cosa cucina. */
  it('⚠️ kcal e nome di chi salva non sono un cambiamento', () => {
    expect(laGiornataECambiata(g, [{ ...g[0], kcal: 999, scrittoDa: 'Lucia' }, g[1]])).toBe(false);
  });

  it('⛔ un piatto diverso invece sì', () => {
    expect(laGiornataECambiata(g, [{ slot: 'lunch', recipeId: 'r9' }, g[1]])).toBe(true);
  });

  /** ⚠️ E una giornata che prima non c'era è un cambiamento, non un pareggio. */
  it('⚠️ da niente a qualcosa è un cambiamento', () => {
    expect(laGiornataECambiata(undefined, g)).toBe(true);
    expect(laGiornataECambiata(null, g)).toBe(true);
  });
});

/**
 * ⛔ **QUANDO I GIORNI SONO PIÙ D'UNO** — «Rigenera menu» e la rierogazione non riscrivono un
 * giorno, li riscrivono tutti quelli futuri.
 *
 * ⚠️ Queste prove sono nate da una revisione avversariale l'8/9: la prima stesura di quelle funzioni
 * **non aveva nessuna prova diretta**, mentre il fratello singolo ne aveva ventitré. Tre mutazioni
 * sopravvivevano — via il dedup, non scartare i giorni passati, e il titolo ridotto a «Qualcosa è
 * cambiato» — cioè tutto il testo che la cliente legge era scoperto.
 */
describe('l\'avviso quando i giorni riscritti sono più d\'uno', () => {
  it('⛔ dice DA QUANDO e QUANTE, non «qualcosa è cambiato»', () => {
    const { title, body } = testoGiorniRiscritti('2026-09-12', 3, '2026-09-09');
    expect(title).toBe('Il tuo menu è cambiato da sabato 12 settembre in poi');
    expect(body).toContain('3 giornate che avevi già aperto');
    expect(body).toContain('ricontrolla la lista');
  });

  /**
   * ⛔ **Con un giorno solo CHIAMA l'altra funzione**, non riscrive la stessa frase: erano due copie
   * identiche, e il giorno che si ritocca il singolare la porta multipla avrebbe continuato a dire
   * la frase vecchia senza dirlo a nessuno.
   */
  it('⛔ con un giorno solo è esattamente la frase del singolo', () => {
    expect(testoGiorniRiscritti('2026-09-10', 1, '2026-09-09'))
      .toEqual(testoGiornoRiscritto('2026-09-10', '2026-09-09'));
  });

  const finto = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', prefs: null }) },
      notification: { create, findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    return { prisma, push, create };
  };
  const ADESSO = new Date('2026-09-09T10:00:00.000Z');

  /** ⛔ Si nomina il PRIMO giorno, non quello che capita per primo nell'elenco. */
  it('⛔ nomina il primo giorno, comunque arrivino', async () => {
    const { prisma, push, create } = finto();
    await avvisaGiorniRiscritti(prisma, push, {
      clientId: 'c1', giorniISO: ['2026-09-14', '2026-09-11', '2026-09-12'], adesso: ADESSO,
    });
    expect(create.mock.calls[0][0].data.payload.giorno).toBe('2026-09-11');
    expect(create.mock.calls[0][0].data.payload.quanti).toBe(3);
  });

  /**
   * ⛔ **I giorni già passati si scartano.** «Ripartenza dal piano» cancella anche lo storico: dirle
   * di ricontrollare la spesa per un pranzo di due settimane fa è un allarme senza niente da fare.
   */
  it('⛔ i giorni passati non entrano nel conto, e da soli non fanno partire niente', async () => {
    const { prisma, push, create } = finto();
    await avvisaGiorniRiscritti(prisma, push, {
      clientId: 'c1', giorniISO: ['2026-09-01', '2026-09-11'], adesso: ADESSO,
    });
    expect(create.mock.calls[0][0].data.payload.quanti).toBe(1);

    const b = finto();
    expect(await avvisaGiorniRiscritti(b.prisma, b.push, {
      clientId: 'c1', giorniISO: ['2026-09-01', '2026-09-02'], adesso: ADESSO,
    })).toBe('passato');
    expect(b.create).not.toHaveBeenCalled();
  });

  /** ⛔ E un avviso per quello stesso primo giorno, non ancora letto, ne blocca un secondo. */
  it('⛔ non si suona due volte finché non l\'ha letta', async () => {
    const { prisma, push, create } = finto();
    (prisma as unknown as { notification: { findMany: jest.Mock } }).notification.findMany
      .mockResolvedValue([{ payload: { giorno: '2026-09-11' } }]);
    expect(await avvisaGiorniRiscritti(prisma, push, {
      clientId: 'c1', giorniISO: ['2026-09-11', '2026-09-12'], adesso: ADESSO,
    })).toBe('gia_detto');
    expect(create).not.toHaveBeenCalled();
  });

  /** ⚠️ Stesso tipo e stesso `kind` dell'avviso singolo: dedup, icona e rotta sono scritti una volta. */
  it('⚠️ tipo e kind sono quelli dell\'avviso singolo', async () => {
    const { prisma, push, create } = finto();
    await avvisaGiorniRiscritti(prisma, push, { clientId: 'c1', giorniISO: ['2026-09-11'], adesso: ADESSO });
    expect(create.mock.calls[0][0].data.type).toBe(TIPO_AVVISO_GIORNO_RISCRITTO);
    expect(create.mock.calls[0][0].data.payload.kind).toBe(KIND_GIORNO_RISCRITTO);
  });
});
