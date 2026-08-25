/**
 * ⛔ **I TREDICI PUNTI CHE SI CALCOLAVANO IL GIORNO A MANO — provati per quello che FANNO.**
 *
 * `il-giorno-si-chiede.spec.ts` legge il **sorgente**: dice che la formula vietata non c'è più. È
 * necessario — è quello che impedisce alla riga di tornare — ma non basta, perché non dice mai
 * **cosa cambia per una persona**. Questo file lo dice: ferma l'orologio nell'ora in cui il difetto
 * si vedeva e guarda il risultato.
 *
 * ⚠️ **Le due ore.** Su Render `TZ` non è impostata, quindi il processo sta a UTC. Fra la mezzanotte
 * e le 02:00 italiane (l'01:00 d'inverno) il giorno UTC è **ancora ieri**: tutti i punti che si
 * costruivano «oggi» da soli rispondevano ieri, e sbagliavano **insieme** — che è il motivo per cui
 * nessun confronto fra due di loro poteva rivelarlo.
 *
 * ⚠️ **E i test girano due volte**, con `TZ` a UTC e con `TZ=Europe/Rome` (`npm run test:notte`):
 * cinque dei tredici punti sbagliavano **solo** sul portatile di chi sviluppa. Un test che è vero
 * solo a Greenwich non è un test: è una trappola per chi lo esegue da casa.
 */
import { Test } from '@nestjs/testing';
import { conOrologioFermo } from '../../test/orologio-fermo';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  aGiorno,
  giornoLocale,
  giornoPiu,
  inizioDiOggi,
  istantePiuGiorni,
  meseDopo,
  oggiPiu,
  toDateOnly,
} from './date-only';
import { validaDataInizio } from '../commerce/piano-prova';
import { AgendaController } from '../agenda/agenda.controller';
import { AgendaService } from '../agenda/agenda.service';
import { MENU_GIORNI_AVANTI, MENU_GIORNI_INDIETRO, finestraMenu } from '../clients/finestra-menu';
import { eGiornoDiConforto } from '../menu/plateau';
import { etichettaMese, meseBreve } from '../analytics/analytics.service';
import { confineMese, confineMeseGiorni, meseLocale, meseSpostato } from './date-only';

/** Le 00:30 del 26 agosto a Roma. Per UTC sono ancora le 22:30 del **25**. */
const MEZZANOTTE_E_MEZZA = new Date('2026-08-25T22:30:00.000Z');

/**
 * La notte in cui le lancette vanno **avanti**: il 28 marzo 2027 a Roma dura 23 ore. È il giorno in
 * cui `setDate` e la somma in millisecondi danno risposte diverse.
 */
const NOTTE_DEL_CAMBIO = new Date('2027-03-27T23:30:00.000Z'); // 00:30 del 28 a Roma

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('⛔ oggiPiu: «oggi» è il giorno di Roma, e la somma è in millisecondi', () => {
  describe('alle 00:30 italiane', () => {
    conOrologioFermo(MEZZANOTTE_E_MEZZA);

    it('⛔ oggi è il 26, non il 25 (con `setHours(0,0,0,0)` su Render era il 25)', () => {
      expect(oggiPiu(0).toISOString()).toBe('2026-08-26T00:00:00.000Z');
    });

    it('⛔ e «fra 30 giorni» sono trenta giorni dopo QUELLO, non ventinove', () => {
      const giorniDiScarto = (oggiPiu(30).getTime() - oggiPiu(0).getTime()) / 86_400_000;
      expect(giorniDiScarto).toBe(30);
      expect(iso(oggiPiu(30))).toBe('2026-09-25');
    });

    /**
     * ⚠️ **Per un numero INTERO di giorni**, che è l'unica cosa che i chiamanti passano. `oggiPiu(1.5)`
     * renderebbe mezzogiorno, e non è un caso da difendere con un arrotondamento silenzioso: chi
     * scrivesse mezzo giorno starebbe facendo un'altra domanda, e deve vederselo.
     */
    it('per ogni numero intero di giorni rende una mezzanotte UTC esatta', () => {
      for (const n of [-365, -30, -1, 0, 1, 30, 365]) {
        expect(oggiPiu(n).getTime() % 86_400_000).toBe(0);
      }
    });
  });

  /**
   * ⚠️ **A OGNI ORA DEL GIORNO, non solo a quella in cui il difetto si vedeva.** Un test che guarda
   * solo le 00:30 dimostra che il caso noto è chiuso; questo dimostra che non se n'è aperto un
   * altro alle 23:00, che è l'altra estremità dello stesso confine.
   */
  it('⚠️ a ogni ora del 26 agosto, «oggi» è il 26 per chi sta a Roma', () => {
    for (let ora = 0; ora < 24; ora++) {
      const istante = new Date(Date.UTC(2026, 7, 26, ora, 15));
      expect(iso(oggiPiu(0, istante))).toBe(giornoLocale(istante));
    }
  });

  describe('⚠️ e nella notte in cui le lancette vanno avanti (28/3/2027, giorno da 23 ore)', () => {
    conOrologioFermo(NOTTE_DEL_CAMBIO);

    it('⛔ domani è il 29 (con `setDate` su un portatile italiano restava il 28)', () => {
      expect(iso(oggiPiu(0))).toBe('2027-03-28');
      expect(iso(oggiPiu(1))).toBe('2027-03-29');
    });
  });
});

