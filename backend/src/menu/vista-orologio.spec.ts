/**
 * QUELLO CHE L'APP VEDE — i test.
 *
 * Due cose contano più delle altre. La prima: **`attuale` non si inventa**. Finché la cliente non ha
 * scelto, in home non deve comparire un orologio che nessuno ha impostato — sarebbe la voce 256 al
 * contrario, un dato che si vede e non agisce.
 *
 * La seconda: **i giorni che mancano al bersaglio li conta la stessa funzione che li esegue**. Se il
 * numero a schermo venisse da una divisione, il giorno che il cron cambia passo la cliente
 * leggerebbe una promessa che il sistema non mantiene.
 */
import { PASSO_GRADUALE_PREDEFINITO, passoDiStanotte } from './cambio-finestra';
import { fasceDelDigiuno, giorniAlBersaglio, vistaOrologio } from './vista-orologio';
import { readFileSync } from 'fs';
import { join } from 'path';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;
const digiuna = (extra: Record<string, unknown> = {}) => ({
  pathType: 'intermittent_fasting',
  ...extra,
});

describe('⛔ l\'orologio non si inventa', () => {
  it('⛔ chi non ha ancora scelto NON ha un orologio in home', () => {
    const v = vistaOrologio(digiuna({ fastingWindow: 'skip_breakfast' }));
    expect(v.daChiedere).toBe(true);
    expect(v.proposta).toEqual({ protocollo: '16:8', inizioMin: 720, ora: '12:00' });
    // ⛔ Ma `attuale` NON c'è: la proposta è quello con cui si apre la pagina, non quello che il
    // motore sta usando. Fonderli le mostrerebbe in home un orologio che non ha impostato.
    expect(v.attuale).toBeUndefined();
  });

  it.each([
    ['solo il protocollo', { fastingProtocol: '16:8' }],
    ['solo l\'orario', { fastingStartMin: H(12) }],
    ['un protocollo fuori tabella', { fastingProtocol: '30:1', fastingStartMin: H(12) }],
  ])('⚠️ %s non fa mezza finestra: non ne fa nessuna', (_titolo, campi) => {
    expect(vistaOrologio(digiuna({ ...campi, fastingSceltoIl: new Date() })).attuale).toBeUndefined();
  });

  it('chi non digiuna non vede niente e non gli si chiede niente', () => {
    const v = vistaOrologio({ pathType: 'five', fastingProtocol: '16:8', fastingStartMin: H(12) });
    expect(v.digiuna).toBe(false);
    expect(v.daChiedere).toBe(false);
    expect(v.motivo).toBe('non_digiuna');
  });
});

describe('com\'è messa adesso', () => {
  const scelta = digiuna({
    fastingProtocol: '16:8',
    fastingStartMin: H(12),
    fastingSceltoIl: new Date('2026-08-21T08:00:00Z'),
  });

  it('apertura, chiusura e ore, già scritte', () => {
    const v = vistaOrologio(scelta);
    expect(v.daChiedere).toBe(false);
    expect(v.attuale).toMatchObject({
      protocollo: '16:8',
      apertura: '12:00',
      chiusura: '20:00',
      oreFinestra: 8,
      oreDigiuno: 16,
      fastingWindow: 'skip_breakfast',
    });
  });

  /**
   * ⛔ **Il nome che legge la cliente non è il nome dello slot.** Con la finestra 08:00–16:00 il
   * motore chiama `lunch` il pasto delle 08:15: scriverle «Pranzo alle 08:15» sarebbe una frase
   * falsa, e sarebbe quello che succede se l'etichetta la scegliesse l'app dallo slot.
   */
  it('⛔ i pasti hanno l\'ora scritta e un nome che non mente', () => {
    const v = vistaOrologio(digiuna({
      fastingProtocol: '16:8',
      fastingStartMin: H(8),
      fastingSceltoIl: new Date(),
    }));
    const pasti = v.attuale!.pasti;
    expect(pasti.map((p) => p.slot)).toEqual(['lunch', 'afternoon_snack', 'dinner']);
    expect(pasti[0].ora).toBe('08:15');
    /**
     * ⛔ **Dal 5/9 il nome viene dalla FASCIA ORARIA** (decisione di Lucia): le 08:15 stanno nella
     * fascia della colazione (07-10), e «Colazione» è come lo chiama chi lo mangia. ⚠️ La frase
     * falsa che questa prova sorveglia resta la stessa — «Pranzo alle 08:15» — e infatti sotto si
     * chiede che nessun pasto prenda il nome di un altro rispetto alla propria ora.
     */
    /**
     * ⛔ Alle 08:15 il motore serve uno slot `lunch`: il nome resta quello per posizione, perché
     * «Colazione» prometterebbe un pasto che non è quello servito (revisione del 5/9). Nessuna
     * etichetta nomina un pasto della giornata diverso da quello che c'è nel piatto.
     */
    expect(pasti[0].etichetta).toBe('Primo pasto');
    expect(pasti[2].etichetta).toBe('Ultimo pasto');
    for (const p of pasti) expect(p.etichetta).not.toMatch(/Pranzo|Cena|Colazione/);
  });

  it('con un pasto solo l\'etichetta cambia, perché «primo» e «ultimo» non vogliono dire niente', () => {
    const v = vistaOrologio(digiuna({
      fastingProtocol: '23:1',
      fastingStartMin: H(19),
      fastingSceltoIl: new Date(),
    }));
    expect(v.attuale!.pasti).toHaveLength(1);
    // ⚠️ Le 19:15 stanno nella fascia della cena E lo slot servito è `dinner`: il nome vero vince.
    expect(v.attuale!.pasti[0].etichetta).toBe('Cena');
  });

  it('una finestra che scavalca la mezzanotte ha la chiusura del giorno dopo, e si vede', () => {
    const v = vistaOrologio(digiuna({
      fastingProtocol: '16:8',
      fastingStartMin: H(19),
      fastingSceltoIl: new Date(),
    }));
    expect(v.attuale!.apertura).toBe('19:00');
    expect(v.attuale!.chiusura).toBe('03:00');
  });

  it('i cinque protocolli arrivano dalla tabella, non riscritti dall\'app', () => {
    expect(vistaOrologio(scelta).protocolli.map((p) => p.valore))
      .toEqual(['14:10', '16:8', '18:6', '20:4', '23:1']);
  });
});

