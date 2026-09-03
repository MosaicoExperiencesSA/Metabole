import { readFileSync } from 'fs';
import { join } from 'path';
import { ClientsService } from './clients.service';

/**
 * ⛔ **LA DOMANDA PRIMA DELLA CORREZIONE, ANCHE DAL BACKOFFICE** (voce
 * `pesata-strana-chiedi-conferma`).
 *
 * `PATCH /admin/clients/:id/measurements/:id` accetta **25–400 kg** — più largo del DTO della
 * cliente — ed è quindi il punto in cui una pesata impossibile può *nascere*, dalle mani di chi la
 * sta sistemando. La domanda che l'app fa alla cliente deve esistere anche qui, con le parole dello
 * staff.
 *
 * Due cose sole, e sono quelle che una riscrittura distratta romperebbe: il **perimetro** e la
 * **guardia**.
 */
describe('⛔ verificaMisura: sola lettura, ma dentro il perimetro', () => {
  function servizio(verifica: jest.Mock) {
    const s = new ClientsService(
      {} as never,
      {} as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { verificaPesata: verifica } as never,
      {} as never,
    );
    return s;
  }

  /**
   * ⛔ Senza il perimetro questa sarebbe una porta per **leggere il peso di una cliente che non è
   * tua**: si scrivono numeri a caso e si guarda quando la frase compare — che risponde «il
   * 26/08/2026 la pesata è 73 kg», cioè esattamente il dato sanitario che il perimetro protegge.
   * *Una rotta di cortesia non è una rotta senza perimetro.*
   */
  it('⛔ chiede il perimetro PRIMA di leggere, e se non ce l\'hai non legge niente', async () => {
    const verifica = jest.fn().mockResolvedValue(null);
    const s = servizio(verifica);
    (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () =>
      Promise.reject(new Error('non è una tua cliente'));
    await expect(s.verificaMisura('cli-1', 'staff-1', 113, '2026-09-03')).rejects.toThrow('non è una tua cliente');
    expect(verifica).not.toHaveBeenCalled();
  });

  it('⚠️ e passa le parole dello staff, non quelle della cliente', async () => {
    const verifica = jest.fn().mockResolvedValue(null);
    const s = servizio(verifica);
    (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
    await s.verificaMisura('cli-1', 'staff-1', 113, '2026-09-03');
    expect(verifica).toHaveBeenCalledWith('cli-1', 113, 'staff', '2026-09-03');
  });
});

describe('⛔ la rotta ha la sua guardia', () => {
  const sorgente = readFileSync(join(__dirname, 'clients.controller.ts'), 'utf8');

  /**
   * ⚠️ **Si guardano le righe SOPRA il `@Get`, non il file intero.** Un `indexOf` su tutta la
   * sorgente trova la stessa chiave dentro il commento che spiega la regola: è già successo il
   * 31/8, e il test restava verde con la guardia tolta.
   */
  const decoratoriDi = (rotta: string): string => {
    const i = sorgente.indexOf(rotta);
    expect(i).toBeGreaterThan(-1);
    // Dall'ultima riga vuota (fine del blocco di commento) fino al `@Get`.
    const prima = sorgente.slice(0, i);
    return prima.slice(prima.lastIndexOf('\n   */'));
  };

  it('⛔ `GET :id/measurements/verifica` è sotto `fix_measures`', () => {
    expect(decoratoriDi("@Get(':id/measurements/verifica')")).toContain("@RequirePage('fix_measures')");
  });

  /**
   * ⚠️ In **sola visione**, di proposito: è una domanda su numeri che chi apre questa scheda vede
   * già in tabella, e pretendere `manage` per leggerli renderebbe muta la schermata a chi guarda
   * senza correggere. La scrittura invece resta `manage`, e questo test tiene ferme tutt'e due.
   */
  it('⚠️ la lettura non chiede `manage`, la scrittura sì', () => {
    expect(decoratoriDi("@Get(':id/measurements/verifica')")).not.toContain("'fix_measures', 'manage'");
    expect(decoratoriDi("@Patch(':id/measurements/:measurementId')")).toContain("@RequirePage('fix_measures', 'manage')");
  });
});
