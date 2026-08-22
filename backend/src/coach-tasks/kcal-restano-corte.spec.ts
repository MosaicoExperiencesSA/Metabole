/**
 * ⛔ **LA TERZA CONDIZIONE DEL §3 — i test.**
 *
 * Il foglio decisioni la chiama la migliore delle tre perché non guarda il nome del protocollo ma le
 * calorie che la cliente riceve davvero. Per tre giorni il codice ha dichiarato in tre punti che non
 * la calcolava nessuno; questi test sono la prova che adesso la calcola.
 *
 * ⚠️ Le prove che contano sono due, e nessuna delle due è sul testo:
 *
 *  - **quando NON si apre** (`decisioneKcalCorte`). `deliverIfEligible` gira a ogni apertura
 *    dell'app: la prima stesura avrebbe aperto un'attività sull'**arrotondamento** dei pasti (12,4%
 *    delle giornate) e una seconda attività contraddittoria accanto a «pasti non serviti». *Un
 *    avviso che compare sempre non è un avviso.*
 *  - **il riferimento**: se ci entra la quota, una cliente stabile all'82,5% genera 80/85/80/85…
 *    cioè una decina di attività al mese per lo stesso identico problema clinico.
 */
import {
  TIPO_KCAL_CORTE,
  decisioneKcalCorte,
  laPiuCorta,
  meritaUnAvviso,
  motivoCorta,
  riferimentoKcalCorte,
  scadenzaKcalCorte,
  testoKcalCorte,
} from './kcal-restano-corte';
import { TIPI_DELLA_NUTRIZIONISTA } from './avvisi-attivita';
import { RUOLI_NUTRIZIONISTA } from '../common/ruoli-nutrizionista';
import { DEFAULT_PERMISSIONS } from '../permissions/pages';

const g = (data: string, quota: number, alTetto: string[] = []) => ({ data, quota, alTetto });
const FABBISOGNO = { kcal: 1850, fonte: 'need' as const };

describe('la giornata peggiore', () => {
  it('è la più corta, non la media', () => {
    expect(laPiuCorta([g('2026-08-20', 0.85), g('2026-08-21', 0.5), g('2026-08-22', 0.8)])?.data)
      .toBe('2026-08-21');
  });

  /**
   * ⚠️ **La media nasconderebbe la giornata che si mangia.** Fra una all'85% e una al 50% la media dà
   * il 67%, che sembra accettabile — e intanto quella al 50% la cliente se la mangia per intero.
   */
  it('⚠️ e infatti NON è la media: la giornata al 50% resta visibile', () => {
    expect(laPiuCorta([g('a', 0.85), g('b', 0.5)])!.quota).toBe(0.5);
  });

  it('nessuna giornata corta: niente da raccontare', () => {
    expect(laPiuCorta([])).toBeNull();
  });
});

describe('⛔ la soglia: «resta corta» da solo non basta per svegliare una persona', () => {
  /**
   * ⛔ **È la misura che ha fermato la prima stesura.** `porzione-scalata.ts` dichiara corta una
   * giornata con `kcalDopo < target - 0.5`, e `kcalDopo` è la somma dei valori **arrotondati per
   * pasto**: su 46.415 combinazioni provate, una su otto risultava «corta» con quote come 0,99946.
   * Come attività avrebbe prodotto *«Maria: riceve il 100% del suo fabbisogno — 1 giornata resta
   * sotto il fabbisogno»*, su quasi ogni cliente scalata, ogni settimana.
   */
  it('⛔ il 99,9% NON merita un\'attività: è l\'arrotondamento dei pasti', () => {
    expect(meritaUnAvviso(0.99946, 15)).toBe(false);
  });

  it('⛔ il 68% sì', () => {
    expect(meritaUnAvviso(0.68, 15)).toBe(true);
  });

  /**
   * ⛔ **La soglia è quella del motore, passata da chi chiama, non una costante nuova.** Due soglie
   * sulla stessa domanda divergono in un pomeriggio: è già scritto nell'elenco lavori come una cosa
   * successa, non come un rischio. Il test lo tiene fermo: cambiando la tolleranza cambia l'esito.
   */
  it('⛔ dipende dalla tolleranza che le passi, non da un numero suo', () => {
    expect(meritaUnAvviso(0.9, 15)).toBe(false); // dentro il 15%
    expect(meritaUnAvviso(0.9, 5)).toBe(true); // fuori dal 5%
  });

  /** ⚠️ Il bordo esatto non è un avviso: «uguale alla tolleranza» vuol dire dentro. */
  it('⚠️ esattamente al bordo della tolleranza: dentro', () => {
    expect(meritaUnAvviso(0.85, 15)).toBe(false);
  });
});

