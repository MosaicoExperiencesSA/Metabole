import { abbonamentoInCoda, attivoInCorso, eInCoda, staErogando, type AbbonamentoDatato } from './abbonamento-in-corso';

/**
 * IL CASO LORENA POLIDORO, 16/8. Due righe `active`: una in corso, una in coda dal 25/08.
 * `pickMainSubscription` prendeva la più RECENTE — cioè quella in coda — e la scheda scriveva
 * «Inizio piano: 25/08». Chi l'ha aperta ha corretto quella data, e i due piani si sono sovrapposti.
 *
 * Questi test guardano la scelta: fra righe legittimamente attive, quale «è» il piano.
 */
const OGGI = new Date('2026-08-17T10:00:00Z');
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const sub = (o: Partial<AbbonamentoDatato> & { id: string }): AbbonamentoDatato & { id: string } => ({
  status: 'active',
  startDate: null,
  endDate: null,
  ...o,
});

describe('staErogando — sta erogando OGGI?', () => {
  it('cominciato e non finito: sì', () => {
    expect(staErogando(sub({ id: 'a', startDate: d('2026-08-09'), endDate: d('2026-08-25') }), OGGI)).toBe(true);
  });

  it('⚠️ l\'ultimo giorno del piano è un giorno di piano', () => {
    // Confronto per GIORNO e fine COMPRESA: con un confronto sull'istante, chi ha la fine oggi
    // resterebbe senza il menu del suo ultimo giorno pagato.
    expect(staErogando(sub({ id: 'a', endDate: d('2026-08-17') }), OGGI)).toBe(true);
    expect(staErogando(sub({ id: 'a', endDate: d('2026-08-16') }), OGGI)).toBe(false);
  });

  it('comincia domani: no, non sta erogando niente', () => {
    expect(staErogando(sub({ id: 'a', startDate: d('2026-08-25') }), OGGI)).toBe(false);
  });

  it('⚠️ senza data d\'inizio vale «già cominciato»', () => {
    // È come si comporta già `filtroClienteConPianoAttivo`, che guarda solo la fine. Due regole
    // diverse sullo stesso campo farebbero divergere l'erogazione dalle diagnostiche.
    expect(staErogando(sub({ id: 'a', startDate: null, endDate: d('2026-09-01') }), OGGI)).toBe(true);
  });

  it('non è attivo: no, qualunque data abbia', () => {
    expect(staErogando(sub({ id: 'a', status: 'pending', endDate: d('2026-09-01') }), OGGI)).toBe(false);
    expect(staErogando(sub({ id: 'a', status: 'cancelled', endDate: d('2026-09-01') }), OGGI)).toBe(false);
  });
});

