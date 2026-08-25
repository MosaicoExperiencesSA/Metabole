/**
 * ⛔ **QUANDO GAIA DICE «L'HO GIRATA ALLA TUA NUTRIZIONISTA», DEVE ESSERE VERO.**
 *
 * `passaAllaNutrizionista` apre la segnalazione con `dedupe: true`, che serve: senza, tre messaggi
 * della stessa cliente in un pomeriggio diventano tre righe uguali sul tavolo di chi deve
 * rispondere. Ma `alSilenzio` scatta in **due casi diversi**, e trattarli come uno solo perdeva la
 * richiesta:
 *
 *  · c'è una segnalazione **aperta** → il motivo nuovo si accoda al suo testo, ed è giusto;
 *  · ce n'è una **risolta** dentro la tregua di riapertura (14 giorni, e basta una qualunque
 *    segnalazione «other» di un altro sottosistema) → `decidiRiapertura` dice «non riaprire» e rende
 *    quella riga. Il motivo finiva in coda a una segnalazione **chiusa**, che nessuno riaprirà; e su
 *    Vera nemmeno quello, perché la chiave è `gaia:<idSegnalazione>` e quella domanda era chiusa a
 *    sua volta. La richiesta spariva da **tutte e due** le porte, dopo che Gaia le aveva detto di
 *    averla girata.
 *
 * ⚠️ *Una ragione falsa è peggio di un ordine sbagliato*, e *una coda che si accorcia da sola è
 * peggio di una coda lunga*. Trovato al secondo giro di revisione, 25/8.
 */
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { SostituzioneChatService } from './sostituzione-chat.service';

type Riga = {
  id: string;
  status: string;
  reason: string;
  category: string;
  createdAt: Date;
  /**
   * ⚠️ **`resolvedAt` non è un dettaglio del finto.** `decidiRiapertura` conta i giorni da lì: senza
   * data, `giorniDaAllora` è `Infinity`, la tregua risulta superata e la segnalazione si riapre —
   * cioè il caso che questo file deve riprodurre **non capita**, e il test passerebbe anche col
   * difetto dentro. Verificato con la prova delle mutazioni, 25/8.
   */
  resolvedAt?: Date | null;
};

const crea = (righe: Riga[]) => {
  const escalations = [...righe];
  const richiesteVera: { id: string; chiave: string; testo: string; stato: string }[] = [];
  const prisma = {
    escalation: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const stati: string[] | undefined = where?.status?.in ? where.status.in : where?.status ? [where.status] : undefined;
        return escalations.find((e) => (!stati || stati.includes(e.status)) && e.category === where?.category) ?? null;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => escalations.find((e) => e.id === where.id) ?? null),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const riga = { id: `esc-${escalations.length + 1}`, status: 'open', reason: data.reason, category: data.category, createdAt: new Date(), resolvedAt: null };
        escalations.push(riga);
        return riga;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const riga = escalations.find((e) => e.id === where.id)!;
        Object.assign(riga, data);
        return riga;
      }),
    },
    richiestaVera: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        richiesteVera.find((r) => (where.chiave ? r.chiave === where.chiave : r.id === where.id)) ?? null),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const riga = { id: `rv-${richiesteVera.length + 1}`, chiave: data.chiave, testo: data.testo, stato: 'aperta' };
        richiesteVera.push(riga);
        return riga;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const riga = richiesteVera.find((r) => r.id === where.id)!;
        Object.assign(riga, data);
        return riga;
      }),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Giulia', assignedNutritionist: { userId: 'u-n' } }) },
    staff: { findMany: jest.fn().mockResolvedValue([{ id: 'staff-n', userId: 'u-n' }]), findFirst: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const service = new SostituzioneChatService(
    prisma as unknown as PrismaService,
    { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0), getString: jest.fn() } as unknown as ConfigParamsService,
  );
  const gira = (motivo: string) =>
    (service as unknown as { passaAllaNutrizionista(c: string, m: string): Promise<void> }).passaAllaNutrizionista('c1', motivo);
  return { gira, escalations, richiesteVera, prisma };
};

const RISOLTA: Riga = {
  id: 'esc-vecchia',
  status: 'resolved',
  reason: 'Una cosa di tre giorni fa, già chiusa.',
  category: 'other',
  createdAt: new Date('2026-08-22T10:00:00Z'),
  // Tre giorni fa: dentro la tregua di riapertura (14 giorni), quindi «non riaprire».
  resolvedAt: new Date(Date.now() - 3 * 86_400_000),
};

describe('⛔ la richiesta girata da Gaia non sparisce', () => {
  /**
   * ⛔ **Il caso che spariva.** La regola della riapertura è nata per *la stessa condizione che
   * ritorna*, non per una domanda nuova che una persona ha appena fatto.
   */
  it('⛔ con una segnalazione già RISOLTA se ne apre una nuova, non si scrive sulla chiusa', async () => {
    const { gira, escalations } = crea([RISOLTA]);
    await gira('Cambio in chat: «panna fresca» → «olio evo».');
    const vecchia = escalations.find((e) => e.id === 'esc-vecchia')!;
    expect(vecchia.reason).toBe('Una cosa di tre giorni fa, già chiusa.');
    expect(vecchia.status).toBe('resolved');
    const nuova = escalations.find((e) => e.id !== 'esc-vecchia');
    expect(nuova).toBeTruthy();
    expect(nuova!.reason).toContain('panna fresca');
    expect(nuova!.status).toBe('open');
  });

  /** ⛔ E la domanda su Vera nasce insieme a lei: sono le due porte da cui si risponde. */
  it('⛔ e anche la domanda su Vera esiste', async () => {
    const { gira, richiesteVera } = crea([RISOLTA]);
    await gira('Cambio in chat: «panna fresca» → «olio evo».');
    expect(richiesteVera).toHaveLength(1);
    expect(richiesteVera[0].testo).toContain('panna fresca');
  });

  /**
   * ⚠️ **La controprova, ed è quella che conta**: su una segnalazione APERTA la riga resta una — è
   * giusto che sia una — e il motivo nuovo si accoda invece di aprirne un'altra.
   */
  it('⚠️ su una segnalazione aperta il motivo si accoda, senza aprirne una seconda', async () => {
    const { gira, escalations } = crea([
      { id: 'esc-aperta', status: 'open', reason: 'La panna a pranzo.', category: 'other', createdAt: new Date() },
    ]);
    await gira('Il burro a cena.');
    expect(escalations).toHaveLength(1);
    expect(escalations[0].reason).toBe('La panna a pranzo.\n· Il burro a cena.');
  });

  it('⚠️ e la stessa richiesta ripetuta non si accoda due volte', async () => {
    const { gira, escalations } = crea([
      { id: 'esc-aperta', status: 'open', reason: 'La panna a pranzo.', category: 'other', createdAt: new Date() },
    ]);
    await gira('La panna a pranzo.');
    expect(escalations[0].reason).toBe('La panna a pranzo.');
  });

  it('⚠️ senza niente di aperto né di chiuso, la segnalazione nasce come sempre', async () => {
    const { gira, escalations, richiesteVera } = crea([]);
    await gira('Cambio in chat: «olio evo» → «burro».');
    expect(escalations).toHaveLength(1);
    expect(richiesteVera).toHaveLength(1);
  });
});
