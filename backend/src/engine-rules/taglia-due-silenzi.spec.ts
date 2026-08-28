import { Logger } from '@nestjs/common';
import { EngineRulesService } from './engine-rules.service';

/**
 * ⛔ **DUE SILENZI DIVERSI SOTTO LO STESSO `null`** (voce `taglia-catalogo-due-silenzi`, nata in
 * revisione il 28/8 e chiusa lo stesso giorno).
 *
 * Il catalogo si dimensiona sulla **mediana** dei fabbisogni delle clienti di quella dieta. Chi non
 * ha un fabbisogno cade fuori dal conto — e da oggi le ragioni sono **due**:
 *
 *  · mancano sesso, età, altezza o un peso da cui partire;
 *  · le sue pesate non stanno in piedi fra loro, e il fabbisogno è **sospeso**.
 *
 * ⚠️ Le due portano a due gesti diversi — «completa il profilo» e «vai a correggere una pesata» — e
 * un solo numero manda a fare la cosa sbagliata su metà delle clienti. Con poche clienti per taglia
 * la mediana si sposta senza che nessuno lo sappia: *un dato che agisce e non si vede*.
 */
const CLIENTI = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }, { userId: 'd' }];

const stima = (target: number, sospeso = false) => ({
  target,
  pesoIncoerente: sospeso ? { frase: 'da 113 kg a 73 kg in 7 giorni' } : null,
});

