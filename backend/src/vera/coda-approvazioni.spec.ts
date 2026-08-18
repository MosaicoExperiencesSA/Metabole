/**
 * ⚠️ I collaudi che contano qui sono tre, e nessuno riguarda le parole:
 *  - una ricetta con gli allergeni aperti NON deve mai comparire come «la accendo?»;
 *  - la stessa ricetta in tre diete si chiede una volta sola;
 *  - «non lo so» non è un no.
 */
import {
  chiaveVoce,
  contaCoda,
  costruisciCoda,
  fraseInterrotta,
  fraseInvitoCoda,
  leggiRispostaApprovazione,
  testoVoce,
  type DietaInRevisione,
} from './coda-approvazioni';

const ricetta = (id: string, p: Partial<{ nome: string; attiva: boolean; allergeniVerificati: boolean }> = {}) => ({
  id,
  nome: p.nome ?? `Ricetta ${id}`,
  attiva: p.attiva ?? false,
  allergeniVerificati: p.allergeniVerificati ?? true,
  slot: 'lunch',
  kcal: 500,
  ingredienti: ['pollo', 'zucchine'],
});

const dieta = (id: string, ricette: ReturnType<typeof ricetta>[], combinazioni: DietaInRevisione['combinazioni'] = []): DietaInRevisione => ({
  dietaId: id,
  dietaNome: `Dieta ${id}`,
  ricette,
  combinazioni,
});

describe('costruisciCoda', () => {
  it('non chiede di accendere una ricetta con gli allergeni ancora da guardare', () => {
    const coda = costruisciCoda([dieta('d1', [ricetta('r1', { attiva: false, allergeniVerificati: false })])]);
    expect(coda).toHaveLength(1);
    expect(coda[0].tipo).toBe('allergeni');
    // ⚠️ Il punto: NON esiste anche la voce 'ricetta' per r1. Un «sì» detto di corsa
    // accenderebbe un piatto di cui nessuno ha guardato gli allergeni.
    expect(coda.some((v) => v.tipo === 'ricetta')).toBe(false);
  });

  it('la stessa ricetta che sta in tre diete si chiede una volta sola', () => {
    const r = ricetta('r1', { attiva: false });
    const coda = costruisciCoda([dieta('d1', [r]), dieta('d2', [r]), dieta('d3', [r])]);
    expect(coda).toHaveLength(1);
    expect(coda[0].dietaId).toBe('d1'); // la prima in cui la si incontra, come contesto
  });

  it('ordine: prima gli allergeni, poi le ricette, le combinazioni in fondo', () => {
    const coda = costruisciCoda([
      dieta(
        'd1',
        [ricetta('r1', { attiva: false }), ricetta('r2', { allergeniVerificati: false })],
        [{ id: 'g1', nome: 'Cereali', stato: 'draft', alimenti: ['riso', 'farro'] }],
      ),
    ]);
    expect(coda.map((v) => v.tipo)).toEqual(['allergeni', 'ricetta', 'combinazione']);
  });

  it('salta quello che è già stato messo da parte, e niente altro', () => {
    const diete = [dieta('d1', [ricetta('r1', { attiva: false }), ricetta('r2', { attiva: false })])];
    const coda = costruisciCoda(diete, ['ricetta:r1']);
    expect(coda.map((v) => v.id)).toEqual(['r2']);
  });

  it('una ricetta accesa e con gli allergeni fatti non compare, e un gruppo approvato nemmeno', () => {
    const coda = costruisciCoda([
      dieta('d1', [ricetta('r1', { attiva: true, allergeniVerificati: true })], [{ id: 'g1', nome: 'Cereali', stato: 'approved' }]),
    ]);
    expect(coda).toEqual([]);
  });

  it('chiaveVoce distingue una ricetta da un gruppo con lo stesso id', () => {
    expect(chiaveVoce({ tipo: 'ricetta', id: 'x' })).not.toBe(chiaveVoce({ tipo: 'combinazione', id: 'x' }));
  });
});

