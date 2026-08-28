import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { ClientsService } from './clients.service';

/**
 * ⛔ **UNA COACH POTEVA METTERE CHIUNQUE A DIGIUNO INTERMITTENTE.**
 *
 * Il cambio del tipo di dieta è protetto dal permesso `change_diet_type` dal 13/8, ma l'elenco dei
 * campi protetti conteneva **solo** `regime`, `dietStyle` e `dietFamily`. `pathType` e `mealsPerDay`
 * no — e sono i due che decidono se una cliente fa tre pasti, cinque, o **digiuno intermittente**.
 *
 * ⚠️ Cioè: una coach non poteva passare una cliente da vegetariana a vegana, ma poteva metterla a
 * digiuno. Delle tre è la modifica più clinica: cambia quanti pasti mangia al giorno, e il digiuno
 * ha controindicazioni che le altre due non hanno.
 *
 * ⛔ **Perché il difetto è sopravvissuto settimane**: gli elenchi erano **tre** — il DTO,
 * `PROFILE_FIELDS` e `DIET_TYPE_FIELDS` — e i due campi erano nei primi due. Aggiungere un campo
 * alla scheda senza aggiungerlo alla guardia non rompe niente e non si vede. Adesso l'elenco è uno
 * solo e da lì si derivano la lettura, il prima/dopo e il controllo.
 */
const servizio = (permesso: boolean, profilo: Record<string, unknown> = {}) => {
  const prisma = {
    user: {
      // ⚠️ La stessa `findUnique` risponde per DUE domande diverse — «chi è la cliente» e «che ruolo
      // ha chi sta scrivendo» — e un finto che risponde sempre uguale le confonde: con `role:
      // 'coach'` su tutti, `updateClient` rifiuta prima ancora di arrivare al permesso.
      findUnique: jest.fn().mockImplementation(({ where }: never) =>
        Promise.resolve(
          (where as { id: string }).id === 'u1' ? { id: 'u1', role: 'client' } : { id: 'coach-1', role: 'coach' },
        ),
      ),
      update: jest.fn().mockReturnValue({ op: 'user.update' }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
        pathType: 'five', mealsPerDay: 5, fastingWindow: null, ...profilo,
      }),
      upsert: jest.fn().mockReturnValue({ op: 'profile.upsert' }),
    },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: permesso }) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as never;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const menu = { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const s = new ClientsService(prisma, {} as never, audit as never, {} as never, menu as never, {} as never, {} as never, {} as never, {} as never);
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  return { s, audit, menu, prisma: prisma as unknown as Record<string, { [k: string]: jest.Mock }> };
};

