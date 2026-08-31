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

/**
 * ⛔ **LA RIAPERTURA SILENZIOSA — 31/8, e il silenzio era sul caso peggiore.**
 *
 * La riga tornava `open` dentro la tregua, ma **senza avvisare nessuno**: quel ramo esce prima
 * della `create`, ed è lì che vive `avvisaSegnalazione`. Lo scenario è preciso: la nutrizionista
 * mette «risolta» credendo di aver sistemato, il motore continua a non comporre, la riga si riapre
 * da sé — e lei non lo sa. Cioè il sistema taceva proprio con **la persona che si era già occupata
 * del problema**.
 *
 * ⚠️ Non è la tregua che si buca: la tregua evita il **doppione** (una riga nuova per una cosa già
 * in elenco) e continua a farlo. Qui la riga è tornata **da chiusa ad aperta**, che è un fatto
 * nuovo — e per uno stato che tiene ferma un'erogazione, un fatto nuovo si dice.
 */
describe('la riapertura dentro la tregua avvisa chi di dovere', () => {
  const risoltaIeri = { id: 'e-vecchia', status: 'resolved', severity: null, resolvedAt: new Date(Date.now() - 86_400_000), updatedAt: new Date() };

  const finto = () => {
    const notifica = jest.fn().mockResolvedValue({});
    return {
      notifica,
      prisma: {
        escalation: {
          findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(risoltaIeri),
          create: jest.fn().mockResolvedValue({ id: 'e-nuova' }),
          update: jest.fn().mockResolvedValue({}),
        },
        clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: 's-n', name: 'Sonia' }) },
        staff: { findMany: jest.fn().mockResolvedValue([{ id: 's-n', userId: 'u-n' }]), findFirst: jest.fn().mockResolvedValue(null) },
        notification: { create: notifica },
      },
    };
  };

  const input = {
    clientId: 'c1',
    category: 'diet_blocked' as never,
    reason: 'Piano bloccato: nessun piatto sicuro per la cena.',
    source: 'engine' as const,
    statoNonAvviso: true,
  };

  it('⛔ IL DIFETTO: riaprire una riga risolta manda una notifica, non lo fa in silenzio', async () => {
    const f = finto();
    await apriSegnalazione(f.prisma as never, input);
    expect(f.notifica).toHaveBeenCalled();
  });

  it('la notifica va alla NUTRIZIONISTA della cliente, con la categoria giusta', async () => {
    const f = finto();
    await apriSegnalazione(f.prisma as never, input);
    const dati = f.notifica.mock.calls[0][0].data as { userId: string; type: string };
    expect(dati.userId).toBe('u-n');
    expect(dati.type).toBe('escalation_diet_blocked');
  });

  it('⚠️ l\'avviso è un di più: se la notifica fallisce, la riga resta comunque APERTA', async () => {
    const f = finto();
    f.notifica.mockRejectedValue(new Error('database giù'));
    const esito = await apriSegnalazione(f.prisma as never, input);
    expect(f.prisma.escalation.update).toHaveBeenCalled();
    expect(esito).toEqual({ id: 'e-vecchia' });
  });

  it('⛔ e su una riga GIÀ APERTA non si avvisa: quello sarebbe il rumore che la tregua evita', async () => {
    const f = finto();
    f.prisma.escalation.findFirst = jest.fn().mockResolvedValueOnce({ id: 'e-aperta', status: 'open', severity: null, resolvedAt: null, updatedAt: new Date() });
    await apriSegnalazione(f.prisma as never, input);
    expect(f.notifica).not.toHaveBeenCalled();
  });
});
