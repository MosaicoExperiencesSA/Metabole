/**
 * IL PASSO DELLA NOTTE — i test.
 *
 * È il pezzo che fa **arrivare** le due cose che di giorno vengono solo promesse: il cambio
 * rimandato («la tua finestra si è già aperta, vale da domani») e il piano graduale («un'ora al
 * giorno»). Senza di lui quelle due promesse restano scritte in un campo e non succedono mai.
 *
 * ⛔ Il caso che conta di più è **l'ordine**: il protocollo rimandato entra in vigore prima del
 * passo sull'orario, perché la finestra dei pasti si deriva da tutti e due. Applicarli al contrario
 * darebbe una notte di pasti calcolati sul protocollo vecchio.
 */
import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;

type Profilo = Record<string, unknown>;

function creaServizio(profili: Profilo[]) {
  const scritture: { userId: string; data: Record<string, unknown> }[] = [];
  const audit: Record<string, unknown>[] = [];
  const tx = {
    clientProfile: {
      update: jest.fn(async (a: any) => { scritture.push({ userId: a.where.userId, data: a.data }); return {}; }),
    },
    auditLog: { create: jest.fn(async (a: any) => { audit.push(a.data); return {}; }) },
  };
  const prisma: any = {
    clientProfile: {
      findMany: jest.fn().mockResolvedValue(profili),
      update: tx.clientProfile.update,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const service = new ProfileService(
    prisma as unknown as PrismaService,
    { getNumber: jest.fn().mockResolvedValue(60) } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, scritture, audit, prisma };
}

const conBersaglio = (extra: Profilo): Profilo => ({
  userId: 'u1',
  pathType: 'intermittent_fasting',
  fastingProtocol: '16:8',
  fastingStartMin: H(12),
  fastingWindow: 'skip_breakfast',
  fastingTargetStartMin: null,
  fastingTargetProtocol: null,
  fastingSceltoIl: new Date('2026-08-01T10:00:00Z'),
  fastingChangedAt: null,
  ...extra,
});

describe('⛔ il cambio rimandato a stanotte arriva davvero', () => {
  it('⛔ il protocollo rimandato entra in vigore, e il campo si azzera', async () => {
    const { service, scritture } = creaServizio([
      conBersaglio({ fastingTargetProtocol: '23:1', fastingTargetStartMin: H(19) }),
    ]);
    const esito = await service.passoNotturnoDigiuno();
    expect(esito).toMatchObject({ guardati: 1, protocolliApplicati: 1, arrivate: 1, falliti: 0 });
    expect(scritture[0].data).toMatchObject({
      fastingProtocol: '23:1',
      fastingStartMin: H(19),
      fastingTargetProtocol: null,
      fastingTargetStartMin: null,
    });
  });

  /**
   * ⛔ **L'ordine conta.** La finestra dei pasti si deriva da protocollo **e** orario: se il passo
   * sull'orario girasse prima di applicare il protocollo, per una notte i pasti sarebbero quelli
   * del protocollo vecchio — e quella notte è proprio il giorno in cui la cliente si aspetta il
   * cambio che ha chiesto ieri.
   */
  it('⛔ e la finestra è quella del protocollo NUOVO, non del vecchio', async () => {
    const { service, scritture } = creaServizio([
      conBersaglio({ fastingTargetProtocol: '23:1', fastingTargetStartMin: H(19) }),
    ]);
    await service.passoNotturnoDigiuno();
    // 23:1 = un pasto solo. Col 16:8 vecchio sarebbero stati tre.
    expect(scritture[0].data.fastingWindow).toBe('skip_all_but_dinner');
  });
});

describe('⛔ il piano graduale cammina da solo', () => {
  it('un passo per notte, e il bersaglio resta finché non ci arriva', async () => {
    const { service, scritture, audit } = creaServizio([
      conBersaglio({ fastingTargetStartMin: H(8) }),
    ]);
    const esito = await service.passoNotturnoDigiuno();
    expect(esito).toMatchObject({ passiFatti: 1, arrivate: 0 });
    expect(scritture[0].data).toMatchObject({
      fastingStartMin: H(11),          // un'ora più presto
      fastingTargetStartMin: H(8),     // ⚠️ il bersaglio RESTA: domani si fa un altro passo
    });
    expect(audit[0]).toMatchObject({ action: 'digiuno.passo_notturno' });
    expect(audit[0].metadata).toMatchObject({ da: H(12), a: H(11), arrivata: false });
  });

  it('l\'ultima notte ci arriva esatta e azzera il bersaglio', async () => {
    const { service, scritture, audit } = creaServizio([
      conBersaglio({ fastingStartMin: H(9), fastingTargetStartMin: H(8, 30) }),
    ]);
    const esito = await service.passoNotturnoDigiuno();
    expect(esito).toMatchObject({ arrivate: 1 });
    expect(scritture[0].data).toMatchObject({ fastingStartMin: H(8, 30), fastingTargetStartMin: null });
    expect(audit[0].metadata).toMatchObject({ arrivata: true });
  });

  /**
   * ⚠️ Quattro notti di fila, come le ha promesse la pagina: il piano si esegue da sé e il numero
   * combacia con quello che la cliente ha letto quando ha confermato.
   */
  it('⚠️ quattro notti di fila portano da 12:00 a 08:00', async () => {
    let inizio = H(12);
    for (let notte = 0; notte < 4; notte += 1) {
      const { service, scritture } = creaServizio([
        conBersaglio({ fastingStartMin: inizio, fastingTargetStartMin: H(8) }),
      ]);
      await service.passoNotturnoDigiuno();
      inizio = scritture[0].data.fastingStartMin as number;
    }
    expect(inizio).toBe(H(8));
  });
});

describe('quello che non si tocca, e quello che non ferma il giro', () => {
  it('chi non ha nessun bersaglio non viene nemmeno letto', async () => {
    const { service, scritture, prisma } = creaServizio([]);
    const esito = await service.passoNotturnoDigiuno();
    expect(esito.guardati).toBe(0);
    expect(scritture).toHaveLength(0);
    // ⚠️ La query chiede solo chi ha qualcosa da fare: il giro non legge tutte le clienti.
    expect(prisma.clientProfile.findMany.mock.calls[0][0].where.OR).toHaveLength(2);
  });

  /**
   * ⛔ Un bersaglio su un profilo **senza orologio** (protocollo mai impostato, o valore fuori
   * tabella) non si può avvicinare a niente. Si azzera, invece di far ricomparire quella cliente
   * ogni notte per sempre in un giro che non può concludere.
   */
  it('⛔ un bersaglio senza orologio si pulisce invece di restare lì per sempre', async () => {
    const { service, scritture } = creaServizio([
      conBersaglio({ fastingProtocol: null, fastingStartMin: null, fastingTargetStartMin: H(8) }),
    ]);
    await service.passoNotturnoDigiuno();
    expect(scritture[0].data).toEqual({ fastingTargetStartMin: null, fastingTargetProtocol: null });
  });

  /**
   * ⛔ **Una cliente storta non ferma le altre.** È il giro della notte: se salta a metà, tutte
   * quelle dopo restano ferme e nessuno se ne accorge fino alla mattina.
   */
  it('⛔ un profilo che esplode si conta e si prosegue', async () => {
    const { service, scritture, prisma } = creaServizio([
      conBersaglio({ userId: 'rotta', fastingTargetStartMin: H(8) }),
      conBersaglio({ userId: 'sana', fastingTargetStartMin: H(8) }),
    ]);
    const errore = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.$transaction.mockImplementationOnce(async () => { throw new Error('DB giù'); });
    const esito = await service.passoNotturnoDigiuno();
    expect(esito).toMatchObject({ guardati: 2, falliti: 1, passiFatti: 1 });
    expect(scritture.map((s) => s.userId)).toEqual(['sana']);
    // ⚠️ E non in silenzio: resta scritto nei log.
    expect(errore).toHaveBeenCalled();
    errore.mockRestore();
  });
});
