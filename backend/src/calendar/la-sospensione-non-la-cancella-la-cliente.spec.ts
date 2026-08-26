import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ClientsController } from '../clients/clients.controller';

/**
 * ⛔ **UNA SOSPENSIONE NON LA CANCELLA LA CLIENTE** — 26/8, richiesta di Simone: *«solo la coach, il
 * nutrizionista e admin possono cancellare le sospensioni»*.
 *
 * ## Il caso vero, misurato lo stesso giorno
 *
 * Una cliente risultava **sospesa fino al 31 agosto** in scheda e riceveva i menu lo stesso.
 * `npm run prova:erogazione` ha stampato la riga che spiega tutto: «7. sospensione attiva: nessuna
 * ✓». Il periodo non c'era più, e da `DELETE /me/events/:id` — `@Roles('client')` — bastava un tocco
 * sul pulsante rosso del suo Calendario per toglierlo, anche se l'aveva messo la coach.
 *
 * ⛔ E spariva **senza lasciare traccia dove qualcuno l'avrebbe cercata**: l'audit scriveva
 * `calendar.event.delete`, che lo Storico delle sospensioni non legge; lo specchio sul profilo
 * restava pieno, quindi la scheda diceva «sospesa»; il motore ripartiva. Tre punti, tre risposte
 * diverse alla stessa domanda, e nessun errore da nessuna parte.
 *
 * ⚠️ **Tutta la suite era verde** con quella porta aperta: 371 test su `clients`, `pause` e
 * `calendar`. Nessuno guardava chi potesse cancellare cosa.
 */
describe('⛔ la porta della cliente: i periodi di sospensione non si cancellano da lì', () => {
  const crea = (evento: Record<string, unknown> | null) => {
    const prisma: any = {
      event: {
        findFirst: jest.fn().mockResolvedValue(evento),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new EventsService(prisma as never, audit as never, { getNumber: jest.fn() } as never);
    return { prisma, audit, service };
  };

  it('⛔ un periodo di sospensione NON si cancella, e il messaggio dice a chi chiedere', async () => {
    const { service, prisma } = crea({ id: 'e1', clientId: 'c1', mode: 'pause_period' });
    await expect(service.remove('c1', 'e1')).rejects.toBeInstanceOf(BadRequestException);
    /** ⚠️ La prova che conta non è l'eccezione: è che l'evento sia ancora lì. */
    expect(prisma.event.delete).not.toHaveBeenCalled();
    await expect(service.remove('c1', 'e1')).rejects.toThrow(/coach/i);
  });

  /**
   * ⚠️ **Gli altri eventi restano suoi.** Un divieto che si allarga alla cena fuori e al matrimonio
   * toglierebbe alla cliente il suo calendario per proteggere una cosa che non c'entra — e un
   * cancello che chiude più del necessario costa quanto uno che si apre.
   */
  it('✅ la cena fuori, il matrimonio, il giorno libero: quelli li cancella come prima', async () => {
    for (const mode of ['single_event', null, undefined]) {
      const { service, prisma } = crea({ id: 'e2', clientId: 'c1', mode });
      await expect(service.remove('c1', 'e2')).resolves.toEqual({ deleted: true });
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'e2' } });
    }
  });

  it('un evento che non è suo resta «non trovato», come prima', async () => {
    const { service } = crea(null);
    await expect(service.remove('c1', 'e3')).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * ⛔ **E LA STRADA DALL'ALTRA PARTE DEVE ESISTERE.** Chiudere la porta della cliente senza aprirne
 * una allo staff lascerebbe i periodi nati dal suo Calendario **senza nessuno** che li possa
 * togliere: un cancello chiuso su tutti e due i lati, che è peggio di quello che stiamo chiudendo.
 */
describe('⛔ la porta dello staff: chi può togliere una sospensione', () => {
  const pagina = (metodo: string) =>
    Reflect.getMetadata(PAGE_KEY, (ClientsController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;

  it('la rotta esiste e chiede `travel_mode` in scrittura', () => {
    expect(pagina('togliSospensione')).toEqual({ pageKey: 'travel_mode', level: 'manage' });
  });

  /**
   * ⛔ **LE DUE PORTE CHIEDONO LA STESSA COSA, e questo test è la correzione della revisione del
   * 26/8.** La prima stesura metteva un `@Roles` di metodo per escludere `sales`. Era un confine
   * finto: la `PATCH :id/travel` qui accanto toglie **la stessa** sospensione svuotando le date, e
   * `@Roles` di metodo non ce l'ha. Un divieto che si aggira dal pulsante di fianco non protegge
   * niente e fa credere il contrario.
   *
   * ✅ Chi può togliere una sospensione lo decide `travel_mode: manage` nella tabella dei permessi.
   * Se un giorno le due porte divergono, questo test diventa rosso — che è l'unico modo di
   * accorgersene senza rileggere due file.
   */
  it('⛔ la stessa guardia della PATCH che toglie la sospensione svuotando le date', () => {
    expect(pagina('togliSospensione')).toEqual(pagina('setTravel'));
    const suoi = Reflect.getMetadata(ROLES_KEY, (ClientsController.prototype as never as Record<string, () => unknown>).togliSospensione);
    const dellaGemella = Reflect.getMetadata(ROLES_KEY, (ClientsController.prototype as never as Record<string, () => unknown>).setTravel);
    expect(suoi).toEqual(dellaGemella);
  });

  /** ⚠️ E nessuna cliente entra da questo controller: i ruoli stanno sulla classe. */
  it('⛔ nessuna cliente bussa alla scheda', () => {
    const ruoliClasse: string[] = Reflect.getMetadata(ROLES_KEY, ClientsController) ?? [];
    expect(ruoliClasse).not.toContain('client');
  });
});
