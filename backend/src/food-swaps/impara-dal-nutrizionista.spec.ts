/**
 * Dalla frase in chat alla riga in tabella. Qui si sorveglia CHI può insegnare, e con che stato
 * entra quello che ha insegnato.
 */
import { imparaDalNutrizionista } from './impara-dal-nutrizionista';

const prismaFinto = () => ({
  foodSwap: { upsert: jest.fn().mockResolvedValue({ id: 'fs-1', volte: 1 }) },
});

const FRASE = 'Sostituisci il pollo con il tacchino.';

describe('imparaDalNutrizionista', () => {
  it('la frase della nutrizionista diventa una riga', async () => {
    const p: any = prismaFinto();
    const n = await imparaDalNutrizionista(p, {
      clientId: 'c-1', autoreRuolo: 'nutritionist', autoreId: 'u-n', testo: FRASE,
    });
    expect(n).toBe(1);
    const scritta = p.foodSwap.upsert.mock.calls[0][0].create;
    expect(scritta.fromFood).toMatch(/pollo/i);
    expect(scritta.toFood).toMatch(/tacchino/i);
    expect(scritta.clientId).toBe('c-1');
  });

  it('⚠️ nasce «da_verificare» anche se l\'ha detto lei', async () => {
    // Quello che va verificato non è la sua decisione: è la LETTURA che ne ha fatto il programma.
    // Segnarla verificata vorrebbe dire far entrare nella memoria di Gaia, con l'autorevolezza di
    // una regola clinica, una riga che nessuno ha mai riletto.
    const p: any = prismaFinto();
    await imparaDalNutrizionista(p, { clientId: 'c-1', autoreRuolo: 'nutritionist', testo: FRASE });
    const scritta = p.foodSwap.upsert.mock.calls[0][0].create;
    expect(scritta.stato).toBe('da_verificare');
    expect(scritta.origine).toBe('nutrizionista');
  });

  it('⚠️ si porta dietro la frase esatta: senza, confermare vuol dire ritrovare il messaggio', async () => {
    const p: any = prismaFinto();
    await imparaDalNutrizionista(p, {
      clientId: 'c-1', autoreRuolo: 'nutritionist', testo: FRASE, quando: new Date('2026-08-12T10:00:00Z'),
    });
    const nota = p.foodSwap.upsert.mock.calls[0][0].create.nota as string;
    expect(nota).toContain('Sostituisci il pollo con il tacchino');
    expect(nota).toContain('12/08');
  });

  it('⚠️ la STESSA frase scritta dalla cliente non insegna niente', async () => {
    // «Posso mangiare il tacchino al posto del pollo» è una richiesta, non un permesso. Trattarla
    // come una regola vorrebbe dire lasciare che si autorizzi da sola scrivendo nella chat giusta.
    const p: any = prismaFinto();
    const n = await imparaDalNutrizionista(p, {
      clientId: 'c-1', autoreRuolo: 'client', testo: FRASE,
    });
    expect(n).toBe(0);
    expect(p.foodSwap.upsert).not.toHaveBeenCalled();
  });

  it('nemmeno dalla coach: non è una decisione clinica sua', async () => {
    const p: any = prismaFinto();
    expect(await imparaDalNutrizionista(p, { clientId: 'c-1', autoreRuolo: 'coach', testo: FRASE })).toBe(0);
  });

  it('il capo nutrizionista sì', async () => {
    const p: any = prismaFinto();
    expect(await imparaDalNutrizionista(p, { clientId: 'c-1', autoreRuolo: 'head_nutritionist', testo: FRASE })).toBe(1);
  });

  it('⚠️ nessun piatto: una frase in chat non dice in quale ricetta vale', async () => {
    // Scriverne uno a caso spezzerebbe il conteggio con la riga giusta: il piatto sta nella chiave.
    const p: any = prismaFinto();
    await imparaDalNutrizionista(p, { clientId: 'c-1', autoreRuolo: 'nutritionist', testo: FRASE });
    expect(p.foodSwap.upsert.mock.calls[0][0].create.recipeId).toBeNull();
  });

  it('un messaggio senza sostituzioni non scrive niente', async () => {
    const p: any = prismaFinto();
    const n = await imparaDalNutrizionista(p, {
      clientId: 'c-1', autoreRuolo: 'nutritionist', testo: 'Ciao Patrizia, ottimi risultati questa settimana!',
    });
    expect(n).toBe(0);
    expect(p.foodSwap.upsert).not.toHaveBeenCalled();
  });

  it('due sostituzioni nello stesso messaggio diventano due righe', async () => {
    const p: any = prismaFinto();
    const n = await imparaDalNutrizionista(p, {
      clientId: 'c-1', autoreRuolo: 'nutritionist',
      testo: 'Sostituisci il pollo con il tacchino. Prendi le gallette invece del pane.',
    });
    expect(n).toBe(2);
  });

  it('⚠️ se il database si rifiuta, il messaggio in chat parte lo stesso', async () => {
    // Sta in fondo all'invio di un messaggio: un errore qui non deve impedire a una nutrizionista
    // di parlare con la sua paziente.
    const p: any = { foodSwap: { upsert: jest.fn().mockRejectedValue(new Error('db giù')) } };
    await expect(
      imparaDalNutrizionista(p, { clientId: 'c-1', autoreRuolo: 'nutritionist', testo: FRASE }),
    ).resolves.toBe(0);
  });
});