describe('⛔ il piano graduale: i giorni che legge sono quelli che succederanno', () => {
  it('il piano compare solo se il bersaglio è diverso dall\'inizio', () => {
    const senza = vistaOrologio(digiuna({
      fastingProtocol: '16:8', fastingStartMin: H(12), fastingTargetStartMin: H(12),
      fastingSceltoIl: new Date(),
    }));
    expect(senza.piano).toBeUndefined();
  });

  it('con un bersaglio a quattro ore mostra quattro giorni', () => {
    const v = vistaOrologio(digiuna({
      fastingProtocol: '16:8', fastingStartMin: H(12), fastingTargetStartMin: H(8),
      fastingSceltoIl: new Date(),
    }));
    expect(v.piano).toEqual({ bersaglioInizioMin: H(8), bersaglio: '08:00', giorniMancanti: 4 });
  });

  /**
   * ⛔ La prova che il numero **non viene da una divisione**: si fa girare `passoDiStanotte` notte
   * per notte, come farà il cron, e si conta. Se i due conti divergessero la cliente leggerebbe una
   * promessa che il sistema non mantiene.
   */
  it.each([
    [H(12), H(8), PASSO_GRADUALE_PREDEFINITO],
    [H(12), H(9, 30), PASSO_GRADUALE_PREDEFINITO],
    [H(2), H(22), PASSO_GRADUALE_PREDEFINITO],
    [H(12), H(8), 120],
    [H(13), H(11, 1), PASSO_GRADUALE_PREDEFINITO],
  ])('⛔ da %s a %s con passo %s: il conto combacia con le notti vere', (da, a, passo) => {
    let dove = da;
    let notti = 0;
    for (let i = 0; i < 100; i += 1) {
      const p = passoDiStanotte(dove, a, passo);
      if (!p) break;
      dove = p.inizioMin;
      notti += 1;
      if (p.arrivata) break;
    }
    expect(dove).toBe(a);
    expect(giorniAlBersaglio(da, a, passo)).toBe(notti);
  });

  it('un bersaglio già raggiunto vale zero notti', () => {
    expect(giorniAlBersaglio(H(12), H(12))).toBe(0);
  });

  /**
   * ⚠️ Un bersaglio **in avanti** dal piano graduale non nasce, ma se ci finisce (dato scritto a
   * mano) si arriva in una notte: il conto lo dice, invece di far girare l'orologio al contrario.
   */
  it('un bersaglio in avanti è una notte sola', () => {
    expect(giorniAlBersaglio(H(12), H(16))).toBe(1);
  });
});

describe('la finestra che l\'orologio non sa riprodurre', () => {
  it('si vede nella vista, ed è il segnale da cui nasce la segnalazione', () => {
    const v = vistaOrologio(digiuna({ fastingWindow: 'skip_dinner' }));
    expect(v.daChiedere).toBe(true);
    expect(v.proposta).toBeUndefined();
    expect(v.finestraNonTraducibile).toBe(true);
  });

  it('⚠️ chi non ha MAI avuto una finestra non è una segnalazione', () => {
    const v = vistaOrologio(digiuna({ fastingWindow: null }));
    expect(v.daChiedere).toBe(true);
    expect(v.finestraNonTraducibile).toBe(false);
  });
});


