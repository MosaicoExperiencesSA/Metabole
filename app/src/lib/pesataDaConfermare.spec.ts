import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTESA_MASSIMA_MS, entroIlTempo, leggiFrase, serveChiedere } from './pesataDaConfermare';

describe('leggiFrase — qualunque cosa di storto vale «non chiedere»', () => {
  it('la frase del server si mostra com\'è scritta lì', () => {
    expect(leggiFrase({ frase: "L'ultima volta che ti sei pesata, il 26/08/2026, eri 73 kg. È giusto?" })).toBe(
      "L'ultima volta che ti sei pesata, il 26/08/2026, eri 73 kg. È giusto?",
    );
  });

  /**
   * ⛔ È la riga che tiene questa cosa una **cortesia** e non un cancello. Una rotta che non c'è
   * ancora sul server, una rete che cade, una risposta di forma diversa: in tutti questi casi non si
   * chiede niente e si salva, esattamente come si salvava prima che questa consegna esistesse.
   */
  it.each([
    ['il numero torna: il server risponde null', null],
    ['la rotta non c\'è ancora e risponde vuoto', undefined],
    ['una risposta di forma diversa', { messaggio: 'boh' }],
    ['una frase che non è una stringa', { frase: 42 }],
    ['una frase di soli spazi', { frase: '   ' }],
    ['una stringa nuda invece di un oggetto', 'da confermare'],
  ])('non si chiede niente: %s', (_titolo, risposta) => {
    expect(leggiFrase(risposta)).toBeNull();
  });
});

describe('serveChiedere — il «sì» vale per il numero su cui è stato dato', () => {
  it('senza una domanda in sospeso si chiede', () => {
    expect(serveChiedere(null, 113)).toBe(true);
    expect(serveChiedere(undefined, 113)).toBe(true);
  });

  it('già chiesto per questo numero: non si richiede, si salva', () => {
    expect(serveChiedere({ frase: 'x', pesoScritto: 113 }, 113)).toBe(false);
  });

  /**
   * ⛔ Il difetto che questa riga chiude: lei vede la domanda su 113, capisce di aver sbagliato,
   * scrive 73 e preme di nuovo. Senza il confronto, il «sì, è giusto» dato su 113 varrebbe per 73 —
   * cioè si userebbe il consenso di una persona per una cosa che non ha visto. ⚠️ E nel verso
   * opposto è peggio: la conferma data su un numero buono farebbe passare quello sbagliato.
   */
  it('⛔ cambiato il numero, la conferma di prima non vale più', () => {
    expect(serveChiedere({ frase: 'x', pesoScritto: 113 }, 73)).toBe(true);
    expect(serveChiedere({ frase: 'x', pesoScritto: 73 }, 113)).toBe(true);
    expect(serveChiedere({ frase: 'x', pesoScritto: 73 }, 73.1)).toBe(true);
  });
});

/**
 * ⛔ **APPESA NON È FALLITA** — il difetto trovato in revisione, e l'unico che assomigliava davvero
 * a un cancello. `fetch` non ha un timeout suo: mentre la verifica pende, la schermata tiene `busy`,
 * e `busy` spegne anche le caselle. Una cliente con segnale ballerino restava coi campi grigi e il
 * tasto «Salvo…» per tutto il timeout di sistema — che in una WebView è dell'ordine del minuto —
 * senza poter salvare **né correggere il numero**.
 */
describe('entroIlTempo', () => {
  it('una risposta che arriva in tempo passa così com\'è', async () => {
    await expect(entroIlTempo(Promise.resolve('la domanda'), 50)).resolves.toBe('la domanda');
  });

  it('⛔ una risposta che non arriva vale «nessuna domanda», non un\'attesa infinita', async () => {
    const mai = new Promise<string>(() => {});
    await expect(entroIlTempo(mai, 20)).resolves.toBeNull();
  });

  it('⚠️ l\'errore resta un errore: lo gestisce chi chiama, non questo', async () => {
    await expect(entroIlTempo(Promise.reject(new Error('rete giù')), 50)).rejects.toThrow('rete giù');
  });

  it('⚠️ cinque secondi: abbastanza per una rete lenta, non abbastanza per bloccarla', () => {
    expect(ATTESA_MASSIMA_MS).toBe(5000);
  });
});

/**
 * ⚠️ **La schermata non ha un DOM nei test** (`environment: 'node'`, vedi `vite.config.ts`), quindi
 * di `Obiettivo.tsx` si può guardare solo il sorgente. È una prova debole e va detto — ma le due
 * proprietà qui sotto sono quelle che una riscrittura distratta romperebbe in silenzio, e
 * romperebbe **verso il danno**: una cliente chiusa fuori dalla sua app, o un dato che il server
 * risponde e nessuno legge (il difetto che questa pagina ha già pagato due volte).
 *
 * ⚠️ I commenti si tolgono prima di cercare: il 31/8 una prova ha trovato quello che cercava dentro
 * il commento che spiegava la regola, ed è rimasta verde con il codice tolto.
 */
