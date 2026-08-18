import { puliscoOrdineMenu } from './ordine-menu';

describe('puliscoOrdineMenu', () => {
  it('⚠️ due gruppi omonimi entrano e RESTANO DUE', () => {
    // Il difetto 1, che è perdita di dati silenziosa: col `Set` di prima la seconda riga
    // «#gruppot:Vendite» spariva e i due gruppi diventavano uno, con dentro le voci di entrambi.
    const dentro = ['#gruppot:Vendite', '/crm', '#gruppot:Vendite', '/lead'];
    expect(puliscoOrdineMenu(dentro)).toEqual(dentro);
  });

  it('una rotta ripetuta entra e resta UNA', () => {
    // Il dedup sulle rotte è giusto e va conservato: la stessa voce due volte nel menu non ha senso.
    expect(puliscoOrdineMenu(['#gruppot:CRM', '/crm', '/lead', '/crm'])).toEqual(['#gruppot:CRM', '/crm', '/lead']);
  });

  it('vale per tutti e tre i marcatori, non solo per «solo titolo»', () => {
    const dentro = ['#gruppo:A', '/x', '#gruppoc:A', '/y', '#gruppot:A', '/z'];
    expect(puliscoOrdineMenu(dentro)).toEqual(dentro);
  });

  it('gli spazi ai bordi si tolgono: «Vendite » e «Vendite» sono lo stesso gruppo', () => {
    expect(puliscoOrdineMenu(['#gruppot:Vendite ', ' /crm '])).toEqual(['#gruppot:Vendite', '/crm']);
  });

  it('⚠️ il tetto di lunghezza vale anche dal server, non solo nella casella', () => {
    const lunghissimo = '#gruppot:' + 'A'.repeat(5000);
    const [riga] = puliscoOrdineMenu([lunghissimo]);
    expect(riga.length).toBe(64);
    expect(riga.startsWith('#gruppot:AAA')).toBe(true);
  });

  it('⚠️ il taglio viene prima del dedup: due rotte lunghe uguali dopo il taglio restano una', () => {
    // Se si deduplicasse prima di tagliare, queste due passerebbero come diverse e finirebbero
    // identiche nella lista salvata.
    const a = '/' + 'x'.repeat(70) + 'A';
    const b = '/' + 'x'.repeat(70) + 'B';
    expect(puliscoOrdineMenu([a, b])).toHaveLength(1);
  });

  it('righe vuote e non-stringhe non entrano', () => {
    expect(puliscoOrdineMenu(['/crm', '', '   ', null, 42, undefined, '/lead'] as unknown[])).toEqual(['/crm', '/lead']);
  });

  it('si ferma a ottanta righe', () => {
    const tante = Array.from({ length: 200 }, (_, i) => `/rotta-${i}`);
    expect(puliscoOrdineMenu(tante)).toHaveLength(80);
  });

  it('una lista vuota resta vuota, e non lancia', () => {
    expect(puliscoOrdineMenu([])).toEqual([]);
    expect(puliscoOrdineMenu(undefined as unknown as string[])).toEqual([]);
  });
});