describe('⛔ si apre o no — e se no, si dice perché', () => {
  const PEGGIORE = g('2026-08-22', 0.68, ['lunch']);

  it('caso normale: si apre', () => {
    expect(decisioneKcalCorte({ peggiore: PEGGIORE, tolleranzaPct: 15, pastiMancanti: [], altraAttivitaAperta: true }))
      .toEqual({ apri: true });
  });

  it('nessuna giornata corta: non si apre', () => {
    const d = decisioneKcalCorte({ peggiore: null, tolleranzaPct: 15, pastiMancanti: [], altraAttivitaAperta: true });
    expect(d.apri).toBe(false);
  });

  /**
   * ⛔ **DUE ATTIVITÀ CON DUE RIMEDI CHE SI CONTRADDICONO** (trovato in revisione, 22/8).
   *
   * `digiuno_pasti_non_serviti` nasce nello **stesso identico giro** di `deliverIfEligible`, sullo
   * stesso fatto visto da un'altra parte: se il catalogo non ha la colazione che la finestra
   * promette, ovvio che le calorie non tornano. Aprirle tutte e due mandava alla nutrizionista
   * «genera la variante mancante» e «dalle una dieta più sostanziosa» sulla stessa cliente, nello
   * stesso minuto. *Un fatto, un'attività* — e vince quella che dice la **causa**.
   */
  it('⛔ se le mancano dei pasti a catalogo, NON si apre: lo dice già l\'altra attività', () => {
    const d = decisioneKcalCorte({ peggiore: PEGGIORE, tolleranzaPct: 15, pastiMancanti: ['breakfast'], altraAttivitaAperta: true });
    expect(d.apri).toBe(false);
    expect(d.apri === false && d.perche).toContain('breakfast');
    expect(d.apri === false && d.perche).toContain('pasti non serviti');
  });

  it('⛔ dentro la tolleranza: NON si apre, ed è l\'arrotondamento', () => {
    const d = decisioneKcalCorte({ peggiore: g('2026-08-22', 0.999), tolleranzaPct: 15, pastiMancanti: [], altraAttivitaAperta: true });
    expect(d.apri).toBe(false);
    expect(d.apri === false && d.perche).toContain('arrotondamento');
  });

  /**
   * ⛔ **Ogni «no» ha una frase, e chi chiama la scrive nel log.** *Se degradi, dillo*: senza,
   * fra sei mesi chi guarda una cliente al 70% senza attività non ha modo di sapere se il codice ha
   * deciso di tacere o si è rotto.
   */
  it.each([
    ['nessuna giornata', { peggiore: null, tolleranzaPct: 15, pastiMancanti: [], altraAttivitaAperta: true }],
    ['pasti mancanti', { peggiore: PEGGIORE, tolleranzaPct: 15, pastiMancanti: ['breakfast'], altraAttivitaAperta: true }],
    ['dentro tolleranza', { peggiore: g('x', 0.99), tolleranzaPct: 15, pastiMancanti: [], altraAttivitaAperta: true }],
  ])('⛔ «%s»: il perché non è mai vuoto', (_t, dati) => {
    const d = decisioneKcalCorte(dati);
    expect(d.apri).toBe(false);
    expect(d.apri === false && d.perche.length).toBeGreaterThan(10);
  });

  /**
   * ⛔ **E se l'altra attività è già CHIUSA, questa torna a parlare** (seconda revisione, 22/8).
   *
   * Anche `digiuno_pasti_non_serviti` si deduplica senza guardare lo stato: se la nutrizionista la
   * segna «fatta» senza generare la variante a catalogo, non rinasce più. Rimandandole comunque,
   * una cliente al 70% del target sarebbe rimasta **senza nessuna attività, per sempre**: due
   * silenzi che si tengono a vicenda. Lei ha deciso sui pasti, non sulle calorie.
   */
  it('⛔ pasti mancanti ma l\'altra attività è chiusa: si apre lo stesso', () => {
    const d = decisioneKcalCorte({
      peggiore: PEGGIORE, tolleranzaPct: 15, pastiMancanti: ['breakfast'], altraAttivitaAperta: false,
    });
    expect(d).toEqual({ apri: true });
  });

  /**
   * ⚠️ **L'ordine dei controlli conta.** I pasti mancanti vengono PRIMA della tolleranza: una
   * cliente a cui manca la colazione e che sta al 99% non deve ricevere «è l'arrotondamento» come
   * spiegazione, perché non è quello il motivo per cui taciamo.
   */
  it('⚠️ i pasti mancanti vengono prima della tolleranza', () => {
    const d = decisioneKcalCorte({ peggiore: g('x', 0.99), tolleranzaPct: 15, pastiMancanti: ['breakfast'], altraAttivitaAperta: true });
    expect(d.apri === false && d.perche).toContain('pasti non serviti');
  });
});