describe('⛔ giornoPiu: il giorno di una data SALVATA, più N — e resta in UTC', () => {
  /**
   * ⛔ È il caso di `agenda.service.orariLiberi` e di `creaFerie`: `2027-03-28T00:00:00Z` più un
   * giorno. `setDate` conserva l'ora di **parete**, e con `TZ=Europe/Rome` quel giorno ne ha 23:
   * rendeva ancora il 28, cioè accorciava la finestra di un giorno.
   */
  it('⛔ 28/3/2027 + 1 giorno è il 29, in qualunque fuso giri il processo', () => {
    expect(giornoPiu(new Date('2027-03-28T00:00:00.000Z'), 1).toISOString())
      .toBe('2027-03-29T00:00:00.000Z');
  });

  it('normalizza prima di sommare: l’ora dentro la data salvata non sposta il conto', () => {
    expect(giornoPiu(new Date('2026-08-25T18:45:00.000Z'), 3).toISOString())
      .toBe('2026-08-28T00:00:00.000Z');
  });

  it('⚠️ e va indietro, che è la finestra dei rientri di `pause.service`', () => {
    expect(iso(giornoPiu(new Date('2026-08-25T00:00:00.000Z'), -3))).toBe('2026-08-22');
  });

  /**
   * ⚠️ **La differenza fra le due domande, scritta come test.** Alle 00:30 di Roma `oggiPiu(0)` e
   * `giornoPiu(adesso, 0)` danno due giorni **diversi**, ed è voluto: il primo chiede «che giorno è
   * oggi» (Roma), il secondo «di che giorno è questo istante salvato» (UTC). Se un giorno
   * qualcuno le unificasse per simmetria, questo test lo ferma.
   */
  it('⚠️ NON è la stessa funzione di oggiPiu, e alle 00:30 si vede', () => {
    expect(iso(oggiPiu(0, MEZZANOTTE_E_MEZZA))).toBe('2026-08-26');
    expect(iso(giornoPiu(MEZZANOTTE_E_MEZZA, 0))).toBe('2026-08-25');
  });
});

describe('⚠️ istantePiuGiorni: una scadenza più N giorni, e l’ora resta quella', () => {
  it('non normalizza niente: 10 giorni regalati a una scadenza delle 18:45 finiscono alle 18:45', () => {
    expect(istantePiuGiorni(new Date('2026-08-25T18:45:00.000Z'), 10).toISOString())
      .toBe('2026-09-04T18:45:00.000Z');
  });

  /**
   * ⛔ Il caso di `referral`: dieci giorni regalati attraversando il cambio d'ora. Con `setDate`
   * l'istante si sposta di un'ora (l'ora di parete resta, l'offset cambia); in millisecondi no.
   */
  it('⛔ dieci giorni sono dieci volte 24 ore, anche attraverso il cambio d’ora', () => {
    const fine = istantePiuGiorni(new Date('2027-03-25T10:00:00.000Z'), 10);
    expect(fine.toISOString()).toBe('2027-04-04T10:00:00.000Z');
  });
});

