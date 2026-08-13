/**
 * L'INVITO ALLA RI-DOMANDA: a chi parte, a chi no, e quante volte.
 *
 * Le cose che si sbagliano in silenzio, qui, sono tre:
 *
 *  1. **mandarla due volte** — non c'è un flag «già chiesto», c'è la notifica stessa. Se il filtro
 *     sbaglia, la stessa persona riceve la stessa domanda ogni volta che gira lo script;
 *  2. ⚠️ **mandarla a chi la scheda in home sta già intercettando** (13/8): due strade per la
 *     stessa domanda, e la seconda insegna a ignorare le notifiche;
 *  3. **il payload**: `title` e `body` non sono colonne, e nella push viaggiano solo stringhe.
 */
import { TIPO_NOTIFICA_ALLERGIE, invitaARidichiarare, testoNotifica } from './campagna-allergie';

function finto(gia: { id: string } | null = null) {
  const prisma: any = {
    clientProfile: { findUnique: jest.fn() },
    notification: {
      findFirst: jest.fn().mockResolvedValue(gia),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return prisma;
}

describe('a chi parte', () => {
  it('all intolleranza ignota: la scheda in home chiede le allergie, non questa', async () => {
    const prisma = finto();
    const e = await invitaARidichiarare(prisma, 'c1', 'intolleranza_ignota');
    expect(e.esito).toBe('inviata');
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('alle allergie da codificare: la scheda in home aggiunge, non traduce', async () => {
    const prisma = finto();
    expect((await invitaARidichiarare(prisma, 'c1', 'allergie_da_codificare')).esito).toBe('inviata');
  });

  it('⚠️ e NON a chi non ha mai risposto: quella la prende la scheda in home (13/8)', async () => {
    const prisma = finto();
    const e = await invitaARidichiarare(prisma, 'c1', 'mai_risposto');
    expect(e.esito).toBe('fuori_campagna');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('⚠️ una volta sola, e per sempre', () => {
  it('se la notifica c è già, non se ne manda un altra', async () => {
    const prisma = finto({ id: 'n-1' });
    const e = await invitaARidichiarare(prisma, 'c1', 'intolleranza_ignota');
    expect(e.esito).toBe('gia_chiesta');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('⚠️ ma il «già chiesto» è per MOTIVO: un altra domanda ha diritto alla sua notifica', async () => {
    const prisma = finto();
    await invitaARidichiarare(prisma, 'c1', 'allergie_da_codificare');
    const dove = prisma.notification.findFirst.mock.calls[0][0].where;
    expect(dove.AND).toContainEqual({ payload: { path: ['motivo'], equals: 'allergie_da_codificare' } });
  });

  it('la prova non scrive niente, e lo dice lo stesso', async () => {
    const prisma = finto();
    const e = await invitaARidichiarare(prisma, 'c1', 'intolleranza_ignota', { prova: true });
    expect(e.esito).toBe('inviata');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('il payload', () => {
  it('⚠️ titolo e corpo stanno DENTRO il payload, non sono colonne', async () => {
    const prisma = finto();
    await invitaARidichiarare(prisma, 'c1', 'intolleranza_ignota');
    const riga = prisma.notification.create.mock.calls[0][0].data;
    expect(riga.title).toBeUndefined();
    expect(riga.payload.title).toBeTruthy();
    expect(riga.type).toBe(TIPO_NOTIFICA_ALLERGIE);
  });

  it('⚠️ e le chiavi che viaggiano nella push sono TUTTE stringhe', async () => {
    const prisma = finto();
    await invitaARidichiarare(prisma, 'c1', 'allergie_da_codificare');
    const p = prisma.notification.create.mock.calls[0][0].data.payload;
    for (const chiave of ['kind', 'clientId', 'counterpart']) {
      expect(typeof p[chiave]).toBe('string');
      expect(p[chiave].length).toBeGreaterThan(0);
    }
    expect(p.counterpart).toBe('ai');
  });

  it('⚠️ e nel titolo non c è nessun dato sanitario: si legge sulla schermata di blocco', () => {
    for (const m of ['intolleranza_ignota', 'allergie_da_codificare'] as const) {
      const { title, body } = testoNotifica(m);
      expect(title.length).toBeGreaterThan(5);
      expect(body).toMatch(/chat/i);
    }
  });
});
