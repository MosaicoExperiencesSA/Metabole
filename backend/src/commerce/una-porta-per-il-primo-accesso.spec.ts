/**
 * UNA PORTA SOLA PER «PRIMO ACCESSO EFFETTUATO».
 *
 * I punti che segnano il primo accesso sono due — la registrazione e l'accesso — e domani
 * potrebbero essere tre. Il difetto che questi test impediscono non sta dentro una funzione: sta
 * **nei posti che la chiamano**, ed è per questo che si guarda il testo dei file.
 *
 * ⚠️ Due cose che si perdono facilmente e non si vedono da nessuna parte:
 *  · la **master password**: se entra l'assistenza, la board direbbe che è entrata la cliente;
 *  · il **ruolo**: la board CRM è delle clienti, e una coach che accede non ci deve comparire.
 * Sono due `if` di una riga in `AuthService`. Un domani qualcuno riordina quel blocco, li perde, e
 * nessuno se ne accorge — perché il risultato è una scheda in più su una board, non un errore.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { STATO_PRIMO_ACCESSO } from './primo-accesso';

const leggi = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('la chiave dello stato sta scritta in un posto solo', () => {
  it('`AuthService` non la scrive a mano: passa dalla porta', () => {
    const auth = leggi('auth/auth.service.ts');
    expect(auth).toContain('segnaPrimoAccesso');
    expect(auth).not.toContain(STATO_PRIMO_ACCESSO);
  });
});

describe('i due `if` che tengono onesta la colonna', () => {
  const auth = leggi('auth/auth.service.ts');
  /** Il pezzo di `login()` che circonda la chiamata: si guarda lì, non in tutto il file. */
  const dentroLogin = (() => {
    const i = auth.indexOf('async login(');
    const j = auth.indexOf('async refresh(', i);
    return auth.slice(i, j);
  })();

  it('la chiamata sta dentro `login`', () => {
    expect(dentroLogin).toContain('segnaPrimoAccesso');
  });

  it('⛔ non scatta con la master password', () => {
    const riga = dentroLogin.slice(0, dentroLogin.indexOf('segnaPrimoAccesso'));
    expect(riga.slice(-200)).toContain('!isMasterLogin');
  });

  it('⛔ e solo per le clienti', () => {
    const riga = dentroLogin.slice(0, dentroLogin.indexOf('segnaPrimoAccesso'));
    expect(riga.slice(-200)).toContain("role === 'client'");
  });
});

describe('la registrazione', () => {
  it('segna il primo accesso: registrarsi È entrare (richiesta di Simone, 20/8)', () => {
    const auth = leggi('auth/auth.service.ts');
    const i = auth.indexOf('async register(');
    const j = auth.indexOf('async login(', i);
    expect(auth.slice(i, j)).toContain('segnaPrimoAccesso');
  });
});

describe('la colonna esiste nel seed', () => {
  it('così una installazione nuova nasce con la board completa', () => {
    const seed = readFileSync(join(__dirname, '..', '..', 'prisma', 'seed.ts'), 'utf8');
    expect(seed).toContain(`key: '${STATO_PRIMO_ACCESSO}'`);
  });

  it('⚠️ e sta PRIMA di «Questionario completato»: se stesse dopo, chi accede non ci arriverebbe più', () => {
    const seed = readFileSync(join(__dirname, '..', '..', 'prisma', 'seed.ts'), 'utf8');
    const ordineDi = (key: string) => {
      const m = seed.match(new RegExp(`key: '${key}'[^}]*order: (\\d+)`));
      if (!m) throw new Error(`stato «${key}» non trovato nel seed`);
      return Number(m[1]);
    };
    expect(ordineDi(STATO_PRIMO_ACCESSO)).toBeLessThan(ordineDi('questionnaire_done'));
    expect(ordineDi(STATO_PRIMO_ACCESSO)).toBeGreaterThan(ordineDi('worked'));
  });
});