describe('⛔ la data di inizio scelta dalla cliente (`validaDataInizio`)', () => {
  describe('alle 00:30 italiane del 26 agosto', () => {
    conOrologioFermo(MEZZANOTTE_E_MEZZA);

    /**
     * ⛔ **Il difetto vero, quello che il censimento del 24/8 ha misurato.** Il «primo giorno
     * accettabile» era il giorno **UTC**, cioè ieri: a quell'ora una cliente poteva scegliere una
     * partenza **già passata** e il controllo non scattava.
     */
    it('⛔ il 25 è passato e si rifiuta (prima veniva accettato)', () => {
      expect(validaDataInizio('2026-08-25')).toEqual({ ok: false, motivo: 'passato' });
    });

    it('⛔ il 26 è OGGI e si accetta: chi vuole partire subito parte subito', () => {
      const e = validaDataInizio('2026-08-26');
      expect(e.ok && e.data.toISOString()).toBe('2026-08-26T00:00:00.000Z');
    });

    it('⚠️ e il limite dei dodici mesi si conta dallo stesso giorno', () => {
      expect(validaDataInizio('2027-08-26').ok).toBe(true);
      expect(validaDataInizio('2027-08-27')).toEqual({ ok: false, motivo: 'troppo_lontana' });
    });
  });

  /** ⚠️ Quello che non deve cambiare: una data illeggibile resta illeggibile, non diventa oggi. */
  it('⚠️ una data illeggibile non diventa un giorno', () => {
    expect(validaDataInizio('domani', MEZZANOTTE_E_MEZZA)).toEqual({ ok: false, motivo: 'illeggibile' });
    expect(validaDataInizio('2026-02-30T99:00', MEZZANOTTE_E_MEZZA).ok).toBe(false);
  });

  it('⚠️ e un `Date` in mano si legge come istante, quindi nel fuso di Roma', () => {
    const e = validaDataInizio(new Date('2026-08-31T22:10:00.000Z'), MEZZANOTTE_E_MEZZA);
    expect(e.ok && e.data.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('⛔ l’anteprima degli orari liberi: trenta giorni, contati da oggi', () => {
  /**
   * ⛔ **Il difetto era l'estremo DESTRO: 29 giorni invece di 30.** Erano
   * `new Date().toISOString().slice(0, 10)` (il giorno **UTC**) e un `setDate(+30)` sull'istante:
   * due definizioni di giorno per i due estremi della stessa finestra. Alle 00:30 italiane il
   * sinistro cadeva su ieri e il destro partiva da lì, quindi **l'ultimo giorno prenotabile non
   * compariva**.
   *
   * ⚠️ **E il sinistro non arrivava a fare danno**, che è la parte che una prima stesura di questo
   * commento aveva scritto a memoria: `agenda.service.orariLiberi` risale un `dal` passato all'oggi
   * di Roma (`dalIso < oggi ? oggi : dalIso`). Qui il servizio è finto e non risale niente — quindi
   * questo test guarda **cosa manda il controller**, che è la cosa che si può guardare da qui: che
   * i due estremi vengano dalla stessa definizione di giorno e siano larghi trenta.
   */
  conOrologioFermo(MEZZANOTTE_E_MEZZA);

  let visti: { dal: string; al: string } | null = null;

  const controller = async () => {
    visti = null;
    const modulo = await Test.createTestingModule({
      controllers: [AgendaController],
      providers: [
        {
          provide: AgendaService,
          useValue: {
            mieiOrariLiberi: (_id: string, dal: string, al: string) => {
              visti = { dal, al };
              return [];
            },
          },
        },
      ],
    })
      .overrideGuard(class {} as never)
      .useValue({ canActivate: () => true })
      .compile();
    return modulo.get(AgendaController);
  };

  it('⚠️ manda l’oggi di Roma (il 26), non il giorno UTC (il 25)', async () => {
    const c = await controller();
    c.liberi({ sub: 'n1' } as never);
    expect(visti!.dal).toBe('2026-08-26');
  });

  it('⛔ e arriva a trenta giorni dopo, non a ventinove', async () => {
    const c = await controller();
    c.liberi({ sub: 'n1' } as never);
    const giorni =
      (Date.parse(`${visti!.al}T00:00:00Z`) - Date.parse(`${visti!.dal}T00:00:00Z`)) / 86_400_000;
    expect(giorni).toBe(30);
  });

  it('⚠️ e se gli estremi arrivano dalla chiamata restano quelli: qui non si indovina', async () => {
    const c = await controller();
    c.liberi({ sub: 'n1' } as never, '2026-09-01', '2026-09-05');
    expect(visti).toEqual({ dal: '2026-09-01', al: '2026-09-05' });
  });
});

/**
 * ⛔ **E LA REGOLA DELLA DATA SECCA, PROVATA DOVE SI VEDE: a ovest di Greenwich.**
 *
 * `2026-09-01` non contiene un orario, quindi `toDateOnly` la prende **alla lettera**. Con
 * `APP_TIMEZONE` su Roma la differenza fra «alla lettera» e «convertita» non si vede — `new
 * Date('2026-09-01')` è mezzanotte UTC, e a Roma è ancora l'1. Si vede solo con un fuso **a ovest**,
 * dove quella stessa mezzanotte è il **31 agosto**: convertirla sposterebbe la partenza di un giorno
 * indietro, cioè nel passato, e la cliente si sentirebbe rispondere «quel giorno è già passato» su
 * una data che ha appena scelto dal calendario.
 *
 * ⚠️ Il fuso si legge all'**import** (`FUSO = process.env.APP_TIMEZONE || 'Europe/Rome'`), quindi si
 * ricarica il modulo dentro `isolateModules`: è l'unico modo di provare un fuso diverso senza
 * lanciare tutta la suite un'altra volta.
 */
describe('⛔ una data senza orario vale alla lettera, anche con il fuso a ovest', () => {
  /**
   * ⚠️ **`finally`, e non due righe dopo la chiamata**: se un `expect` dentro il callback fallisce,
   * senza `finally` `APP_TIMEZONE` resterebbe su New York per tutto il resto del file, e i test dopo
   * fallirebbero per una ragione che non è la loro. Un fallimento deve restare uno.
   */
  const conFuso = <T,>(fuso: string, quello: (m: typeof import('./date-only')) => T): T => {
    const prima = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = fuso;
    try {
      let esito!: T;
      jest.isolateModules(() => {
        esito = quello(require('./date-only') as typeof import('./date-only'));
      });
      return esito;
    } finally {
      if (prima === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = prima;
    }
  };

  it('⚠️ il finto fuso funziona davvero: a New York «adesso» è un giorno diverso che a Roma', () => {
    const istante = new Date('2026-08-26T02:30:00.000Z'); // le 22:30 del 25 a New York
    expect(conFuso('America/New_York', (m) => m.giornoLocale(istante))).toBe('2026-08-25');
    expect(conFuso('Europe/Rome', (m) => m.giornoLocale(istante))).toBe('2026-08-26');
  });

  it('⛔ e nonostante quello, `2026-09-01` resta il 1 settembre', () => {
    expect(conFuso('America/New_York', (m) => m.toDateOnly('2026-09-01').toISOString()))
      .toBe('2026-09-01T00:00:00.000Z');
  });

  it('⛔ quindi la data scelta dal calendario non scivola al giorno prima', () => {
    const scelto = conFuso('America/New_York', (m) => {
      // Il modulo va ricaricato **anche** per `piano-prova`, che importa `date-only`: altrimenti
      // userebbe la copia già caricata col fuso di Roma e il test non proverebbe niente.
      const { validaDataInizio: valida } = require('../commerce/piano-prova') as typeof import('../commerce/piano-prova');
      void m;
      return valida('2026-09-01', new Date('2026-08-26T02:30:00.000Z'));
    });
    expect(scelto.ok && scelto.data.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

/**
 * ⚠️ **E la rete sotto la rete**: che `toDateOnly()` e `aGiorno(new Date())` — le due porte da cui
 * passa «oggi» in tutto il resto del progetto — rispondano la stessa cosa di `oggiPiu(0)`. Sono tre
 * nomi per la stessa domanda: il giorno in cui divergessero, il difetto tornerebbe senza che
 * nessuna delle formule vietate ricompaia nel sorgente.
 */
describe('⚠️ le tre porte di «oggi» rispondono insieme', () => {
  conOrologioFermo(MEZZANOTTE_E_MEZZA);

  it('toDateOnly(), aGiorno(new Date()) e oggiPiu(0) sono lo stesso istante', () => {
    const atteso = '2026-08-26T00:00:00.000Z';
    expect(toDateOnly().toISOString()).toBe(atteso);
    expect(aGiorno(new Date()).toISOString()).toBe(atteso);
    expect(oggiPiu(0).toISOString()).toBe(atteso);
  });
});

/**
 * ⛔ **IL NOME DEL MESE ACCANTO AI NUMERI DEL MESE** — la trappola nata *dalla* correzione, 25/8.
 *
 * Portando i confini dell'analitica su `confineMese` (il mese di **Roma**), l'inizio di settembre è
 * diventato il **31 agosto alle 22:00 UTC**. La riga che scriveva l'etichetta faceva
 * `MONTH_LABELS[inizio.getMonth()]` su quel `Date`: su un processo a UTC avrebbe risposto **agosto**
 * — cioè la tendina avrebbe scritto il nome del mese sbagliato accanto ai numeri giusti, che è
 * peggio di un numero sbagliato perché sembra corretto.
 *
 * ⚠️ Adesso l'etichetta viene dalla chiave `AAAA-MM`, che è già la risposta.
 */
describe('⛔ la tendina dei mesi dell’analitica', () => {
  it('⛔ settembre si chiama settembre, anche se comincia il 31 agosto alle 22:00 UTC', () => {
    expect(confineMese('2026-09').gte.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(etichettaMese('2026-09')).toBe('set 2026');
  });

  /**
   * ⚠️ **E la serie dei sei mesi dei grafici usa lo stesso nome.** Erano due righe che rispondevano
   * alla stessa domanda in due posti (`MONTH_LABELS[…]` copiato): adesso una chiama l'altra, così un
   * test solo le tiene tutte e due.
   */
  it('⚠️ l’etichetta lunga è quella breve più l’anno: una riga sola per due tendine', () => {
    for (const chiave of ['2026-01', '2026-09', '2026-12']) {
      expect(etichettaMese(chiave)).toBe(`${meseBreve(chiave)} ${chiave.slice(0, 4)}`);
    }
    expect(meseBreve('2026-09')).toBe('set');
  });

  it('⚠️ e per tutti i dodici mesi il nome combacia con la chiave', () => {
    const nomi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    for (let m = 1; m <= 12; m++) {
      const chiave = `2027-${String(m).padStart(2, '0')}`;
      expect(etichettaMese(chiave)).toBe(`${nomi[m - 1]} 2027`);
    }
  });

  /**
   * ⚠️ **E i dodici periodi della tendina non hanno buchi né doppioni**: `meseSpostato` è
   * l'aritmetica che li genera, e dicembre→gennaio è il punto in cui una sottrazione scritta a mano
   * sbaglia.
   */
  it('⚠️ dodici mesi consecutivi all’indietro, dicembre compreso', () => {
    const chiavi = Array.from({ length: 12 }, (_, i) => meseSpostato('2027-02', -i));
    expect(chiavi[0]).toBe('2027-02');
    expect(chiavi[2]).toBe('2026-12');
    expect(chiavi[11]).toBe('2026-03');
    expect(new Set(chiavi).size).toBe(12);
    // Ogni finestra comincia dove finisce la precedente: nessun giorno fuori da tutti i mesi.
    for (let i = 0; i < 11; i++) {
      expect(confineMese(chiavi[i]).gte.toISOString()).toBe(confineMese(chiavi[i + 1]).lt.toISOString());
    }
  });

  it('⚠️ e il mese di «adesso» alle 00:30 del 1 settembre è settembre, non agosto', () => {
    expect(meseLocale(new Date('2026-08-31T22:30:00.000Z'))).toBe('2026-09');
  });
});

/**
 * ⛔ **DUE CONFINI DI MESE, PERCHÉ CI SONO DUE TIPI DI COLONNA** — trovato in revisione, 25/8.
 *
 * `confineMese` rende **istanti** (il momento in cui il mese comincia a Roma) e vale per
 * `Payment.createdAt` e `User.createdAt`. `Measurement.date` invece è una colonna `@db.Date`:
 * valori-giorno, mezzanotte UTC esatta. Confrontare gli uni con gli altri funziona **per caso**
 * finché il fuso dell'azienda sta a est di Greenwich.
 */
describe('⛔ i due confini di mese non sono lo stesso confine', () => {
  it('⚠️ per gli istanti settembre comincia il 31 agosto alle 22:00 UTC…', () => {
    expect(confineMese('2026-09').gte.toISOString()).toBe('2026-08-31T22:00:00.000Z');
  });

  it('⛔ …ma per una colonna DATE comincia il 1 settembre a mezzanotte UTC', () => {
    expect(confineMeseGiorni('2026-09').gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(confineMeseGiorni('2026-09').lt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('⚠️ dicembre passa all’anno dopo', () => {
    expect(confineMeseGiorni('2026-12').lt.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  /**
   * ⛔ **La misura del primo del mese sta nel mese giusto** — che è la cosa che con i confini a
   * istanti smetterebbe di essere vera con `APP_TIMEZONE` a ovest di Greenwich.
   */
  it('⛔ una misura del 1 settembre appartiene a settembre, non ad agosto', () => {
    const misura = new Date('2026-09-01T00:00:00.000Z'); // com'è salvata in colonna DATE
    const set = confineMeseGiorni('2026-09');
    const ago = confineMeseGiorni('2026-08');
    expect(misura >= set.gte && misura < set.lt).toBe(true);
    expect(misura >= ago.gte && misura < ago.lt).toBe(false);
  });

  it('⚠️ e i mesi consecutivi si toccano senza buchi né sovrapposizioni', () => {
    expect(confineMeseGiorni('2026-08').lt.toISOString()).toBe(confineMeseGiorni('2026-09').gte.toISOString());
  });
});

/**
 * ⛔ **«PIÙ UN MESE» — una definizione sola, e il 31 gennaio è il caso che la decide.**
 *
 * `commerce.service` (il ripiego del rinnovo) e `reports/plan-report` rispondevano alla stessa
 * domanda in due modi: il primo con `setMonth` secco — **31/1 → 3 marzo** — il secondo clampando
 * all'ultimo giorno del mese, come dichiarava nel suo commento. Sono soldi tutti e due, e il primo
 * regalava due o tre giorni **a ogni rinnovo**, perché la scadenza nuova è la base di quella dopo.
 */
describe('⛔ meseDopo: il 31 gennaio più un mese è il 28 febbraio', () => {
  const g = (iso: string, n = 1) => meseDopo(new Date(iso), n).toISOString().slice(0, 10);

  it('⛔ 31/1 + 1 mese → 28/2 (con `setMonth` secco era il 3 marzo)', () => {
    expect(g('2026-01-31T00:00:00.000Z')).toBe('2026-02-28');
  });

  it('⛔ 31/8 + 1 mese → 30/9 (era il 1 ottobre)', () => {
    expect(g('2026-08-31T00:00:00.000Z')).toBe('2026-09-30');
  });

  it('⚠️ e negli anni bisestili il 29 febbraio c’è: 31/1/2028 → 29/2/2028', () => {
    expect(g('2028-01-31T00:00:00.000Z')).toBe('2028-02-29');
    expect(g('2027-02-28T00:00:00.000Z', 12)).toBe('2028-02-28');
    expect(g('2028-02-29T00:00:00.000Z', 12)).toBe('2029-02-28');
  });

  it('⚠️ dicembre passa all’anno dopo, e il giorno non si sposta', () => {
    expect(g('2026-12-31T00:00:00.000Z')).toBe('2027-01-31');
  });

  /**
   * ⛔ **E la scadenza resta all'ora in cui era.** È un istante, non un giorno: normalizzarlo qui
   * anticiperebbe la fine dell'abbonamento di ore, che è la stessa confusione giorno/istante
   * dichiarata in cima a `date-only.ts`.
   */
  it('⛔ l’ora dentro una scadenza non si tocca', () => {
    expect(meseDopo(new Date('2026-01-31T18:45:30.000Z')).toISOString())
      .toBe('2026-02-28T18:45:30.000Z');
  });

  /**
   * ⚠️ **Ripetuto dodici volte non deriva.** È il caso vero: la scadenza nuova diventa la base della
   * prossima, e un `+1 mese` che trabocca sposta il giorno di rinnovo un po' più avanti ogni volta.
   */
  it('⚠️ dodici rinnovi di fila da un 31 restano ancorati al 31 (o all’ultimo giorno)', () => {
    let d = new Date('2026-01-31T00:00:00.000Z');
    const giorni: number[] = [];
    for (let i = 0; i < 12; i++) {
      d = meseDopo(d);
      giorni.push(d.getUTCDate());
    }
    // Febbraio si accorcia a 28 e da lì in poi resta 28: è il prezzo del clamp, ed è quello giusto —
    // l'alternativa è una data che scivola in avanti per sempre.
    expect(giorni.slice(0, 2)).toEqual([28, 28]);
    expect(giorni.every((x) => x <= 31)).toBe(true);
    expect(d.toISOString().slice(0, 10)).toBe('2027-01-28');
  });
});

/**
 * ⛔ **LA FINESTRA DEI MENU DELLA COACH: 56 giorni, non 55, e non dipende dall'ora in cui apre.**
 *
 * Era `new Date(adesso)` più `setDate(±N)`, quindi il risultato conservava **l'ora corrente** e
 * veniva confrontato con `MenuDay.date`, che è una colonna `DATE` (sempre mezzanotte UTC). Alle
 * 09:00 il giorno più vecchio cadeva prima dell'estremo e spariva; alle 00:10 c'era. Trovato il 25/8
 * in revisione, fuori dal censimento.
 */
describe('⛔ la finestra dei menu non cambia con l’ora in cui la si apre', () => {
  const larghezza = (adesso: string) => {
    const { from, to } = finestraMenu(undefined, new Date(adesso));
    return {
      giorni: (to.getTime() - from.getTime()) / 86_400_000,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  };

  it('⛔ alle 09:00 e alle 00:10 la finestra è la stessa', () => {
    expect(larghezza('2026-08-26T09:00:00.000Z')).toEqual(larghezza('2026-08-26T00:10:00.000Z'));
  });

  it('⛔ ed è larga MENU_GIORNI_INDIETRO + MENU_GIORNI_AVANTI, con gli estremi a mezzanotte', () => {
    const w = larghezza('2026-08-26T09:00:00.000Z');
    expect(w.giorni).toBe(MENU_GIORNI_INDIETRO + MENU_GIORNI_AVANTI);
    expect(w.from).toBe('2026-07-01T00:00:00.000Z'); // 26 agosto meno 56 giorni
    expect(w.to).toBe('2026-09-02T00:00:00.000Z');
  });

  it('⚠️ e alle 00:30 italiane il giorno di riferimento è quello di Roma', () => {
    // 22:30Z del 25 = 00:30 del 26 a Roma → «oggi» è il 26, quindi `to` è il 2 settembre.
    expect(larghezza('2026-08-25T22:30:00.000Z').to).toBe('2026-09-02T00:00:00.000Z');
  });
});

/**
 * ⚠️ **IL GIORNO DI CONFORTO** (`menu/plateau.ts`): una cliente in plateau riceve i piatti che ama
 * **di domenica**, e glielo si dice a voce. `getDay()` su un valore-giorno legge il fuso del
 * processo: giusto a est di Greenwich, sbagliato di un giorno a ovest. Latente, ma è una promessa
 * fatta a una persona.
 */
describe('⚠️ il giorno di conforto è domenica, in qualunque fuso', () => {
  it('la domenica sì, il sabato e il lunedì no', () => {
    expect(eGiornoDiConforto(new Date('2026-08-30T00:00:00.000Z'))).toBe(true); // domenica
    expect(eGiornoDiConforto(new Date('2026-08-29T00:00:00.000Z'))).toBe(false);
    expect(eGiornoDiConforto(new Date('2026-08-31T00:00:00.000Z'))).toBe(false);
  });

  it('⚠️ e su sette giorni di fila ne prende esattamente uno', () => {
    const base = Date.parse('2026-08-24T00:00:00.000Z');
    const presi = Array.from({ length: 7 }, (_, i) => new Date(base + i * 86_400_000))
      .filter(eGiornoDiConforto);
    expect(presi).toHaveLength(1);
    expect(presi[0].toISOString().slice(0, 10)).toBe('2026-08-30');
  });
});

/**
 * ⛔ **UN GIORNO NON È UN ISTANTE, E IL CALENDARIO DELLA COACH LO DIMOSTRA.**
 *
 * `coach.service` chiede gli appuntamenti «da oggi in poi» a `vociCalendario`, che filtra
 * `Visit.datetime` e `Appointment.datetime`: **timestamp veri**, l'ora a cui una persona si presenta.
 * Prima era `setHours(0,0,0,0)` (UTC su Render): alle 00:30 italiane il calendario cominciava da
 * ieri. ⛔ La prima correzione del 25/8 metteva `toDateOnly()`, che gira il difetto invece di
 * chiuderlo: la mezzanotte UTC del giorno di Roma **sono le 02:00 a Roma**, e un appuntamento
 * dell'01:30 sparirebbe dal calendario di chi lo guarda all'01:00.
 */
describe('⛔ da quale istante comincia oggi', () => {
  it('⛔ `inizioDiOggi` NON è `toDateOnly()`: sono due ore di differenza, d’estate', () => {
    const adesso = new Date('2026-08-26T09:00:00.000Z');
    expect(inizioDiOggi(adesso).toISOString()).toBe('2026-08-25T22:00:00.000Z');
    expect(toDateOnly().toISOString()).not.toBe(inizioDiOggi(adesso).toISOString());
  });

  it('⚠️ d’inverno l’ora è una sola: il conto lo chiede al fuso, non lo sottrae', () => {
    expect(inizioDiOggi(new Date('2027-01-15T09:00:00.000Z')).toISOString())
      .toBe('2027-01-14T23:00:00.000Z');
  });

  it('⛔ un appuntamento dell’01:30 di stanotte è ancora «da oggi in poi» all’01:00', () => {
    const adesso = new Date('2026-08-25T23:00:00.000Z'); // 01:00 del 26 a Roma
    const appuntamento = new Date('2026-08-25T23:30:00.000Z'); // 01:30 del 26 a Roma
    expect(appuntamento >= inizioDiOggi(adesso)).toBe(true);
    // ⚠️ E con il **giorno** al posto dell'istante sparirebbe: è la prova che le due non si scambiano.
    expect(appuntamento >= aGiorno(adesso)).toBe(false);
  });

  it('⚠️ e quello di ieri sera resta fuori: non si torna al difetto vecchio', () => {
    const adesso = new Date('2026-08-25T23:00:00.000Z');
    expect(new Date('2026-08-25T19:00:00.000Z') >= inizioDiOggi(adesso)).toBe(false);
  });
});

/**
 * ⚠️ **LE TRE DOMANDE CHE SI VEDONO SOLO NEL SORGENTE**, e perché non c'è un test di comportamento.
 *
 * Come `il-giorno-si-chiede.spec.ts`, questi leggono il file. Non è una scorciatoia: in tutti e tre i
 * casi la risposta sbagliata è **indistinguibile** da quella giusta con il fuso di oggi, e diventa
 * visibile solo cambiando `APP_TIMEZONE` o aspettando un rinnovo di fine mese. Un test che non
 * distingue non prova niente; questo almeno dichiara qual è la scelta e la fa cadere se cambia.
 */
describe('⚠️ le scelte che solo il sorgente può mostrare', () => {
  const sorgente = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

  /**
   * ⛔ `Measurement.date` è una colonna `DATE`: i suoi confini di mese devono essere **valori-giorno**
   * (`confineMeseGiorni`), non istanti. Con Roma le due partizioni coincidono — con `APP_TIMEZONE` a
   * ovest ogni misura del primo del mese finirebbe nel mese prima, in tutte le classifiche.
   */
  it('⛔ l’analitica filtra le MISURE con i confini a valori-giorno', () => {
    const s = sorgente('analytics/analytics.service.ts');
    expect(s).toContain('const giornoDelMese = confineMeseGiorni(');
    expect(s).toMatch(/m\.date >= giornoDelMese\.gte/);
    expect(s).toMatch(/m\.date >= mo\.giornoDa && m\.date < mo\.giornoA/);
    // …e i PAGAMENTI con gli istanti: sono timestamp, ed è l'altra metà della stessa scelta.
    expect(s).toMatch(/p\.createdAt >= monthStart/);
  });

  /**
   * ⛔ Il ripiego del rinnovo deve usare la stessa definizione di «un mese» del report
   * (`meseDopo`): con `setUTCMonth` secco, una scadenza al 31 gennaio diventa il **3 marzo**, e ogni
   * rinnovo riparte da lì.
   */
  it('⛔ il ripiego del rinnovo usa `meseDopo`, non un `+1 mese` suo', () => {
    const s = sorgente('commerce/commerce.service.ts');
    expect(s).toMatch(/:\s*meseDopo\(sub\.endDate/);
    expect(s).not.toMatch(/setUTCMonth\([^)]*\+ 1\)/);
  });

  /**
   * ⛔ Il calendario della coach filtra timestamp: gli serve `inizioDiOggi`, non `toDateOnly()`. È la
   * correzione sbagliata che il 25/8 è stata scritta e poi tolta — se torna, questo la ferma.
   */
  it('⛔ il calendario della coach parte da un ISTANTE, non da un giorno', () => {
    const s = sorgente('coach/coach.service.ts');
    expect(s).toContain('const startToday = inizioDiOggi();');
    expect(s).not.toMatch(/startToday = toDateOnly\(/);
  });

  it('⚠️ i tre file si leggono davvero (se no i test sopra non provano niente)', () => {
    for (const f of ['analytics/analytics.service.ts', 'commerce/commerce.service.ts', 'coach/coach.service.ts']) {
      expect(sorgente(f).length).toBeGreaterThan(1000);
    }
  });
});
