import { EngineRulesService } from './engine-rules.service';

function build() {
  const prisma: any = {
    configParam: {
      findMany: jest.fn().mockResolvedValue([{ key: 'menu_kcal_balance_tolerance_pct', value: '18' }]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    rulePreset: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    ruleProposal: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rp1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rp1', ...data })),
    },
    productRule: { upsert: jest.fn().mockResolvedValue({}) },
    diet: { findUnique: jest.fn().mockResolvedValue({ id: 'diet1' }) },
  };
  const configParams = { update: jest.fn().mockResolvedValue({}) };
  const audit = { log: jest.fn() };
  const service = new EngineRulesService(prisma as any, configParams as any, audit as any);
  return { service, prisma, configParams };
}

describe('EngineRulesService', () => {
  it('catalog: unisce metadati e valore globale attuale (o default)', async () => {
    const { service } = build();
    const c = await service.catalog();
    const tol = c.rules.find((r) => r.code === 'menu_kcal_balance_tolerance_pct')!;
    expect(tol.global).toBe(18); // dal config_param
    expect(tol.isSet).toBe(true);
    const days = c.rules.find((r) => r.code === 'menu_days_delivered')!;
    expect(days.global).toBe(2); // default dal catalogo (non a DB)
    expect(days.isSet).toBe(false);
  });

  it('setGlobal: valida contro il catalogo (rifiuta fuori range)', async () => {
    const { service } = build();
    await expect(service.setGlobal('menu_kcal_balance_tolerance_pct', 999, 'u1')).rejects.toThrow();
  });

  it('setGlobal: parametro esistente → update (invalida cache); mancante → create', async () => {
    const { service, prisma, configParams } = build();
    prisma.configParam.findUnique.mockResolvedValueOnce({ key: 'menu_select_w_eff' }); // esiste
    await service.setGlobal('menu_select_w_eff', 1.5, 'u1');
    expect(configParams.update).toHaveBeenCalledWith('menu_select_w_eff', '1.5', 'u1');

    prisma.configParam.findUnique.mockResolvedValueOnce(null); // manca (soglia agente)
    await service.setGlobal('agent_plateau_cycles', 4, 'u1');
    expect(prisma.configParam.create).toHaveBeenCalled();
  });

  it('setGlobal boolean: coerce "true" → salva "true"', async () => {
    const { service, prisma, configParams } = build();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'menu_repeat_two_days_default' });
    await service.setGlobal('menu_repeat_two_days_default', 'true', 'u1');
    expect(configParams.update).toHaveBeenCalledWith('menu_repeat_two_days_default', 'true', 'u1');
  });

  it('createPreset: scarta codici regola non nel catalogo', async () => {
    const { service, prisma } = build();
    await service.createPreset(
      { style: 'keto', label: 'Test', rules: { menu_select_w_eff: 1.2, codice_finto: 5 } },
      'u1',
    );
    const data = prisma.rulePreset.create.mock.calls[0][0].data;
    expect(data.rules).toEqual({ menu_select_w_eff: 1.2 }); // niente codice_finto
    expect(data.suggested).toBe(false); // creata a mano = adottata
  });

  it('applyPresetToDiet: scrive un ProductRule per ogni regola del preset', async () => {
    const { service, prisma } = build();
    prisma.rulePreset.findUnique.mockResolvedValue({ id: 'p1', rules: { menu_repeat_two_days_default: true, menu_select_w_eff: 1.2 } });
    const res = await service.applyPresetToDiet('p1', 'diet1', 'u1');
    expect(res.applied).toBe(2);
    // boolean → enabled dal valore; numerico → enabled true + params.value
    const calls = prisma.productRule.upsert.mock.calls.map((c: any) => c[0]);
    const two = calls.find((c: any) => c.where.dietId_ruleCode.ruleCode === 'menu_repeat_two_days_default');
    expect(two.create.enabled).toBe(true);
    const eff = calls.find((c: any) => c.where.dietId_ruleCode.ruleCode === 'menu_select_w_eff');
    expect(eff.create.enabled).toBe(true);
    expect(eff.create.params).toEqual({ value: 1.2 });
  });

  it('createProposal: senza testo → errore; con testo → pending', async () => {
    const { service, prisma } = build();
    await expect(service.createProposal({ text: '' }, 'u1')).rejects.toThrow();
    await service.createProposal({ title: 'Cap carbo', text: 'Aggiungere tetto carboidrati in grammi' }, 'u1');
    const data = prisma.ruleProposal.create.mock.calls[0][0].data;
    expect(data.status).toBe('pending');
    expect(data.title).toBe('Cap carbo');
  });
});
