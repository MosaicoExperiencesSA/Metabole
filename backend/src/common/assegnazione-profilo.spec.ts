import { agganciaAssegnazioneAlProfilo } from './assegnazione-profilo';

/**
 * ⛔ **IL PONTE LEAD→PROFILO, E LA RISERVA CHE NON DEVE CHIUDERLO.**
 *
 * Il ponte del 6/8 «riempie solo il vuoto». Dal 4/9 il vuoto lo riempie la coach di riserva: se il
 * ponte la trattasse come una coach scelta, la coach che accetta il lead troverebbe la scheda già
 * presa e **non scriverebbe niente** — il difetto del 6/8 riaperto dalla regola nuova. Queste prove
 * tengono fermo che la riserva, e SOLO la riserva, si può sostituire.
 */

function prismaFinto(scheda: { assignedCoachId: string | null; assignedNutritionistId: string | null } | null, riserva: string | null) {
  return {
    configParam: { findUnique: jest.fn().mockResolvedValue(riserva === null ? null : { value: riserva }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(scheda),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('agganciaAssegnazioneAlProfilo', () => {
  it('riempie il vuoto, e crea la scheda se manca', async () => {
    const p = prismaFinto(null, 'st-giusy');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-x' })).toBe('creato');
    expect(p.clientProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedCoachId: 'st-x' }) }));
  });

  it('⛔ una coach VERA in scheda non si sovrascrive mai, come dal 6/8', async () => {
    const p = prismaFinto({ assignedCoachId: 'st-sua', assignedNutritionistId: null }, 'st-giusy');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-x' })).toBe('gia_assegnato');
    expect(p.clientProfile.update).not.toHaveBeenCalled();
  });

  /** ⛔ Il caso che la revisione avversariale ha trovato: la coach accetta il lead il giorno dopo il giro notturno. */
  it('⛔ la RISERVA in scheda invece si sostituisce: la coach che accetta il lead entra', async () => {
    const p = prismaFinto({ assignedCoachId: 'st-giusy', assignedNutritionistId: null }, 'st-giusy');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-x' })).toBe('completato');
    expect(p.clientProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedCoachId: 'st-x' } }));
  });

  it('⚠️ con la regola spenta la stessa scheda è di una coach vera, e resta sua', async () => {
    const p = prismaFinto({ assignedCoachId: 'st-giusy', assignedNutritionistId: null }, 'off');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-x' })).toBe('gia_assegnato');
    expect(p.clientProfile.update).not.toHaveBeenCalled();
  });

  it('⚠️ la riserva sopra la riserva non scrive niente (il giro notturno non fa doppioni)', async () => {
    const p = prismaFinto({ assignedCoachId: 'st-giusy', assignedNutritionistId: null }, 'st-giusy');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-giusy' })).toBe('gia_assegnato');
    expect(p.clientProfile.update).not.toHaveBeenCalled();
    // E il parametro non si legge nemmeno: la domanda «è la riserva?» nasce solo se c'è qualcuno da sostituire.
    expect(p.configParam.findUnique).not.toHaveBeenCalled();
  });

  it('⚠️ sul vuoto il parametro non si legge', async () => {
    const p = prismaFinto({ assignedCoachId: null, assignedNutritionistId: null }, 'st-giusy');
    expect(await agganciaAssegnazioneAlProfilo(p as never, 'u1', { assignedCoachId: 'st-x' })).toBe('completato');
    expect(p.configParam.findUnique).not.toHaveBeenCalled();
  });
});