/**
 * ⛔ **LE FASCE PER LE DUE SCHEDE — nate da un difetto bloccante, il 21/8.**
 *
 * `profile.service` mandava all'app `vistaOrologio(p).attuale`; `clients.service` mandava alla
 * scheda staff `vistaOrologio(p)` **intero**. Sembra la stessa riga scritta due volte; non lo è. La
 * vista intera è un oggetto sempre pieno — `digiuna`, `motivo`, `protocolli` ci sono comunque —
 * quindi **sempre `truthy`** dentro un campo che il frontend legge come «le fasce, oppure niente».
 *
 * Effetto: per **ogni** cliente in digiuno la scheda prendeva il ramo «ha scelto», leggeva
 * `digiuno.pasti.length` su `undefined`, e portava giù tutto il backoffice nell'`ErrorBoundary`. E i
 * due ripieghi — finestra storica, mai chiesta — erano codice morto, perché quel `null` non arrivava
 * mai. Nessun compilatore poteva vederlo: la forma è dichiarata a mano nei `.tsx` e prodotta qui.
 *
 * ⚠️ Perciò i due punti chiamano la stessa funzione, e questi test guardano **la proprietà che
 * rompeva**: se `fasceDelDigiuno` torna qualcosa, quel qualcosa ha `pasti` percorribile.
 */
describe('⛔ le fasce per la scheda: o ci sono, o è `null`', () => {
  const conOrologio = digiuna({ fastingProtocol: '16:8', fastingStartMin: H(12), fastingSceltoIl: new Date() });

  it('chi ha impostato l\'orologio manda le sue fasce, con i pasti percorribili', () => {
    const f = fasceDelDigiuno(conOrologio);
    expect(f).not.toBeNull();
    expect(f!.apertura).toBe('12:00');
    expect(f!.chiusura).toBe('20:00');
    expect(Array.isArray(f!.pasti)).toBe(true);
    expect(f!.pasti.length).toBeGreaterThan(0);
  });

  /**
   * ⛔ Il caso esatto che rompeva. `vistaOrologio` qui risponde con un oggetto pieno: se la riga del
   * servizio lo rimandasse così com'è, questo test resterebbe verde solo perché guarda la funzione
   * giusta — perciò sotto c'è anche quello che legge i due servizi.
   */
  it.each([
    ['digiuna ma non ha ancora toccato l\'orologio', digiuna({ fastingWindow: 'skip_breakfast' })],
    ['digiuna e non ha proprio niente', digiuna({})],
    ['non digiuna', { pathType: 'five' }],
    /**
     * ⛔ Il caso che la funzione NON copriva finché non gliel'hanno chiesto (revisione 21/8): non
     * digiuna **e** ha ancora l'orologio scritto addosso. È lo stato che le porte d'uscita dal
     * digiuno lasciavano prima di `uscita-dal-digiuno.ts`, e qui usciva come una finestra vera.
     */
    ['non digiuna ma con l\'orologio ancora scritto', {
      pathType: 'five', fastingProtocol: '16:8', fastingStartMin: H(12), fastingSceltoIl: new Date(),
    }],
    ['non ha profilo', null],
    ['profilo non definito', undefined],
  ])('⚠️ %s → `null`, non un oggetto che sembra pieno', (_titolo, profilo) => {
    expect(fasceDelDigiuno(profilo as never)).toBeNull();
  });

  /**
   * ⚠️ `null` e non `undefined`: attraversa JSON, e `undefined` in un JSON **sparisce**. Un campo che
   * sparisce e un campo che dice «non c'è» si leggono uguali finché qualcuno non prova
   * `'digiuno' in risposta`.
   */
  it('⚠️ è `null`, non `undefined`: deve sopravvivere al JSON', () => {
    const risposta = JSON.parse(JSON.stringify({ digiuno: fasceDelDigiuno(digiuna({})) }));
    expect('digiuno' in risposta).toBe(true);
    expect(risposta.digiuno).toBeNull();
  });

  /**
   * ⛔ **E i due servizi la chiamano, invece di ricomporla.** È la parte che il test qui sopra non
   * può vedere: `fasceDelDigiuno` può essere perfetta mentre un servizio manda un'altra cosa — ed è
   * esattamente com'è andata. Si guarda il sorgente perché la riga sbagliata non dà errore da
   * nessuna parte: dà un oggetto, e l'oggetto viaggia.
   */
  it('⛔ i due servizi mandano `fasceDelDigiuno`, non la vista intera', () => {
    const sbagliati: string[] = [];
    const SERVIZI = [
      ['clients.service.ts', join(__dirname, '..', 'clients', 'clients.service.ts')],
      ['profile.service.ts', join(__dirname, '..', 'profile', 'profile.service.ts')],
    ] as const;
    for (const [nome, file] of SERVIZI) {
      const testo = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
      const riga = testo.match(/^\s*digiuno:\s*(.+)$/m);
      if (!riga) { sbagliati.push(`${nome}: nessun campo \`digiuno:\``); continue; }
      if (!/fasceDelDigiuno\(/.test(riga[1])) sbagliati.push(`${nome}: ${riga[1].trim()}`);
    }
    expect(sbagliati).toEqual([]);
  });
});
