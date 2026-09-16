import {
  emailMascherata,
  emailPlausibile,
  escHtml,
  motivoScarto,
  nellaFinestra,
  nomeCortese,
  tettoGiornaliero,
  tokenInvito,
  verificaTokenInvito,
} from './regole';

describe('invito a Gaia — le regole (16/9)', () => {
  describe('nomeCortese', () => {
    it('maiuscole e minuscole delle liste storiche diventano un nome', () => {
      expect(nomeCortese('MARIA GRAZIA', null)).toBe('Maria');
      expect(nomeCortese(null, '  lucia bianchi ')).toBe('Lucia');
      expect(nomeCortese("d'ANGELA", null)).toBe("D'Angela");
      expect(nomeCortese('anna-maria', null)).toBe('Anna-Maria');
    });
    it('senza un nome vero è «Ciao», mai vuoto', () => {
      expect(nomeCortese(null, null)).toBe('Ciao');
      expect(nomeCortese('  ', '')).toBe('Ciao');
      expect(nomeCortese('.', null)).toBe('Ciao');
      expect(nomeCortese('123', null)).toBe('Ciao');
    });
    it('il nome di battesimo vince sul nome intero', () => {
      expect(nomeCortese('Giulia', 'Rossi Giulia')).toBe('Giulia');
    });
  });

  describe('link firmato', () => {
    const segreto = 's3greto';
    it('un token valido restituisce la scheda', () => {
      expect(verificaTokenInvito(tokenInvito('rec-1', segreto), segreto)).toBe('rec-1');
    });
    it('firma cambiata, scheda cambiata, segreto diverso: niente', () => {
      const t = tokenInvito('rec-1', segreto);
      expect(verificaTokenInvito(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'), segreto)).toBeNull();
      expect(verificaTokenInvito(t.replace('rec-1', 'rec-2'), segreto)).toBeNull();
      expect(verificaTokenInvito(t, 'altro')).toBeNull();
      expect(verificaTokenInvito('', segreto)).toBeNull();
      expect(verificaTokenInvito(undefined, segreto)).toBeNull();
      expect(verificaTokenInvito('.abc', segreto)).toBeNull();
    });
    it('non vale come link delle preferenze (scopo diverso)', () => {
      // stessa scheda, stesso segreto, ma lo scopo «prefs:» firma altro
      const { createHmac } = jest.requireActual('crypto') as typeof import('crypto');
      const prefs = `rec-1.${createHmac('sha256', segreto).update('prefs:rec-1').digest('hex').slice(0, 32)}`;
      expect(verificaTokenInvito(prefs, segreto)).toBeNull();
    });
  });

  describe('finestra oraria (ora di Roma)', () => {
    // 16/9 è ora legale: Roma = UTC+2
    it('dentro e fuori dalla finestra 9–20', () => {
      expect(nellaFinestra(new Date('2026-09-16T06:59:00Z'), 9, 20)).toBe(false); // 08:59
      expect(nellaFinestra(new Date('2026-09-16T07:00:00Z'), 9, 20)).toBe(true); // 09:00
      expect(nellaFinestra(new Date('2026-09-16T17:59:00Z'), 9, 20)).toBe(true); // 19:59
      expect(nellaFinestra(new Date('2026-09-16T18:00:00Z'), 9, 20)).toBe(false); // 20:00
    });
    it('in inverno (UTC+1) conta ancora l ora di Roma', () => {
      expect(nellaFinestra(new Date('2026-12-01T07:30:00Z'), 9, 20)).toBe(false); // 08:30
      expect(nellaFinestra(new Date('2026-12-01T08:00:00Z'), 9, 20)).toBe(true); // 09:00
    });
    it('parametri sbagliati: si torna a 9–20, mai di notte', () => {
      const notte = new Date('2026-09-16T01:00:00Z'); // 03:00
      expect(nellaFinestra(notte, 20, 9)).toBe(false);
      expect(nellaFinestra(notte, NaN, 20)).toBe(false);
      expect(nellaFinestra(notte, -1, 30)).toBe(false);
      expect(nellaFinestra(new Date('2026-09-16T08:00:00Z'), 20, 9)).toBe(true); // 10:00
    });
  });

  it('tettoGiornaliero', () => {
    expect(tettoGiornaliero(100)).toBe(100);
    expect(tettoGiornaliero(99999)).toBe(1000);
    expect(tettoGiornaliero(NaN)).toBe(0);
    expect(tettoGiornaliero(-5)).toBe(0);
    expect(tettoGiornaliero(10.7)).toBe(10);
  });

  describe('motivoScarto', () => {
    const vuoto = new Set<string>();
    it('nell ordine: indirizzo, doppione, account, consenso, canale', () => {
      expect(motivoScarto('nonvalida', vuoto, vuoto, true, [])).toBe('saltato:email');
      expect(motivoScarto(null, vuoto, vuoto, true, [])).toBe('saltato:email');
      expect(motivoScarto(' Anna@Example.com ', new Set(['anna@example.com']), vuoto, false, [])).toBe('saltato:doppione');
      expect(motivoScarto('anna@example.com', vuoto, new Set(['anna@example.com']), false, [])).toBe('saltato:account');
      expect(motivoScarto('anna@example.com', vuoto, vuoto, false, [])).toBe('saltato:consenso');
      expect(motivoScarto('anna@example.com', vuoto, vuoto, true, ['whatsapp'])).toBe('saltato:canale');
    });
    it('canali non scelti o email fra i canali: si scrive', () => {
      expect(motivoScarto('anna@example.com', vuoto, vuoto, true, [])).toBeNull();
      expect(motivoScarto('anna@example.com', vuoto, vuoto, true, null)).toBeNull();
      expect(motivoScarto('anna@example.com', vuoto, vuoto, true, ['sms', 'email'])).toBeNull();
    });
  });

  it('escHtml', () => {
    expect(escHtml('<b>"x"</b> & \'y\'')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;');
  });

  it('emailPlausibile ed emailMascherata', () => {
    expect(emailPlausibile('a@b.it')).toBe(true);
    expect(emailPlausibile('a@b')).toBe(false);
    expect(emailPlausibile('a b@c.it')).toBe(false);
    expect(emailPlausibile('mar,ia@example.com')).toBe(false);
    expect(emailPlausibile('a@example.it/')).toBe(false);
    expect(emailPlausibile('<a>@example.it')).toBe(false);
    expect(emailPlausibile('a@-example.it')).toBe(false);
    expect(emailPlausibile('nome.cognome+tag@sub.example.co.uk')).toBe(true);
    expect(emailMascherata('maria.rossi@example.com')).toBe('ma•••@example.com');
    expect(emailMascherata('senza-chiocciola')).toBe('•••');
  });
});