describe('⛔ il riferimento: una per situazione, non una al giorno', () => {
  const SIT = { finestra: 'skip_breakfast', pastiEsclusi: ['morning_snack'] };

  /**
   * ⛔ **LA CHIAVE È QUESTA, TUTTA QUANTA, E NIENT'ALTRO.**
   *
   * Il valore esatto invece di «non contiene una data»: chiedere cosa **non** c'è dentro non prova
   * niente — passerebbe qualunque implementazione che non chiami `new Date()`. Così invece qualunque
   * pezzo aggiunto (la data, la quota, la dieta, il protocollo) rompe il test, ed è proprio l'elenco
   * delle cose che nella prima stesura ci erano finite dentro.
   *
   * ⛔ La quota in particolare oscilla a ogni erogazione **per costruzione**, perché la giornata è
   * composta con ricette diverse: una cliente stabile intorno all'82,5% avrebbe generato
   * 80/85/80/85… cioè fino a una decina di attività al mese per lo stesso problema clinico.
   */
  it('⛔ la chiave è «finestra|spuntini», e basta', () => {
    expect(riferimentoKcalCorte(SIT)).toBe('skip_breakfast|morning_snack');
  });

  it('⛔ e senza niente è «nessuna|nessuno», non una stringa vuota', () => {
    expect(riferimentoKcalCorte({})).toBe('nessuna|nessuno');
  });

  /**
   * ⛔ **LA DIETA SERVITA NEMMENO.** Non è la dieta della cliente, è quella che esce dalla catena dei
   * ripieghi di `pickDietFor`: cambia quando una gemella completa una giornata a catalogo, cioè per
   * un motivo che a lei non cambia niente. ⚠️ `pasti-non-serviti.ts` l'aveva già escluso **con questa
   * stessa motivazione scritta**, e la prima stesura di questo file ha fatto il contrario nel file
   * accanto.
   */
  it('⛔ un campo in più nella situazione non sposta il riferimento', () => {
    const conDieta = { ...SIT, dietId: 'd2' } as Parameters<typeof riferimentoKcalCorte>[0];
    expect(riferimentoKcalCorte(conDieta)).toBe(riferimentoKcalCorte(SIT));
  });

  it.each([
    ['la finestra si sposta', { ...SIT, finestra: 'skip_breakfast_and_snacks' }],
    ['le tolgono un altro spuntino', { ...SIT, pastiEsclusi: ['morning_snack', 'afternoon_snack'] }],
  ])('⚠️ %s: riferimento nuovo, attività nuova', (_titolo, nuova) => {
    expect(riferimentoKcalCorte(nuova)).not.toBe(riferimentoKcalCorte(SIT));
  });

  /** ⚠️ L'ordine degli spuntini tolti non è un'informazione: due elenchi uguali danno la stessa chiave. */
  it('⚠️ l\'ordine degli spuntini non conta', () => {
    expect(riferimentoKcalCorte({ ...SIT, pastiEsclusi: ['b', 'a'] }))
      .toBe(riferimentoKcalCorte({ ...SIT, pastiEsclusi: ['a', 'b'] }));
  });

  /** ⚠️ Niente finestra e niente spuntini è **una** situazione, non l'assenza di situazione. */
  it('⚠️ nullo e vuoto sono la stessa situazione', () => {
    expect(riferimentoKcalCorte({})).toBe(riferimentoKcalCorte({ finestra: null, pastiEsclusi: [] }));
  });
});

