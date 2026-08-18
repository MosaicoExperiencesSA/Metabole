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
    // ⚠️ Le due righe di chiusura dei doppioni (voce 224): una c'è in pagina, l'altra no.
    { chiave: 'doppione-in-pagina', titolo: 'Doppione da chiudere', dettaglio: 'x', categoria: 'Manutenzione', ordine: 900, fatta: true, soloSeEsiste: true },
    { chiave: 'doppione-inesistente', titolo: 'Doppione che non c\'è', dettaglio: 'x', categoria: 'Manutenzione', ordine: 901, fatta: true, soloSeEsiste: true },
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
          // Identica al file: niente da segnalare.
          { id: 'l1', chiave: 'aperta-e-finita', fatto: false, titolo: 'Lavoro finito nel file', dettaglio: 'x' },
          // ⚠️ In pagina c'è il DETTAGLIO VECCHIO: il file l'ha riscritto e la pagina non lo sa.
          { id: 'l2', chiave: 'gia-spuntata', fatto: true, titolo: 'Già chiusa in pagina', dettaglio: 'testo vecchio' },
          // Il doppione rimasto in pagina il 13/8: aperto, con un testo suo che non interessa a nessuno.
          { id: 'l3', chiave: 'doppione-in-pagina', fatto: false, titolo: 'tutt\'altro titolo', dettaglio: 'tutt\'altro' },
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

  /**
   * ⚠️ IL TESTO NON SI RISCRIVE, MA SI DICE (18/8, dalla domanda di Simone «la lista lavori la stai
   * tenendo allineata?»). Il file è allineato, la pagina no: una voce riscritta nel file — succede a
   * ogni volta che si scopre la causa vera — in pagina resta com'era, e chi legge crede di leggere
   * l'ultima parola.
   */
  it('dice quali voci in pagina hanno un testo più vecchio del file', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.testiCambiati.map((t) => t.titolo)).toEqual(['Già chiusa in pagina']);
  });

  it('⚠️ e non le riscrive: segnalarle non è aggiornarle', async () => {
    await service.caricaVociIniziali(true);
    const scritture = (prisma.lavoro.update as jest.Mock).mock.calls.map((c) => c[0]);
    for (const s of scritture) {
      expect(s.data.titolo).toBeUndefined();
      expect(s.data.dettaglio).toBeUndefined();
    }
  });

  it('una voce identica fra file e pagina non compare fra i testi cambiati', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.testiCambiati.map((t) => t.titolo)).not.toContain('Lavoro finito nel file');
  });

  it('spunta le voci esistenti che il file dichiara finite', async () => {
    const esito = await service.caricaVociIniziali(true);
    expect(prisma.lavoro.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ fatto: true }) }),
    );
    // 2 e non 1: dal 18/8 il file porta anche le righe che chiudono i doppioni (`soloSeEsiste`),
    // e anche quelle sono spunte — solo su voci che in pagina ci sono già.
    expect(esito.spuntate).toBe(2);
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
    expect(esito.chiuse).toEqual([
      { titolo: 'Lavoro finito nel file', categoria: 'Da fare — codice' },
      { titolo: 'Doppione da chiudere', categoria: 'Manutenzione' },
    ]);
  });

  it('in prova non scrive niente, ma dice cosa spunterebbe', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(prisma.lavoro.update).not.toHaveBeenCalled();
    expect(prisma.lavoro.create).not.toHaveBeenCalled();
    expect(esito.spuntate).toBe(2);
    // ⚠️ 2 e non 3: il doppione che in pagina non c'è NON viene contato fra le aggiunte, perché
    // non verrebbe creato.
    expect(esito.aggiunte).toBe(2);
  });

  /**
   * ⚠️ LE RIGHE `soloSeEsiste` (voce 224). Il 13/8 le voci di Vera sono finite due volte nel file,
   * con chiavi diverse per le stesse cose. Il doppione è stato tolto dal file, ma se il caricamento
   * era già girato in mezzo quelle righe sono rimaste in PAGINA, aperte.
   *
   * Marcarle `fatta: true` e basta non bastava: se in pagina non ci fossero, il caricamento le
   * **creerebbe** — tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura.
   */
  describe('⚠️ le righe che chiudono un doppione: spuntano se c\'è, non creano se non c\'è', () => {
    it('quella presente in pagina viene spuntata', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.chiuse.map((c) => c.titolo)).toContain('Doppione da chiudere');
    });

    it('⚠️ quella che in pagina non c\'è NON viene creata', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.titoli.map((c) => c.titolo)).not.toContain('Doppione che non c\'è');
    });

    it('⚠️ e nemmeno scrivendo davvero: nessun `create` con quella chiave', async () => {
      await service.caricaVociIniziali(true);
      const chiaviCreate = prisma.lavoro.create.mock.calls.map((c: any) => c[0].data.chiave);
      expect(chiaviCreate).not.toContain('doppione-inesistente');
      expect(chiaviCreate).toContain('nuova-aperta');
    });

    /** Il loro testo non è una voce di lavoro: elencarlo fra «i testi cambiati» sarebbe rumore. */
    it('non compaiono fra i testi da allineare, anche se in pagina dicono tutt\'altro', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.testiCambiati.map((x) => x.titolo)).not.toContain('Doppione da chiudere');
    });
  });
});
