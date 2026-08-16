/**
 * Il caricamento delle voci — con l'AGGIORNAMENTO DELLO STATO (richiesta di Simone, 13/8 sera):
 * «quando carica le voci nuove, in quelle vecchie se aggiorna lo stato è molto meglio».
 *
 * La regola è a SENSO UNICO: il file può CHIUDERE una voce ancora aperta in pagina, mai riaprirne
 * una spuntata. La pagina resta lo stato vivo; il file porta solo la notizia «questa è finita».
 */
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LavoriService } from './lavori.service';

jest.mock('./voci-iniziali', () => ({
  VOCI_INIZIALI: [
    { chiave: 'aperta-e-finita', titolo: 'Lavoro finito nel file', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 1, fatta: true },
    { chiave: 'gia-spuntata', titolo: 'Già chiusa in pagina', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 2 },
    { chiave: 'nuova-gia-chiusa', titolo: 'Nasce già spuntata', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 3, fatta: true },
    { chiave: 'nuova-aperta', titolo: 'Nasce aperta', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 4 },
  ],
}));

describe('LavoriService.caricaVociIniziali — lo stato viaggia col file', () => {
  let service: LavoriService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lavoro: {
        // In pagina esistono le prime due: una aperta (che il file dichiara finita) e una già spuntata.
        findMany: jest.fn().mockResolvedValue([
          { id: 'l1', chiave: 'aperta-e-finita', fatto: false },
          { id: 'l2', chiave: 'gia-spuntata', fatto: true },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'nuovo' }),
        update: jest.fn().mockResolvedValue({ id: 'l1' }),
      },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [LavoriService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LavoriService);
  });

  it('spunta le voci esistenti che il file dichiara finite', async () => {
    const esito = await service.caricaVociIniziali(true);
    expect(prisma.lavoro.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ fatto: true }) }),
    );
    expect(esito.spuntate).toBe(1);
  });

  it('MAI riaprire: una voce spuntata in pagina resta spuntata anche se il file la dà aperta', async () => {
    await service.caricaVociIniziali(true);
    const riaperture = (prisma.lavoro.update as jest.Mock).mock.calls.filter(
      (c: any[]) => c[0]?.data?.fatto === false,
    );
    expect(riaperture).toHaveLength(0);
  });

  it('una voce nuova con fatta:true nasce già spuntata; `fatta` non finisce in banca dati', async () => {
    await service.caricaVociIniziali(true);
    const create = (prisma.lavoro.create as jest.Mock).mock.calls.map((c: any[]) => c[0].data);
    const chiusa = create.find((d: any) => d.chiave === 'nuova-gia-chiusa');
    const aperta = create.find((d: any) => d.chiave === 'nuova-aperta');
    expect(chiusa.fatto).toBe(true);
    expect(chiusa.fatta).toBeUndefined(); // il campo del file non è una colonna
    expect(aperta.fatto ?? false).toBe(false);
  });

  /**
   * ⚠️ Il difetto trovato il 14/8 sera: la pagina mostrava il pulsante «Conferma» solo se c'era
   * qualcosa da AGGIUNGERE. Nella serata delle tre consegne non c'era niente di nuovo e c'erano
   * tre voci da spuntare: il pulsante non compariva, e la spunta si è dovuta fare dalla shell di
   * Render. Perché la pagina possa dire COSA spunterebbe, qui devono uscire i titoli, non le chiavi.
   */
  it('dice quali voci spunterebbe, col titolo che si legge in pagina', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.chiuse).toEqual([{ titolo: 'Lavoro finito nel file', categoria: 'Da fare — codice' }]);
  });

  it('in prova non scrive niente, ma dice cosa spunterebbe', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(prisma.lavoro.update).not.toHaveBeenCalled();
    expect(prisma.lavoro.create).not.toHaveBeenCalled();
    expect(esito.spuntate).toBe(1);
    expect(esito.aggiunte).toBe(2);
  });
});