describe('⛔ perché resta corta: le cause, e le strade sono diverse', () => {
  it.each([
    ['finestra', { finestra: 'skip_breakfast', pastiEsclusi: [] }],
    ['spuntini_tolti', { finestra: null, pastiEsclusi: ['morning_snack'] }],
    ['finestra_e_spuntini', { finestra: 'skip_breakfast', pastiEsclusi: ['morning_snack'] }],
    ['catalogo', { finestra: null, pastiEsclusi: [] }],
  ])('%s', (atteso, situazione) => {
    expect(motivoCorta(situazione)).toBe(atteso);
  });

  /** ⚠️ La stringa vuota non è una finestra: è il campo mai riempito. */
  it('⚠️ finestra vuota non è una finestra', () => {
    expect(motivoCorta({ finestra: '   ', pastiEsclusi: [] })).toBe('catalogo');
  });

  /**
   * ⛔ **Il caso «catalogo» manda da un'altra parte, e deve dirlo.** Lì le porzioni non c'entrano
   * niente: non c'è nessuna finestra da guardare e nessuno spuntino da rimettere. Mandare la
   * nutrizionista sui tetti sarebbe mandarla a girare una manopola che non è collegata.
   *
   * ⚠️ E la strada si dice **a parole**, non con un comando: la prima stesura scriveva «la strada è
   * npm run diag:varieta», che si lancia dalla shell di Render — cioè lo stesso difetto del
   * consiglio sui tetti, corretto due paragrafi sopra nello stesso file.
   */
  it('⛔ senza finestra e senza spuntini tolti, dice che è il catalogo', () => {
    const t = testoKcalCorte('Maria', g('2026-08-22', 0.8), 1, { finestra: null, pastiEsclusi: [] }, FABBISOGNO);
    expect(t.description).toContain('NON dipende dalla finestra');
    expect(t.description).toContain('giornate più sostanziose');
  });

  /** ⛔ E in nessun ramo del testo compare un comando da terminale. */
  it.each([
    ['finestra', { finestra: 'skip_breakfast', pastiEsclusi: [] }],
    ['spuntini', { finestra: null, pastiEsclusi: ['morning_snack'] }],
    ['catalogo', { finestra: null, pastiEsclusi: [] }],
  ])('⛔ «%s»: niente «npm run» nel testo che legge lei', (_t, situazione) => {
    const t = testoKcalCorte('Maria', g('2026-08-22', 0.8), 1, situazione, FABBISOGNO);
    expect(t.description).not.toContain('npm run');
  });
});

