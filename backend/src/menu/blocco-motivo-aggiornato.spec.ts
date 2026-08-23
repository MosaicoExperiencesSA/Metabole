import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DayComboService } from './day-combo.service';
import { MOTIVO_BLOCCO_MENU, MenuService } from './menu.service';

/**
 * UNA SEGNALAZIONE APERTA DICE COSA NON VA **ADESSO**, non cosa non andava allora.
 *
 * `ensureDietBlockedEscalation` cominciava con `if (already) return`, e il 21/8 si è visto cosa
 * vuol dire: la riga di Sonia continuava a elencare i piatti della **prima** composizione fallita, e
 * avrebbe elencato gli stessi identici anche se il motore avesse ricominciato a comporre. Guardarla
 * e concludere «non ha funzionato» sarebbe stato leggere una fotografia vecchia — ed è esattamente
 * quello che stava per succedere.
 *
 * ⚠️ Non si apre una riga nuova: quella sarebbe la pila di doppioni che il dedup evita, giustamente.
 * Si riscrive il motivo di quella che c'è.
 */
describe('il motivo del «Piano bloccato» si aggiorna, la riga no', () => {
  const crea = (aperta: unknown) => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: 'e-nuova' });
    const prisma = {
      escalation: { findFirst: jest.fn().mockResolvedValue(aperta), create, update },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: 's-n', name: 'Sonia' }) },
      staff: { findMany: jest.fn().mockResolvedValue([{ id: 's-n', userId: 'u-n' }]), findFirst: jest.fn().mockResolvedValue(null) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new MenuService(
      prisma as unknown as PrismaService,
      { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0), getString: jest.fn() } as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null), pausaAppenaFinita: jest.fn().mockResolvedValue(null) } as never,
      { stateFor: jest.fn().mockResolvedValue('normale') } as never,
      new DayComboService(),
      { computeTargetKcal: jest.fn().mockResolvedValue(null) } as never,
      { sendToUser: jest.fn() } as never,
    );
    // Privata di proposito: è la funzione che decide cosa legge la cliente al posto del menu.
    const apri = (motivi: string[]) =>
      (service as unknown as {
        ensureDietBlockedEscalation(c: string, r: string[]): Promise<void>;
      }).ensureDietBlockedEscalation('c1', motivi);
    return { prisma, update, create, apri };
  };

  const MOTIVO_VECCHIO = `${MOTIVO_BLOCCO_MENU} (Polpo grigliato: contiene Molluschi). Serve una dieta personalizzata.`;

  it('⛔ i motivi sono cambiati: si riscrive il motivo, NON si apre un doppione', async () => {
    const t = crea({ id: 'e-1', reason: MOTIVO_VECCHIO });
    await t.apri(['Bresaola: incompatibile con "allergia: solfiti"']);
    expect(t.create).not.toHaveBeenCalled();
    expect(t.update).toHaveBeenCalledWith({
      where: { id: 'e-1' },
      data: { reason: expect.stringContaining('Bresaola') },
    });
  });

  it('i motivi sono gli stessi: non si tocca niente (una riga riscritta uguale sposta solo la data)', async () => {
    const t = crea({ id: 'e-1', reason: MOTIVO_VECCHIO });
    await t.apri(['Polpo grigliato: contiene Molluschi']);
    expect(t.update).not.toHaveBeenCalled();
    expect(t.create).not.toHaveBeenCalled();
  });

  it('nessuna riga aperta: si apre, e passa dall\'instradamento', async () => {
    const t = crea(null);
    await t.apri(['Polpo grigliato: contiene Molluschi']);
    expect(t.create).toHaveBeenCalled();
    expect(t.update).not.toHaveBeenCalled();
  });

  it('⚠️ il motivo comincia SEMPRE con la costante: è la chiave con cui la riga si riconosce e si chiude', async () => {
    const t = crea(null);
    await t.apri(['un piatto qualsiasi']);
    const scritto = (t.create.mock.calls[0][0] as { data: { reason: string } }).data.reason;
    expect(scritto.startsWith(MOTIVO_BLOCCO_MENU)).toBe(true);
  });
});
