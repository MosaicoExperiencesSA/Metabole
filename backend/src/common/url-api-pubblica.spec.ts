import { urlApiPubblica } from './url-api-pubblica';

describe('urlApiPubblica — il prefisso /api/v1 una volta sola', () => {
  it('senza variabile usa Render e aggiunge il prefisso', () => {
    expect(urlApiPubblica(undefined)).toBe('https://metabole-backend.onrender.com/api/v1');
    expect(urlApiPubblica('   ')).toBe('https://metabole-backend.onrender.com/api/v1');
  });
  it('variabile senza prefisso: lo aggiunge', () => {
    expect(urlApiPubblica('https://api.metabole.eu')).toBe('https://api.metabole.eu/api/v1');
    expect(urlApiPubblica('https://api.metabole.eu/')).toBe('https://api.metabole.eu/api/v1');
  });
  it('variabile che ha già il prefisso: non lo raddoppia', () => {
    expect(urlApiPubblica('https://api.metabole.eu/api/v1')).toBe('https://api.metabole.eu/api/v1');
    expect(urlApiPubblica('https://api.metabole.eu/api/v1/')).toBe('https://api.metabole.eu/api/v1');
  });
});