describe('attivoInCorso — la scelta fra due righe attive', () => {
  it('⚠️ IL CASO LORENA: vince quello IN CORSO, non quello in coda appena creato', () => {
    const inCorso = sub({ id: 'corso', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    const inCoda = sub({ id: 'coda', startDate: d('2026-08-25'), endDate: d('2026-09-01') });
    // L'ordine della lista è quello che arriva da `createdAt desc`: il più recente PRIMO. È
    // esattamente la lista su cui `pickMainSubscription` sbagliava.
    expect(attivoInCorso([inCoda, inCorso], OGGI)?.id).toBe('corso');
    // E non dipende dall'ordine: era il difetto.
    expect(attivoInCorso([inCorso, inCoda], OGGI)?.id).toBe('corso');
  });

  it('⚠️ due piani SOVRAPPOSTI: vince quello che finisce più tardi', () => {
    // Lo stato rotto. Fra due scelte imperfette si prende quella che non toglie giorni già pagati:
    // prendere la fine più vicina taglierebbe i menu della settimana che la cliente ha comprato.
    const primo = sub({ id: 'primo', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    const secondo = sub({ id: 'secondo', startDate: d('2026-08-17'), endDate: d('2026-09-01') });
    expect(attivoInCorso([primo, secondo], OGGI)?.id).toBe('secondo');
    expect(attivoInCorso([secondo, primo], OGGI)?.id).toBe('secondo');
  });

  it('un piano senza scadenza dura più di tutti', () => {
    const conFine = sub({ id: 'con', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    const senzaFine = sub({ id: 'senza', startDate: d('2026-08-09'), endDate: null });
    expect(attivoInCorso([conFine, senzaFine], OGGI)?.id).toBe('senza');
    expect(attivoInCorso([senzaFine, conFine], OGGI)?.id).toBe('senza');
  });

  it('nessuno eroga ancora: il primo che partirà', () => {
    const fraUnaSettimana = sub({ id: 'presto', startDate: d('2026-08-25') });
    const fraUnMese = sub({ id: 'tardi', startDate: d('2026-09-20') });
    expect(attivoInCorso([fraUnMese, fraUnaSettimana], OGGI)?.id).toBe('presto');
  });

  it('solo attivi con la fine passata (cron in ritardo): si dà quello finito per ultimo, non null', () => {
    // Tornare null farebbe sparire il piano dalla scheda di chi lo sta guardando.
    const vecchio = sub({ id: 'vecchio', startDate: d('2026-06-01'), endDate: d('2026-07-01') });
    const meno = sub({ id: 'meno', startDate: d('2026-07-01'), endDate: d('2026-08-01') });
    expect(attivoInCorso([vecchio, meno], OGGI)?.id).toBe('meno');
  });

  it('niente di attivo: null (anche con pending, scaduti e annullati)', () => {
    expect(attivoInCorso([], OGGI)).toBeNull();
    expect(
      attivoInCorso(
        [
          sub({ id: 'p', status: 'pending', endDate: d('2026-09-01') }),
          sub({ id: 'e', status: 'expired' }),
          sub({ id: 'c', status: 'cancelled' }),
        ],
        OGGI,
      ),
    ).toBeNull();
  });

  it('un solo attivo: quello, come prima', () => {
    const solo = sub({ id: 'solo', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    expect(attivoInCorso([solo], OGGI)?.id).toBe('solo');
  });
});

describe('abbonamentoInCoda — quello che aspetta, per poterlo DIRE', () => {
  it('trova la coda dietro al piano in corso', () => {
    const inCorso = sub({ id: 'corso', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    const inCoda = sub({ id: 'coda', startDate: d('2026-08-25'), endDate: d('2026-09-01') });
    expect(abbonamentoInCoda([inCorso, inCoda], OGGI)?.id).toBe('coda');
  });

  it('con due code prende la prima che parte', () => {
    expect(
      abbonamentoInCoda(
        [sub({ id: 'tardi', startDate: d('2026-09-20') }), sub({ id: 'presto', startDate: d('2026-08-25') })],
        OGGI,
      )?.id,
    ).toBe('presto');
  });

  it('nessuna coda: null — e un piano in corso NON è una coda', () => {
    const inCorso = sub({ id: 'corso', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    expect(abbonamentoInCoda([inCorso], OGGI)).toBeNull();
    expect(eInCoda(inCorso, OGGI)).toBe(false);
  });

  it('⚠️ un `pending` con data futura non è una coda: non è stato approvato', () => {
    // La coda è una decisione presa su un piano già pagato. Un pending è un carrello.
    expect(abbonamentoInCoda([sub({ id: 'p', status: 'pending', startDate: d('2026-08-25') })], OGGI)).toBeNull();
  });
});

/**
 * LE DUE PASTIGLIE DELLA SCHEDA (17/8) — il contratto che il DTO di `clients.service` consuma.
 *
 * Due piani `active` producevano due pastiglie IDENTICHE («Piano · Attivo» più la data d'inizio), e
 * chi apriva la scheda non poteva sapere quale dei due stesse dando i menu oggi: è il buco da cui è
 * passato il caso Polidoro. Ora `getDetail` manda `inCorso` e `inCoda` per ogni riga, calcolati con
 * QUESTE due funzioni e non riscritti nel browser.
 *
 * ⚠️ Quello che si difende qui è che, sulla stessa lista, i due flag non possano essere veri insieme
 * né falsi insieme quando una coda esiste: se lo fossero, le pastiglie tornerebbero indistinguibili
 * senza che nessun test se ne accorga.
 */
describe('le due pastiglie: `inCorso` e `inCoda` sulla stessa lista', () => {
  const eroga = sub({ id: 'corso', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
  const coda = sub({ id: 'coda', startDate: d('2026-08-25'), endDate: d('2026-09-01') });

  it('il caso Lorena: una sola eroga, una sola è in coda — e non sono la stessa', () => {
    const righe = [eroga, coda].map((s) => ({ id: s.id, inCorso: staErogando(s, OGGI), inCoda: eInCoda(s, OGGI) }));
    expect(righe.filter((r) => r.inCorso).map((r) => r.id)).toEqual(['corso']);
    expect(righe.filter((r) => r.inCoda).map((r) => r.id)).toEqual(['coda']);
    for (const r of righe) expect(r.inCorso && r.inCoda).toBe(false);
  });

  it('⚠️ un piano annullato o scaduto non è né in corso né in coda: la pastiglia resta quella dello stato', () => {
    for (const stato of ['cancelled', 'expired', 'pending']) {
      const s = sub({ id: stato, status: stato, startDate: d('2026-08-25') });
      expect(staErogando(s, OGGI)).toBe(false);
      expect(eInCoda(s, OGGI)).toBe(false);
    }
  });

  it('⚠️ un `active` con la fine già passata (cron di scadenza in ritardo) NON risulta in corso: la pastiglia non promette menu che non arrivano', () => {
    const scaduto = sub({ id: 'vecchio', startDate: d('2026-07-01'), endDate: d('2026-08-10') });
    expect(staErogando(scaduto, OGGI)).toBe(false);
    expect(eInCoda(scaduto, OGGI)).toBe(false);
  });

  it('un piano senza fine che eroga: `inCorso` vero, e la pastiglia dirà «senza scadenza» invece di inventare una data', () => {
    const senzaFine = sub({ id: 'aperto', startDate: d('2026-08-09'), endDate: null });
    expect(staErogando(senzaFine, OGGI)).toBe(true);
    expect(senzaFine.endDate).toBeNull();
  });
});