describe('il testo che legge la nutrizionista', () => {
  const PEGGIORE = g('2026-08-22', 0.68, ['lunch', 'dinner']);
  const SIT = { finestra: 'skip_breakfast', pastiEsclusi: [] };
  const testo = () => testoKcalCorte('Maria', PEGGIORE, 3, SIT, FABBISOGNO);

  /**
   * ⛔ **Il numero, non «è sotto target».** Su «il 68% del suo fabbisogno» si può decidere; su «sotto
   * target» no — è la differenza fra un'informazione e un'etichetta.
   */
  it('⛔ dice la percentuale nel titolo, dove si legge in un elenco', () => {
    expect(testo().title).toBe('Maria: riceve il 68% del suo fabbisogno');
  });

  it('dice quante giornate e il numero in kcal', () => {
    const d = testo().description;
    expect(d).toContain('3 giornate');
    expect(d).toContain('1850 kcal');
  });

  /**
   * ⛔ **«FABBISOGNO» SOLO QUANDO LO È** (trovato in revisione, 22/8).
   *
   * Il motore punta al fabbisogno calcolato **solo** se il «menu a necessità» è acceso e il profilo
   * basta (`targetSource === 'need'`). Negli altri casi punta alle kcal del livello dichiarate a
   * catalogo — un numero che col fabbisogno di quella persona può non c'entrare niente. Dire
   * «riceve il 68% del suo fabbisogno» quando il conto è sul livello manda la nutrizionista a
   * cercare un problema clinico dove c'è una dieta tarata bassa. *Una ragione falsa è peggio di un
   * ordine sbagliato.*
   */
  it('⛔ col target dal LIVELLO della dieta non lo chiama fabbisogno', () => {
    const t = testoKcalCorte('Maria', PEGGIORE, 3, SIT, { kcal: 1850, fonte: 'level' });
    expect(t.title).not.toContain('fabbisogno');
    expect(t.description).not.toContain('fabbisogno');
    expect(t.title).toContain('delle kcal previste dalla sua dieta');
    expect(t.description).toContain('le kcal del livello della sua dieta');
  });

  it('⚠️ e col fabbisogno vero lo chiama fabbisogno', () => {
    expect(testo().title).toContain('del suo fabbisogno');
    expect(testo().description).toContain('il suo fabbisogno calcolato');
  });

  /**
   * ⛔ **«Misurato sul suo menu vero»** è la riga che distingue questa condizione dalle altre due del
   * §3: quelle guardano il nome del protocollo, questa il piatto.
   */
  it('⛔ dichiara che è misurato, non dedotto dal protocollo', () => {
    expect(testo().description).toContain('Misurato sul suo menu vero');
  });

  /** ⚠️ E che NON è ferma: senza quella riga, «riceve il 68%» si legge come un guasto. */
  it('⚠️ dice che i menu le arrivano lo stesso', () => {
    expect(testo().description).toContain('non è bloccata');
  });

  /**
   * ⛔ **NON LA MANDA DOVE NON PUÒ ANDARE — due porte, tutte e due imparate sbagliando.**
   *
   * La finestra la sposta la cliente dall'app (correzione del 21/8, già fatta sugli altri due testi
   * del digiuno). E i tetti delle porzioni non sono roba sua: `porzione_tetto_*` non compare in
   * **nessuna** schermata del backoffice, non sta nelle Regole del motore, si cambia solo da
   * `PATCH /admin/config/:key` — che è admin — ed è **globale**, cioè toccarlo per una cliente
   * cambia il piatto a tutte. La prima stesura glielo consigliava come prima strada.
   */
  it('⛔ non la manda a cambiare la finestra, che non può cambiare', () => {
    expect(testo().description).toContain('la sposta lei');
  });

  it('⛔ e NON le consiglia i tetti delle porzioni, che non può toccare', () => {
    const d = testo().description;
    expect(d).not.toContain('porzione_tetto');
    expect(d).toContain('li tocca solo l\'amministratore');
  });

  /** ⛔ Le strade che le resta le dice, o l'attività è una lamentela. */
  it('⛔ dice cosa può fare LEI', () => {
    const d = testo().description;
    expect(d).toContain('dieta di livello più alto');
    expect(d).toContain('a catalogo');
  });

  it('e dice che si può anche decidere che va bene così', () => {
    expect(testo().description).toContain('segna l\'attività fatta');
  });

  /**
   * ⚠️ **Niente markdown nel testo.** La pagina Attività (`AttivitaCoach.tsx`) disegna la
   * descrizione come testo semplice: un `**grassetto**` esce con gli asterischi in mezzo alla frase.
   */
  it('⚠️ niente asterischi: la pagina lo mostra come testo semplice', () => {
    expect(testo().description).not.toContain('**');
    expect(testo().title).not.toContain('**');
  });

  /** ⚠️ Senza nome resta una frase, non un buco. */
  it('⚠️ senza nome non lascia un buco nel titolo', () => {
    expect(testoKcalCorte(null, PEGGIORE, 1, SIT, FABBISOGNO).title).toContain('la cliente');
    expect(testoKcalCorte('   ', PEGGIORE, 1, SIT, FABBISOGNO).title).toContain('la cliente');
  });

  /**
   * ⛔ **«Al tetto» e «non al tetto» sono due diagnosi diverse**, e portano a due azioni diverse:
   * col tetto raggiunto le porzioni sono finite, senza vuol dire che il buco viene da quanti pasti
   * riceve.
   */
  it('⛔ dice se i pasti sono già al tetto, perché cambia cosa fare', () => {
    expect(testo().description).toContain('già al tetto');
    const senza = testoKcalCorte('Maria', g('2026-08-22', 0.68, []), 1, SIT, FABBISOGNO).description;
    expect(senza).toContain('nessun pasto è al tetto');
    expect(senza).toContain('da quanti pasti riceve');
  });

  /** ⚠️ Una giornata sola non si scrive «1 giornate». */
  it('⚠️ singolare e plurale', () => {
    expect(testoKcalCorte('Maria', PEGGIORE, 1, SIT, FABBISOGNO).description).toContain('1 giornata resta');
    expect(testo().description).toContain('3 giornate restano');
  });
});