describe('⚠️ Obiettivo.tsx: le due proprietà che non si vedono da qui', () => {
  const senzaCommenti = readFileSync(join(__dirname, '..', 'pages', 'Obiettivo.tsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('⛔ la verifica ha un `catch` che risponde «non chiedere»: non è un cancello', () => {
    const corpo = senzaCommenti.slice(senzaCommenti.indexOf('async function chiediSeTorna'));
    const fine = corpo.indexOf('\n  }');
    expect(fine).toBeGreaterThan(-1);
    expect(corpo.slice(0, fine)).toMatch(/catch\s*\{\s*return null;/);
  });

  /**
   * ⛔ **Tutt'e due le porte, non una.** `POST /me/measurements` e `POST /me/measurements/correct`
   * rispondono **tutt'e due** `pesoIncoerente`, e la prima stesura di questo test cercava la stringa
   * nel file intero: bastava che una delle due la leggesse perché restasse verde con l'altra rotta
   * muta. ⚠️ Preso da una prova di mutazione, non da una rilettura.
   */
  const corpoDi = (nome: string): string => {
    const i = senzaCommenti.indexOf(`async function ${nome}(`);
    expect(i).toBeGreaterThan(-1);
    const resto = senzaCommenti.slice(i);
    return resto.slice(0, resto.indexOf('\n  }'));
  };

  /**
   * ⚠️ Si cerca il campo **dentro la chiamata a `esitoPesata`**, non nel corpo: il nome compare
   * anche nel tipo della risposta (`api<{ pesateDaVerificare?: boolean }>`), e cercarlo e basta
   * lasciava verde una versione che lo dichiarava e non lo usava. L'ha trovato una mutazione.
   *
   * ⚠️ Il campo è `pesateDaVerificare` e **non** `pesoIncoerente`: il secondo è il salto peggiore
   * dei novanta giorni e resta pieno per tre mesi; il primo dice se riguarda la pesata appena
   * scritta. Vedi `toccaIlGiorno` nel backend.
   */
  const passatoAEsito = /esitoPesata\([^;]*pesateDaVerificare/;

  it('⛔ il salvataggio passa `pesateDaVerificare` a `esitoPesata`', () => {
    expect(corpoDi('salva')).toMatch(passatoAEsito);
  });

  it('⛔ e anche la correzione, che risponde lo stesso campo', () => {
    expect(corpoDi('correct')).toMatch(passatoAEsito);
  });

  /**
   * ⛔ **La correzione ricontrolla al punto che scrive** (trovato in revisione). `chiediPoiConferma`
   * chiede un passo prima e apre il «Sei sicuro?», ⚠️ ma in quello stato le caselle sono ancora
   * attive: si poteva scrivere 73 (nessuna domanda), aprire il «Sei sicuro?», cambiare in 113 e
   * premere «Sì, sostituisci» — e il 113 si salvava senza che le fosse stato chiesto niente.
   */
  it('⛔ `correct` ricontrolla `serveChiedere` prima di scrivere', () => {
    expect(corpoDi('correct')).toContain('serveChiedere(daConfermare');
  });

  it('⚠️ la verifica ha un tetto al tempo di attesa', () => {
    expect(corpoDi('chiediSeTorna')).toContain('entroIlTempo(');
  });
});

/**
 * ⛔ **LA PORTA BLOCCANTE**: `MeasuresGate` è la schermata «App in pausa» / «Serve la tua pesata»,
 * cioè quella in cui una cliente digita di fretta per far ripartire il menu — e in cui un 113 al
 * posto di 73 le sospende il fabbisogno proprio mentre il menu riparte. Era l'unica delle tre porte
 * rimasta muta.
 */
describe('⚠️ MeasuresGate: la porta dove il numero sbagliato fa più male', () => {
  const sorgente = readFileSync(join(__dirname, '..', 'components', 'MeasuresGate.tsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('⛔ chiede prima di salvare', () => {
    const corpo = sorgente.slice(sorgente.indexOf('async function save('));
    expect(corpo.slice(0, corpo.indexOf('\n  }'))).toContain('serveChiedere(daConfermare');
  });

  it('⛔ e non è un cancello: `catch` che risponde «non chiedere», e un tetto al tempo', () => {
    const corpo = sorgente.slice(sorgente.indexOf('async function chiediSeTorna'));
    const testa = corpo.slice(0, corpo.indexOf('\n  }'));
    expect(testa).toMatch(/catch\s*\{\s*return null;/);
    expect(testa).toContain('entroIlTempo(');
  });
});