describe('contaCoda', () => {
  it('conta le due cose aperte sulla stessa ricetta, anche se la fila ne mostra una', () => {
    const diete = [dieta('d1', [ricetta('r1', { attiva: false, allergeniVerificati: false })])];
    expect(costruisciCoda(diete)).toHaveLength(1);
    // ⚠️ Il lavoro da fare su r1 è DOPPIO: confermare gli allergeni e poi accenderla. La fila ne
    // mostra uno per volta; il contatore non deve mentire dicendo «ne manca 1».
    expect(contaCoda(diete)).toEqual({ allergeni: 1, ricette: 1, combinazioni: 0, totale: 2 });
  });

  it('non toglie le saltate: «dopo» non è «fatto»', () => {
    const diete = [dieta('d1', [ricetta('r1', { attiva: false })])];
    expect(costruisciCoda(diete, ['ricetta:r1'])).toEqual([]);
    expect(contaCoda(diete).totale).toBe(1);
  });

  it('non conta due volte una ricetta che sta in due diete', () => {
    const r = ricetta('r1', { attiva: false });
    expect(contaCoda([dieta('d1', [r]), dieta('d2', [r])]).ricette).toBe(1);
  });
});

describe('leggiRispostaApprovazione', () => {
  it.each(['sì', 'si', 'ok', 'va bene', 'approvo', 'confermo', 'attivala', 'certo', 'procedi'])('«%s» è un sì', (f) => {
    expect(leggiRispostaApprovazione(f)).toBe('si');
  });

  it.each(['no', 'non va bene', 'respingila', 'scartala', 'è sbagliata', 'va rifatta'])('«%s» è un no', (f) => {
    expect(leggiRispostaApprovazione(f)).toBe('no');
  });

  it.each(['salta', 'saltala', 'passa', 'la prossima', 'devo guardarla', 'boh'])('«%s» è un salta', (f) => {
    expect(leggiRispostaApprovazione(f)).toBe('salta');
  });

  it.each(['basta', 'stop', 'fermiamoci', 'lascia perdere', 'riprendo dopo'])('«%s» ferma il giro', (f) => {
    expect(leggiRispostaApprovazione(f)).toBe('basta');
  });

  it('«non lo so» è un salta, non un no', () => {
    // ⚠️ Il collaudo che vale per tutto il file: il dubbio non decide. Se questo diventasse 'no'
    // una nutrizionista incerta rifiuterebbe ricette senza volerlo — e il no qui non si disfa
    // dalla chat, si va in scheda.
    expect(leggiRispostaApprovazione('non lo so')).toBe('salta');
    expect(leggiRispostaApprovazione('non sono sicura')).toBe('salta');
  });

  it('«non va bene» non si legge come «va bene»', () => {
    expect(leggiRispostaApprovazione('non va bene')).toBe('no');
  });

  it('una frase che non c\'entra non è né sì né no', () => {
    expect(leggiRispostaApprovazione('quante ricette mancano?')).toBeNull();
    expect(leggiRispostaApprovazione('')).toBeNull();
  });
});

describe('le frasi', () => {
  it('la domanda su una ricetta dice cosa c\'è dentro', () => {
    const [voce] = costruisciCoda([dieta('d1', [ricetta('r1', { attiva: false, nome: 'Pollo alle erbe' })])]);
    const testo = testoVoce(voce, 3);
    expect(testo).toContain('Pollo alle erbe');
    expect(testo).toContain('pollo, zucchine'); // gli ingredienti: senza, si firma alla cieca
    expect(testo).toContain('pranzo');
    expect(testo).toContain('restano altre 2');
  });

  it('quando gli ingredienti non ci sono lo dice, invece di far finta che il piatto sia vuoto', () => {
    const testo = testoVoce({ tipo: 'ricetta', id: 'r1', nome: 'X', dietaId: 'd', dietaNome: 'D' }, 1);
    expect(testo).toContain('non riesco a leggerli');
  });

  it('sull\'ultima non scrive «restano altre 0»', () => {
    const testo = testoVoce({ tipo: 'ricetta', id: 'r1', nome: 'X', dietaId: 'd', dietaNome: 'D' }, 1);
    expect(testo).toContain('È l\'ultima.');
    expect(testo).not.toContain('altre 0');
  });

  it('avverte quando la ricetta tocca più diete', () => {
    const testo = testoVoce({ tipo: 'ricetta', id: 'r1', nome: 'X', dietaId: 'd', dietaNome: 'D' }, 1, 3);
    expect(testo).toContain('3 diete');
  });

  it('fermarsi dice sempre quanto resta', () => {
    expect(fraseInterrotta(4)).toContain('4 cose');
    expect(fraseInterrotta(1)).toContain('Resta una cosa');
    expect(fraseInterrotta(0)).not.toContain('Restano');
  });

  it('l\'invito non si dice quando non c\'è niente', () => {
    expect(fraseInvitoCoda({ allergeni: 0, ricette: 0, combinazioni: 0, totale: 0 })).toBeNull();
    expect(fraseInvitoCoda({ allergeni: 1, ricette: 2, combinazioni: 0, totale: 3 })).toContain('3 cose aspettano');
  });
});
