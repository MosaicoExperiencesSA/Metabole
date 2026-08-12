/**
 * «Al nutrizionista continuano a non arrivare le notifiche dei messaggi» (Simone, 12/8).
 *
 * La catena ha sei gradini e ognuno può rompersi in silenzio. Questi test sorvegliano la cosa che
 * rende utile la diagnosi: che dica **il primo** gradino rotto, non l'ultimo. Dire «non ci sono
 * telefoni registrati» a una cliente che non ha una nutrizionista assegnata manda a cercare nel
 * posto sbagliato, ed è il modo più rapido per perdere un pomeriggio.
 */
import { diagnosiAvvisoChat } from './diagnosi-avviso-chat';

const IERI = new Date('2026-08-11T10:00:00Z');

function prismaFinto(over: Record<string, unknown> = {}) {
  const base: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Patrizia',
        assignedCoach: { id: 's-c', displayName: 'Marta', userId: 'u-coach' },
        assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Rossi', userId: 'u-nutri' },
      }),
    },
    chatThread: { findUnique: jest.fn().mockResolvedValue({ id: 'th-1' }) },
    message: { findFirst: jest.fn().mockResolvedValue({ sentAt: IERI }) },
    notification: {
      count: jest.fn().mockResolvedValue(3),
      findFirst: jest.fn().mockResolvedValue({ scheduledFor: IERI }),
    },
    pushToken: { count: jest.fn().mockResolvedValue(1) },
    user: { findUnique: jest.fn().mockResolvedValue({ prefs: {} }) },
  };
  return Object.assign(base, over);
}

describe('la diagnosi dice il PRIMO gradino rotto', () => {
  it('tutto a posto: lo dice, e dice cosa guardare se comunque non arrivano', async () => {
    const d = await diagnosiAvvisoChat(prismaFinto(), 'c-1');
    expect(d.diagnosi).toContain('catena è completa');
    expect(d.diagnosi).toContain('Firebase');
    expect(d.notificheUltimi7Giorni).toBe(3);
    expect(d.assegnata).toEqual({ staffId: 's-n', nome: 'Dr.ssa Rossi', userId: 'u-nutri' });
  });

  it('⚠️ nessuna nutrizionista assegnata: è il primo gradino e vince su tutti', async () => {
    // È la causa più probabile della segnalazione: senza destinatario l'avviso non parte, e prima
    // di oggi non lo diceva nessuno.
    const p = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue({ name: 'Patrizia', assignedCoach: null, assignedNutritionist: null });
    const d = await diagnosiAvvisoChat(p, 'c-1');
    expect(d.diagnosi).toContain('Nessuna nutrizionista assegnata');
    expect(d.assegnata).toBeNull();
    // ⚠️ E non si va a interrogare il resto: senza utenza non c'è niente da contare.
    expect(p.notification.count).not.toHaveBeenCalled();
    expect(d.dispositivi).toBe(0);
  });

  it('scheda staff senza utenza: non c\'è un account a cui mandare niente', async () => {
    const p = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue({
      name: 'Patrizia', assignedCoach: null,
      assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Rossi', userId: null },
    });
    expect((await diagnosiAvvisoChat(p, 'c-1')).diagnosi).toContain('non è collegata a nessuna utenza');
  });

  it('la conversazione non c\'è ancora', async () => {
    const p = prismaFinto();
    p.chatThread.findUnique.mockResolvedValue(null);
    const d = await diagnosiAvvisoChat(p, 'c-1');
    expect(d.diagnosi).toContain('non è ancora stata aperta');
    expect(d.threadId).toBeNull();
  });

  it('⚠️ la cliente scrive a Gaia, non alla nutrizionista', async () => {
    // Caso frequentissimo e facile da scambiare per un guasto: la conversazione esiste, ma lì
    // dentro la cliente non ha mai scritto. L'avviso parte solo dai messaggi scritti in QUEL thread.
    const p = prismaFinto();
    p.message.findFirst.mockResolvedValue(null);
    const d = await diagnosiAvvisoChat(p, 'c-1');
    expect(d.diagnosi).toContain('non ha mai scritto in questa conversazione');
    expect(d.diagnosi).toContain('Gaia');
  });

  it('ha scritto ma nessun avviso è stato scritto: il problema è a monte della consegna', async () => {
    const p = prismaFinto();
    p.notification.count.mockResolvedValue(0);
    expect((await diagnosiAvvisoChat(p, 'c-1')).diagnosi).toContain('nella scrittura dell\'avviso');
  });

  it('⚠️ avvisi scritti ma nessun telefono: la campanella li ha, la push no', async () => {
    // È la distinzione che Simone chiedeva di verificare: la riga resta salvata anche quando la
    // push non può partire, e sono due problemi diversi con due rimedi diversi.
    const p = prismaFinto();
    p.pushToken.count.mockResolvedValue(0);
    const d = await diagnosiAvvisoChat(p, 'c-1');
    expect(d.diagnosi).toContain('nessun telefono registrato');
    expect(d.diagnosi).toContain('campanella');
  });

  it('la coach si guarda con la stessa chiamata', async () => {
    const p = prismaFinto();
    const d = await diagnosiAvvisoChat(p, 'c-1', 'coach');
    expect(d.controparte).toBe('coach');
    expect(d.assegnata?.userId).toBe('u-coach');
    expect(p.chatThread.findUnique.mock.calls[0][0].where.clientId_counterpart.counterpart).toBe('coach');
  });

  it('un\'utenza senza profilo cliente non fa cadere niente', async () => {
    const p = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue(null);
    expect((await diagnosiAvvisoChat(p, 'c-1')).diagnosi).toContain('non ha un profilo cliente');
  });

  it('riporta i tipi che quella persona ha disattivato dal profilo', async () => {
    const p = prismaFinto();
    p.user.findUnique.mockResolvedValue({ prefs: { notificationsDisabled: ['escalation_clinical'] } });
    expect((await diagnosiAvvisoChat(p, 'c-1')).disattivati).toEqual(['escalation_clinical']);
  });

  it('⚠️ non manda e non scrive niente: è una lettura', async () => {
    const p = prismaFinto();
    await diagnosiAvvisoChat(p, 'c-1');
    for (const tabella of Object.values(p) as any[]) {
      expect(tabella.create).toBeUndefined();
      expect(tabella.update).toBeUndefined();
    }
  });
});