/**
 * ⛔ **L'ATTIVITÀ ARRIVA A CHI PUÒ CHIUDERLA — tutte e due le metà.**
 *
 * `pasti-non-serviti.spec.ts` aveva la prima metà (il tipo è fra quelli della nutrizionista) e la
 * prima stesura di questo file non l'aveva copiata: l'attività sarebbe nata muta per lei.
 *
 * ⚠️ E la revisione del 22/8 ha trovato che **la prima metà da sola non basta**: la push le arrivava
 * dal 21/8 dicendo «la trovi in Dashboard», e la Dashboard rispondeva 403 — il permesso di pagina
 * `coach_tasks` per il suo ruolo era spento. Avvisare qualcuno di una cosa che non può guardare è
 * peggio che non avvisarlo.
 */
describe('⛔ l\'avviso arriva a chi può chiuderla, e la porta è aperta', () => {
  it('⛔ questo tipo è fra quelli della nutrizionista', () => {
    expect(TIPI_DELLA_NUTRIZIONISTA.has(TIPO_KCAL_CORTE)).toBe(true);
  });

  /** ⚠️ La costante e la stringa nell'elenco sono la stessa cosa: è un elenco fatto di stringhe. */
  it('⛔ la costante del tipo e la stringa nell\'elenco combaciano', () => {
    expect(TIPO_KCAL_CORTE).toBe('kcal_restano_corte');
    expect([...TIPI_DELLA_NUTRIZIONISTA]).toContain('kcal_restano_corte');
  });

  /**
   * ⛔ **La seconda metà: la pagina si apre.** Senza questo, chi aggiunge un quinto tipo della
   * nutrizionista in un ambiente nuovo ricrea lo stesso difetto — push che arriva, porta chiusa.
   */
  it.each([...RUOLI_NUTRIZIONISTA])('⛔ «%s» può aprire la pagina delle attività', (ruolo) => {
    const p = DEFAULT_PERMISSIONS[ruolo]?.coach_tasks;
    expect(p?.view).toBe(true);
    expect(p?.manage).toBe(true);
  });
});

describe('la scadenza', () => {
  /** ⚠️ Non è un'urgenza clinica: è una decisione da prendere, non da correre. */
  it('è a una settimana', () => {
    const d = scadenzaKcalCorte(new Date('2026-08-22T10:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-08-29');
  });
});
