import { RigaAudit, RigaAzioneVera, RigaFoodSwap, unisciRegistro } from './registro-allargato';

const D = (iso: string) => new Date(iso);
const NOMI = new Map([['c1', 'Giulia Rossi'], ['c2', 'Anna Bianchi']]);

const azione = (over: Partial<RigaAzioneVera> = {}): RigaAzioneVera => ({
  id: 'a1',
  createdAt: D('2026-08-13T10:00:00Z'),
  azione: 'restrizione_cliente',
  soggettoId: 'c1',
  soggettoNome: 'Giulia Rossi',
  frase: 'a Giulia niente tonno',
  stato: 'attiva',
  dettaglio: { termini: ['tonno'] },
  ...over,
});

const audit = (over: Partial<RigaAudit> = {}): RigaAudit => ({
  id: 'l1',
  createdAt: D('2026-08-13T11:00:00Z'),
  action: 'profile.update',
  entityId: 'c1',
  metadata: { origine: 'app', campi: [{ campo: 'dislikedFoods' }] },
  ...over,
});

const swap = (over: Partial<RigaFoodSwap> = {}): RigaFoodSwap => ({
  id: 's1',
  ultimaVoltaIl: D('2026-08-13T09:00:00Z'),
  clientId: 'c2',
  fromFood: 'pollo',
  toFood: 'tacchino',
  origine: 'chat',
  stato: 'da_verificare',
  dishName: null,
  ...over,
});

describe('unisciRegistro', () => {
  it('mette insieme le tre fonti, dalla più recente', () => {
    const voci = unisciRegistro([azione()], [audit()], [swap()], NOMI);
    expect(voci.map((v) => v.fonte)).toEqual(['audit', 'azione_vera', 'food_swap']);
  });

  it('⚠️ distingue chi ha fatto la modifica: la cliente dall’app non è lo staff', () => {
    // Confonderli vorrebbe dire attribuire alla nutrizionista una cosa che ha fatto la cliente — e
    // quella colonna esiste proprio per non doverlo indovinare.
    const voci = unisciRegistro(
      [],
      [audit({ metadata: { origine: 'app', campi: [{ campo: 'dislikedFoods' }] } }), audit({ id: 'l2', action: 'client.update', metadata: { campi: [{ campo: 'intolerances' }] } })],
      [],
      NOMI,
    );
    expect(voci.find((v) => v.id === 'l1')?.origine).toBe('cliente');
    expect(voci.find((v) => v.id === 'l2')?.origine).toBe('staff');
  });

  it('una sostituzione concordata in chat è di Gaia, una scritta a mano è dello staff', () => {
    const voci = unisciRegistro([], [], [swap({ origine: 'chat' }), swap({ id: 's2', origine: 'manuale' })], NOMI);
    expect(voci.find((v) => v.id === 's1')?.origine).toBe('gaia');
    expect(voci.find((v) => v.id === 's2')?.origine).toBe('staff');
  });

  it('⚠️ solo le righe dell’assistente sono annullabili', () => {
    // Annullare da questa pagina una modifica fatta dalla cliente sul suo profilo vorrebbe dire
    // disfare una cosa che ha deciso lei, da una schermata che non è la sua.
    const voci = unisciRegistro([azione()], [audit()], [swap()], NOMI);
    expect(voci.filter((v) => v.annullabile).map((v) => v.fonte)).toEqual(['azione_vera']);
  });

  it('una riga già annullata non si annulla di nuovo', () => {
    const voci = unisciRegistro([azione({ stato: 'annullata' })], [], [], NOMI);
    expect(voci[0].annullabile).toBe(false);
  });

  it('mette il nome della cliente anche dove la fonte ha solo l’id', () => {
    // Senza, metà delle righe direbbe «su un id»: è il modo di rendere illeggibile proprio la
    // colonna che si guarda.
    const voci = unisciRegistro([], [audit()], [swap()], NOMI);
    expect(voci.find((v) => v.fonte === 'audit')?.suChi).toBe('Giulia Rossi');
    expect(voci.find((v) => v.fonte === 'food_swap')?.suChi).toBe('Anna Bianchi');
  });

  it('scarta le azioni di audit che non raccontano un cambiamento', () => {
    // `client.detail.view` dice che qualcuno ha aperto una scheda: in un registro di cosa è
    // cambiato è rumore, e il rumore fa smettere di leggere.
    const voci = unisciRegistro([], [audit({ action: 'client.detail.view' }), audit({ id: 'l3' })], [], NOMI);
    expect(voci).toHaveLength(1);
    expect(voci[0].id).toBe('l3');
  });

  it('racconta i campi cambiati, non solo «modificato»', () => {
    const voci = unisciRegistro([], [audit()], [], NOMI);
    expect(voci[0].cosa).toContain('dislikedFoods');
  });

  it('rispetta il limite', () => {
    const molte = Array.from({ length: 50 }, (_, i) => azione({ id: `a${i}` }));
    expect(unisciRegistro(molte, [], [], NOMI, 10)).toHaveLength(10);
  });
});