describe('⛔ i pasti e il digiuno stanno sotto «Cambia tipo di dieta»', () => {
  it.each([
    ['il digiuno intermittente', { pathType: 'intermittent_fasting' }],
    ['il numero di pasti', { mealsPerDay: 3 }],
  ])('⛔ senza il permesso non si cambia %s', async (_nome, campi) => {
    const { s, prisma } = servizio(false);
    await expect(s.updateClient('u1', 'coach-1', campi as never)).rejects.toThrow(ForbiddenException);
    // ⚠️ E non si scrive niente: un rifiuto che lascia dietro una scrittura è peggio di nessun rifiuto.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Il messaggio nomina i campi che sono cambiati davvero, tutti.** «Cambiare il tipo di dieta»
   * davanti a chi ha appena spostato i pasti sembra un guasto, non un permesso — e nominarne uno solo
   * quando ne ha toccati due nasconde metà del gesto.
   */
  it('⚠️ e il messaggio dice cosa stava cambiando, uno per uno', async () => {
    const { s } = servizio(false);
    await expect(s.updateClient('u1', 'coach-1', { pathType: 'intermittent_fasting' } as never))
      .rejects.toThrow('il percorso (pasti / digiuno)');
    await expect(s.updateClient('u1', 'coach-1', { regime: 'vegan' } as never))
      .rejects.toThrow('il regime');
    // ⛔ Due insieme: nell'elenco ci sono tutt'e due, non solo l'ultimo trovato.
    const due = s.updateClient('u1', 'coach-1', { regime: 'vegan', mealsPerDay: 3 } as never);
    await expect(due).rejects.toThrow('il regime');
    await expect(s.updateClient('u1', 'coach-1', { regime: 'vegan', mealsPerDay: 3 } as never))
      .rejects.toThrow('il numero di pasti');
  });

  /**
   * ⛔ **LA `select` CHIESTA A PRISMA È L'ELENCO, non una copia.** Il finto ignora `select` e
   * risponde sempre con tutti i campi, quindi «da quell'unico elenco si deriva anche la lettura»
   * restava affermato solo a parole: rimettendo la vecchia `select` a tre campi la suite restava
   * verde. ⛔ E non è cosmetico: con una `select` corta, in produzione `current.pathType` sarebbe
   * `undefined`, quindi «diverso da quello che arriva» **sempre** — cioè un 403 a ogni salvataggio
   * di ogni scheda, per chi non ha il permesso.
   */
  it('⛔ i campi lettti dal profilo sono esattamente quelli protetti', async () => {
    const { s, prisma } = servizio(true);
    await s.updateClient('u1', 'nutri-1', { pathType: 'intermittent_fasting' } as never);
    const select = prisma.clientProfile.findUnique.mock.calls
      .map((c) => (c[0] as { select?: Record<string, boolean> }).select)
      .find((sel) => sel && 'pathType' in sel && 'regime' in sel);
    expect(select).toBeDefined();
    expect(Object.keys(select!).sort()).toEqual(
      ['dietFamily', 'dietStyle', 'mealsPerDay', 'pathType', 'regime'],
    );
  });

  it('⚠️ con il permesso si cambia, come per gli altri tre campi', async () => {
    const { s, prisma } = servizio(true);
    await s.updateClient('u1', 'nutri-1', { pathType: 'intermittent_fasting' } as never);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  /**
   * ⚠️ **Scrivere lo STESSO valore non è un cambiamento**, e non deve chiedere niente: altrimenti
   * salvare la scheda di una cliente già a cinque pasti sarebbe vietato a chi la scheda la gestisce
   * tutti i giorni.
   */
  it('⚠️ riscrivere lo stesso percorso non chiede nessun permesso', async () => {
    const { s, prisma } = servizio(false);
    await s.updateClient('u1', 'coach-1', { pathType: 'five', mealsPerDay: 5 } as never);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  /**
   * ⛔ **E i giorni futuri si rifanno.** È la seconda metà della correzione, ed è una conseguenza
   * voluta: una cliente portata da cinque pasti a tre si teneva i menu a cinque già consegnati —
   * lo schermo diceva una cosa e il piatto un'altra.
   */
  it('⛔ cambiare i pasti rifà i giorni futuri, come un cambio di dieta', async () => {
    const { s, menu, audit } = servizio(true);
    await s.updateClient('u1', 'nutri-1', { mealsPerDay: 3 } as never);
    expect(menu.redeliverFutureDays).toHaveBeenCalledWith('u1');
    const registro = audit.log.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(registro).toContain('client.diet_type.change');
  });

  /** ⚠️ E il prima/dopo nel registro nomina tutti e cinque i campi, non tre. */
  it('⚠️ il registro dice da cosa a cosa, per tutti i campi protetti', async () => {
    const { s, audit } = servizio(true);
    await s.updateClient('u1', 'nutri-1', { pathType: 'intermittent_fasting' } as never);
    const riga = audit.log.mock.calls.find((c) => (c[0] as { action: string }).action === 'client.diet_type.change');
    const meta = (riga![0] as { metadata: { before: Record<string, unknown>; after: Record<string, unknown> } }).metadata;
    expect(meta.before.pathType).toBe('five');
    expect(meta.after.pathType).toBe('intermittent_fasting');
    expect(meta.before.mealsPerDay).toBe(5);
    // ⛔ **Tutti e cinque**, non solo i due nuovi: filtrando via `dietFamily` dalla derivazione del
    // prima/dopo la suite restava verde, e il registro avrebbe perso un campo in silenzio.
    expect(Object.keys(meta.before).sort()).toEqual(
      ['dietFamily', 'dietStyle', 'mealsPerDay', 'pathType', 'regime'],
    );
    expect(Object.keys(meta.after).sort()).toEqual(Object.keys(meta.before).sort());
    // ⚠️ Quello che non è stato toccato resta uguale nei due lati: il registro non deve far sembrare
    // cambiato un campo che nessuno ha nominato.
    expect(meta.after.regime).toBe(meta.before.regime);
    expect(meta.after.dietFamily).toBe(meta.before.dietFamily);
    expect(meta.after.dietStyle).toBe(meta.before.dietStyle);
  });

  /**
   * ⚠️ **Tutto quello che è protetto dev'essere anche scrivibile.** Un campo in `DIET_TYPE_FIELDS`
   * ma fuori da `PROFILE_FIELDS` sarebbe una guardia davanti a una porta murata: chiederebbe un
   * permesso per una modifica che non arriva mai al database, e nessuno se ne accorgerebbe.
   * ⛔ Non tiene la direzione opposta — un campo nuovo scrivibile e non protetto resta possibile,
   * ed è esattamente com'era `pathType` — ma quella nessun test la può sapere: sta scritta nel DTO,
   * accanto ai due campi, perché la legga chi ne aggiunge un terzo.
   */
  it('⚠️ ogni campo protetto è anche fra quelli che la scheda scrive', async () => {
    const sorgente = readFileSync(join(__dirname, 'clients.service.ts'), 'utf8');
    const protetti = /const DIET_TYPE_FIELDS = \[([^\]]+)\]/.exec(sorgente)![1]
      .split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
    const scrivibili = /const PROFILE_FIELDS = \[([^\]]+)\]/.exec(sorgente)![1]
      .split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
    expect(protetti).toHaveLength(5);
    for (const campo of protetti) expect(scrivibili).toContain(campo);
  });

  /**
   * ⛔ **`null` esplicito non è «non l'ho mandato»**, e prima il prima/dopo li confondeva: scritto
   * con `??`, un `pathType: null` mandato apposta risultava «invariato» nel registro — cioè la riga
   * raccontava il contrario di quello che era successo.
   */
  it('⛔ togliere un campo si vede nel registro', async () => {
    const { s, audit } = servizio(true);
    await s.updateClient('u1', 'nutri-1', { pathType: null } as never);
    const riga = audit.log.mock.calls.find((c) => (c[0] as { action: string }).action === 'client.diet_type.change');
    const meta = (riga![0] as { metadata: { after: Record<string, unknown> } }).metadata;
    expect(meta.after.pathType).toBeNull();
  });
});