function servizio(stime: Record<string, unknown | null>) {
  const righe: string[] = [];
  jest.spyOn(Logger.prototype, 'log').mockImplementation((m: unknown) => void righe.push(String(m)));
  const prisma = {
    clientProfile: { findMany: jest.fn().mockResolvedValue(CLIENTI) },
  };
  const configParams = {
    getBool: jest.fn().mockImplementation((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    getNumber: jest.fn().mockImplementation((_k: string, def?: number) => Promise.resolve(def)),
  };
  const kcalNeed = {
    estimate: jest.fn().mockImplementation((id: string) => Promise.resolve(stime[id] ?? null)),
    // ⚠️ Se il servizio tornasse a chiamare questo, i due conteggi sparirebbero senza errori: la
    // risposta non porta il motivo. Il finto lo rende visibile invece di rispondere per cortesia.
    computeTargetKcal: jest.fn().mockRejectedValue(new Error('non deve passare di qui: la risposta perde il motivo')),
  };
  const service = new EngineRulesService(
    prisma as never, configParams as never, { log: jest.fn() } as never, {} as never, kcalNeed as never,
  );
  const taglia = (service as unknown as {
    tagliaPerIlCatalogo: (p: unknown, t: number, tol: number) => Promise<{ targetKcal: number }>;
  }).tagliaPerIlCatalogo.bind(service);
  return { taglia, righe, kcalNeed };
}

afterEach(() => jest.restoreAllMocks());

describe('⛔ la taglia del catalogo distingue «non lo so» da «non mi fido»', () => {
  /**
   * ⛔ **DUE NUMERI DIVERSI, non due volte lo stesso.** La prima stesura di questo test usava una
   * fixture con **una** cliente per ragione: scambiando le due variabili nel messaggio restava
   * verde, perché «1 e 1» è vero in tutti e due i versi — cioè non provava l'unica cosa che la voce
   * esiste per garantire. Adesso sono **due senza dati** e **una sospesa**: se si scambiano, il test
   * cade.
   *
   * ⚠️ Perché conta: le due ragioni portano a due gesti diversi — «completa il profilo» e «vai a
   * correggere una pesata» — e un numero attribuito alla ragione sbagliata manda a fare la cosa
   * sbagliata su metà delle clienti.
   */
  it('⛔ conta le due ragioni separate, e non le scambia', async () => {
    const { taglia, righe } = servizio({
      a: stima(1600),
      b: null, // niente sesso/età/altezza/peso
      c: null, // idem
      d: stima(1500, true), // pesate incoerenti: fabbisogno sospeso
    });
    await taglia({ regime: null, objective: null, style: 'mediterranean' }, 1800, 10);
    const riga = righe.find((r) => r.includes('Catalogo'));
    expect(riga).toBeDefined();
    expect(riga).toContain('2 senza i dati del profilo');
    expect(riga).toContain('1 con le pesate da verificare');
    expect(riga).toContain('su 4');
  });

  /**
   * ⚠️ **LA SOSPESA NON ENTRA NELLA MEDIANA — e non è una novità di questa consegna.**
   *
   * ⛔ La prima stesura di questa nota diceva «non pesa **più**», e la revisione l'ha smentita:
   * `computeTargetKcal` rispondeva già `null` sulle sospese, quindi erano già fuori. La mediana non
   * cambia di un kcal. **L'unica cosa che questa consegna cambia davvero è la riga di log**, e
   * spacciare per correzione un comportamento che c'era è il modo in cui un verbale di lavoro
   * smette di valere.
   *
   * ⚠️ Il test però resta, e non per riempire: passando da `computeTargetKcal` a `estimate` la
   * decisione di escluderle è stata **riscritta a mano** in questo file (`s && !s.pesoIncoerente`).
   * Prima era dentro l'altro metodo; adesso è qui, e qui va tenuta ferma. Con 1600 e 1700 la mediana
   * è 1650; se entrasse anche il 1500 sarebbe 1600.
   */
  it('⚠️ il fabbisogno sospeso non entra nella mediana (come prima, ma adesso la regola è qui)', async () => {
    const { taglia } = servizio({ a: stima(1600), b: stima(1700), c: null, d: stima(1500, true) });
    const out = await taglia({ regime: null, objective: null, style: 'mediterranean' }, 1800, 10);
    expect(out.targetKcal).toBe(1650);
  });

  /** ⚠️ Quando non cade fuori nessuno non si scrive niente: *un avviso che compare sempre non è un avviso*. */
  it('⚠️ e se ci sono tutte, la riga non parla di cadute', async () => {
    const { taglia, righe } = servizio({ a: stima(1600), b: stima(1700), c: stima(1650), d: stima(1600) });
    await taglia({ regime: null, objective: null, style: 'mediterranean' }, 1800, 10);
    const riga = righe.find((r) => r.includes('Catalogo'))!;
    expect(riga).not.toContain('Fuori dal conto');
  });

  /**
   * ⛔ **UNO ZERO IN UN ELENCO DI PROBLEMI SI LEGGE COME UN PROBLEMA.** La prima stesura stampava
   * sempre tutte e due le ragioni appena una era diversa da zero: «0 senza i dati del profilo, 1 con
   * le pesate da verificare». Adesso si elencano solo quelle che ci sono.
   */
  it('⛔ e con una ragione sola non compare lo zero dell\'altra', async () => {
    const { taglia, righe } = servizio({ a: stima(1600), b: stima(1700), c: stima(1650), d: stima(1500, true) });
    await taglia({ regime: null, objective: null, style: 'mediterranean' }, 1800, 10);
    const riga = righe.find((r) => r.includes('Catalogo'))!;
    expect(riga).toContain('1 con le pesate da verificare');
    expect(riga).not.toContain('0 senza i dati');
  });

  /**
   * ⛔ **UN ERRORE DI DATABASE NON È «SENZA I DATI DEL PROFILO».** Il `catch` le rendeva
   * indistinguibili, e sarebbero finite nello stesso numero: chi legge andrebbe a completare un
   * profilo che è già completo. *Una ragione falsa è peggio di nessuna ragione* — e qui la ragione
   * è proprio la cosa che si sta stampando.
   */
  it('⛔ e una lettura fallita si conta a parte, non fra i profili incompleti', async () => {
    const { taglia, righe, kcalNeed } = servizio({ a: stima(1600), b: stima(1700), c: stima(1650) });
    kcalNeed.estimate.mockImplementation((id: string) =>
      id === 'd' ? Promise.reject(new Error('database giù')) : Promise.resolve({ target: 1600, pesoIncoerente: null }),
    );
    await taglia({ regime: null, objective: null, style: 'mediterranean' }, 1800, 10);
    const riga = righe.find((r) => r.includes('Catalogo'))!;
    expect(riga).toContain('1 non lette per un errore');
    expect(riga).not.toContain('senza i dati del profilo');
  });
});
