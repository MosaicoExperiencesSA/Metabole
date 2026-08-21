import { apriSegnalazione } from './apri-segnalazione';

/**
 * IL BLOCCO DEL PIANO NON È UN AVVISO: È LO STATO CHE LA CLIENTE LEGGE.
 *
 * La tregua dell'11/8 («se ha risolto, basta fino a nuova segnalazione») è giusta per gli allarmi
 * clinici. Applicata a «Piano bloccato» faceva un'altra cosa: quella riga è ciò che `dietBlock`
 * legge per dire all'app `blocked`. Zittirla per quattordici giorni voleva dire cliente ancora
 * senza menu, nessuna riga in elenco, e in app «Menu in preparazione, arriverà a breve» — che è
 * falso.
 *
 * ⚠️ Dentro la tregua non si crea un doppione: si **riapre** la riga risolta, col motivo di adesso.
 */
describe('statoNonAvviso — dentro la tregua il blocco torna invece di tacere', () => {
  const risoltaIeri = { id: 'e-vecchia', status: 'resolved', severity: null, resolvedAt: new Date(Date.now() - 86_400_000), updatedAt: new Date() };

  const finto = (attiva: unknown, risolta: unknown) => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: 'e-nuova' });
    const findFirst = jest.fn()
      // 1ª chiamata: «ce n'è una aperta?» · 2ª: «l'ultima risolta».
      .mockResolvedValueOnce(attiva)
      .mockResolvedValueOnce(risolta);
    return {
      prisma: {
        escalation: { findFirst, create, update },
        clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: 's-n', name: 'Sonia' }) },
        staff: { findMany: jest.fn().mockResolvedValue([{ id: 's-n', userId: 'u-n' }]), findFirst: jest.fn().mockResolvedValue(null) },
        notification: { create: jest.fn().mockResolvedValue({}) },
      },
      update,
      create,
    };
  };

  const input = (extra: Record<string, unknown> = {}) => ({
    clientId: 'c1',
    category: 'diet_blocked' as never,
    reason: 'Piano bloccato: Polpo grigliato incompatibile con "allergia: molluschi".',
    source: 'engine' as const,
    ...extra,
  });

  it('⛔ senza il flag la segnalazione resta muta: è il difetto', async () => {
    const f = finto(null, risoltaIeri);
    await apriSegnalazione(f.prisma as never, input());
    expect(f.create).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });

  it('col flag la riga risolta si RIAPRE, col motivo di adesso, senza doppioni', async () => {
    const f = finto(null, risoltaIeri);
    const esito = await apriSegnalazione(f.prisma as never, input({ statoNonAvviso: true }));
    expect(f.create).not.toHaveBeenCalled();
    expect(f.update).toHaveBeenCalledWith({
      where: { id: 'e-vecchia' },
      data: { status: 'open', resolvedAt: null, reason: expect.stringContaining('molluschi') },
    });
    expect(esito).toEqual({ id: 'e-vecchia' });
  });

  it('⚠️ una riga GIÀ APERTA non si tocca: qualcuno la sta lavorando', async () => {
    const f = finto({ id: 'e-aperta', status: 'open' }, null);
    await apriSegnalazione(f.prisma as never, input({ statoNonAvviso: true }));
    expect(f.update).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it('fuori dalla tregua nasce una riga nuova, come sempre', async () => {
    const f = finto(null, { ...risoltaIeri, resolvedAt: new Date(Date.now() - 30 * 86_400_000) });
    await apriSegnalazione(f.prisma as never, input({ statoNonAvviso: true }));
    expect(f.create).toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
});
