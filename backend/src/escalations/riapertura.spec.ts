import { decidiRiapertura } from './riapertura';

/**
 * «SE HA RISOLTO, BASTA FINO A NUOVA SEGNALAZIONE» (Simone, 11/8, due volte nello stesso giorno:
 * sulle segnalazioni in generale e sul calo rapido in particolare).
 *
 * Il difetto: chi apriva una segnalazione controllava solo se ce n'era una **aperta**. Appena la
 * nutrizionista metteva «risolta», quel controllo tornava a dire «non ce n'è nessuna» — e la
 * condizione clinica non era cambiata. Quindi la stessa segnalazione ricompariva il giorno dopo,
 * ogni giorno, e chi la riceveva imparava a chiuderla senza leggerla. Comprese quelle nuove.
 *
 * Il secondo gruppo di test è la parte che conta più della prima: la regola deve **tacere**, non
 * essere cieca. Se il calo peggiora davvero, quella non è la stessa segnalazione che torna.
 */
const OGGI = new Date('2026-08-11T10:00:00Z');
const giorniPrima = (n: number) => new Date(OGGI.getTime() - n * 86_400_000);

const prismaCon = (righe: {
  aperta?: { id: string } | null;
  risolta?: { id: string; severity?: number | null; resolvedAt?: Date | null; updatedAt?: Date | null } | null;
}) => ({
  escalation: {
    findFirst: jest.fn().mockImplementation(({ where }: any) => {
      const stato = where.status;
      if (typeof stato === 'object' && Array.isArray(stato?.in)) {
        return Promise.resolve(righe.aperta ? { status: 'open', ...righe.aperta } : null);
      }
      return Promise.resolve(righe.risolta ? { status: 'resolved', ...righe.risolta } : null);
    }),
  },
});

const chiedi = (righe: Parameters<typeof prismaCon>[0], extra: Record<string, unknown> = {}) =>
  decidiRiapertura(prismaCon(righe) as never, {
    clientId: 'client-1',
    category: 'clinical',
    motivoContiene: 'Calo rapido',
    finestraGiorni: 14,
    adesso: OGGI,
    ...extra,
  });

describe('decidiRiapertura — quando NON si disturba di nuovo', () => {
  it('ce n\'è già una aperta: non se ne aggiunge un\'altra', async () => {
    const d = await chiedi({ aperta: { id: 'e-aperta' } });
    expect(d.apri).toBe(false);
    expect(d.precedente?.id).toBe('e-aperta');
  });

  it('risolta ieri: non si riapre — è la richiesta di Simone', async () => {
    const d = await chiedi({ risolta: { id: 'e-chiusa', resolvedAt: giorniPrima(1) } });
    expect(d.apri).toBe(false);
    expect(d.motivo).toContain('non è peggiorata');
  });

  it('risolta 13 giorni fa (dentro la tregua di 14): ancora zitta', async () => {
    expect((await chiedi({ risolta: { id: 'e', resolvedAt: giorniPrima(13) } })).apri).toBe(false);
  });

  it('peggiorata ma non abbastanza: la decisione di chi l\'ha chiusa vale ancora', async () => {
    // Chiusa a 1,8 kg/settimana, ora 2,1: +0,3, sotto la soglia di 0,5.
    const d = await chiedi(
      { risolta: { id: 'e', severity: 1.8, resolvedAt: giorniPrima(2) } },
      { gravita: 2.1, peggioramentoMinimo: 0.5 },
    );
    expect(d.apri).toBe(false);
  });
});

describe('decidiRiapertura — quando invece si parla', () => {
  it('nessuna segnalazione precedente: si apre', async () => {
    const d = await chiedi({});
    expect(d.apri).toBe(true);
    expect(d.motivo).toContain('nessuna segnalazione precedente');
  });

  it('risolta 20 giorni fa e la condizione è ancora lì: si riapre', async () => {
    // Non è insistenza: è un problema che dopo tre settimane non si è risolto.
    const d = await chiedi({ risolta: { id: 'e', resolvedAt: giorniPrima(20) } });
    expect(d.apri).toBe(true);
    expect(d.motivo).toContain('oltre la tregua');
  });

  it('PEGGIORATA oltre la soglia dentro la tregua: si riapre, ed è il punto che rende la regola sicura', async () => {
    // Chiusa a 1,8 kg/settimana, ora 3,5: non è la stessa segnalazione che torna.
    const d = await chiedi(
      { risolta: { id: 'e', severity: 1.8, resolvedAt: giorniPrima(2) } },
      { gravita: 3.5, peggioramentoMinimo: 0.5 },
    );
    expect(d.apri).toBe(true);
    expect(d.motivo).toContain('peggiorata');
    expect(d.motivo).toContain('fatto nuovo');
  });

  it('esattamente sulla soglia si riapre: sul limite si sceglie la sicurezza', async () => {
    const d = await chiedi(
      { risolta: { id: 'e', severity: 2, resolvedAt: giorniPrima(1) } },
      { gravita: 2.5, peggioramentoMinimo: 0.5 },
    );
    expect(d.apri).toBe(true);
  });
});

describe('decidiRiapertura — i casi storti', () => {
  it('una risolta SENZA data di chiusura non tiene zitta la segnalazione per sempre', async () => {
    // Riga vecchia, da prima che esistesse `resolved_at` e senza nemmeno `updated_at`: se in dubbio
    // si parla. Il rischio di dire una cosa in più è minore di quello di tacere un allarme clinico.
    const d = await chiedi({ risolta: { id: 'e', resolvedAt: null, updatedAt: null } });
    expect(d.apri).toBe(true);
  });

  it('senza `resolvedAt` si ripiega su `updatedAt`', async () => {
    expect((await chiedi({ risolta: { id: 'e', resolvedAt: null, updatedAt: giorniPrima(1) } })).apri).toBe(false);
    expect((await chiedi({ risolta: { id: 'e', resolvedAt: null, updatedAt: giorniPrima(30) } })).apri).toBe(true);
  });

  it('segnalazione senza «quanto» (piano bloccato, umore): vale solo la tregua, niente peggioramento', async () => {
    // `severity` nulla da entrambi i lati: non si inventa un confronto che non esiste.
    const d = await chiedi(
      { risolta: { id: 'e', severity: null, resolvedAt: giorniPrima(3) } },
      { gravita: 99, peggioramentoMinimo: 0.5 },
    );
    expect(d.apri).toBe(false);
  });

  it('gravità presente ma nessuna soglia di peggioramento: non si riapre a caso', async () => {
    const d = await chiedi(
      { risolta: { id: 'e', severity: 1, resolvedAt: giorniPrima(3) } },
      { gravita: 99 },
    );
    expect(d.apri).toBe(false);
  });

  it('la ricerca della risolta è ordinata dalla PIÙ RECENTE: conta l\'ultima decisione, non la prima', async () => {
    const prisma = prismaCon({ risolta: { id: 'e', resolvedAt: giorniPrima(1) } });
    await decidiRiapertura(prisma as never, {
      clientId: 'client-1',
      category: 'clinical',
      finestraGiorni: 14,
      adesso: OGGI,
    });
    const seconda = prisma.escalation.findFirst.mock.calls[1][0];
    expect(seconda.orderBy).toEqual([{ resolvedAt: 'desc' }, { updatedAt: 'desc' }]);
  });
});
