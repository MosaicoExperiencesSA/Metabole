/**
 * ⛔ **LA CODA «DA VALIDARE» STA IN UN POSTO SOLO — e da oggi quel posto è la pagina Attività.**
 *
 * Richiesta di Simone del 22/8: *«togliamo il "da validare" in dashboard che non mi piace ed
 * unifichiamolo con questo»*. Il riquadro è stato **estratto** da `NutritionistHome.tsx` in
 * `components/CodaDaValidare.tsx` e disegnato in `AttivitaCoach.tsx`.
 *
 * ⚠️ **Perché serve un test e non basta averlo fatto.** Uno spostamento di interfaccia si disfa nel
 * modo più banale del mondo: qualcuno rimette il riquadro in dashboard «perché lì era comodo», e
 * per una settimana la stessa coda vive in due pagine che si contraddicono — una aggiornata e una
 * no. *Se due punti rispondono alla stessa domanda, uno dei due deve chiamare l'altro*: qui il
 * punto è **uno**, e questo file lo tiene tale.
 *
 * ⚠️ Si legge il **sorgente**, come `frecce-anche-in-cima.spec.ts`: non c'è un modo onesto di
 * provare «questo componente non è montato in quell'altra pagina» senza guardare chi lo monta.
 *
 * ## ⛔ «UN POSTO SOLO» VUOL DIRE: NEL BACKOFFICE. Nell'app staff no, ed è voluto
 *
 * Il glob guarda `backoffice/src`. Nell'**app staff** la stessa coda si legge in due punti
 * (`NutriDashboard.tsx` e `NutriDiete.tsx`), e questo file non li vede — quindi la promessa del
 * titolo, presa alla lettera, sarebbe falsa. Sta scritto qui invece che lasciato credere.
 *
 * ⚠️ **E l'app non è stata toccata di proposito**: lì l'arrangiamento è già quello che Simone ha
 * chiesto — la dashboard mostra un **numero** e cinque righe di anteprima che portano alla pagina
 * `/diete`, che è dove si lavora. Quello che gli dava fastidio era il riquadro intero *dentro* la
 * dashboard, che c'era solo nel backoffice. Cambiare anche l'app sarebbe stato rifare a mano una
 * cosa già fatta, e per giunta con un rilascio OTA.
 */
import { describe, expect, it } from 'vitest';

/** I sorgenti, presi come li prende Vite. ⚠️ `eager`, o tornerebbero promesse e il test guarderebbe zero file. */
const SORGENTI: Record<string, string> = {
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../pages/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../lib/*.ts', { query: '?raw', import: 'default', eager: true }),
};

/**
 * ⚠️ Via i commenti prima di guardare: questo spostamento è **spiegato** in tre docstring che
 * nominano `validation-queue` e `CodaDaValidare`. Un test che si accende sulla propria spiegazione
 * costringe a cancellare la spiegazione, che è il contrario di quello che serve.
 */
const senzaCommenti = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const sorgente = (nome: string): string => {
  const chiave = Object.keys(SORGENTI).find((k) => k.endsWith(`/${nome}`));
  if (!chiave) throw new Error(`Sorgente non trovato: ${nome} (visti: ${Object.keys(SORGENTI).length})`);
  return senzaCommenti(SORGENTI[chiave]);
};

describe('⛔ la coda «Da validare»: un posto solo', () => {
  /** ⚠️ Se il glob non prende niente, tutto il resto passerebbe guardando il vuoto. */
  it('i sorgenti si leggono davvero', () => {
    expect(Object.keys(SORGENTI).length).toBeGreaterThan(10);
    expect(sorgente('CodaDaValidare.tsx')).toContain('validation-queue');
  });

  /**
   * ⛔ **Chi chiama l'endpoint è UNO.** È la prova che tiene: due pagine che leggono la stessa coda
   * sono due pagine che mostrano numeri diversi appena una delle due non si ricarica.
   */
  it('⛔ un solo file chiama `/nutritionist/validation-queue`', () => {
    const chiChiama = Object.entries(SORGENTI)
      .filter(([, testo]) => senzaCommenti(testo).includes('/nutritionist/validation-queue'))
      .map(([k]) => k.split('/').pop());
    expect(chiChiama).toEqual(['CodaDaValidare.tsx']);
  });

  /**
   * ⛔ E la dashboard della nutrizionista non la **disegna** più: era la richiesta.
   *
   * ⚠️ Si guarda il **titolo del riquadro**, non la stringa «Da validare» ovunque: la prima stesura
   * usava `not.toContain('Da validare')` su tutto il file, e vietava così anche il **rimando** che
   * la dashboard deve tenere («Le cose da validare stanno in Attività da fare →»). Un test che
   * impedisce la correzione di un altro difetto è un test scritto largo per pigrizia.
   */
  it('⛔ NutritionistHome non monta più la coda', () => {
    const home = sorgente('NutritionistHome.tsx');
    expect(home).not.toContain('CodaDaValidare');
    expect(home).not.toMatch(/<h2[^>]*>\s*Da validare/);
    expect(home).not.toContain('Presa visione');
  });

  /**
   * ⛔ **Ma un rimando ce l'ha, e deve averlo.** La pagina di destinazione dipende dal permesso
   * `coach_tasks`, che su un ambiente già vivo si accende a mano: senza rimando, una nutrizionista
   * con quel permesso ancora chiuso vedrebbe la coda clinica sparita da ogni schermata, senza un
   * errore e senza un messaggio.
   */
  it('⛔ ma la dashboard dice dove è finita', () => {
    const home = sorgente('NutritionistHome.tsx');
    expect(home).toContain('/attivita-coach');
    expect(home).toContain('da validare');
  });

  /** ⛔ La pagina Attività sì, ed è l'unica. */
  it('⛔ AttivitaCoach la monta', () => {
    const pagina = sorgente('AttivitaCoach.tsx');
    expect(pagina).toContain('<CodaDaValidare');
  });

  it('⛔ e nessun\'altra pagina la monta', () => {
    const chiMonta = Object.entries(SORGENTI)
      .filter(([k]) => !k.endsWith('/CodaDaValidare.tsx'))
      .filter(([, testo]) => senzaCommenti(testo).includes('<CodaDaValidare'))
      .map(([k]) => k.split('/').pop());
    expect(chiMonta).toEqual(['AttivitaCoach.tsx']);
  });
});

describe('⛔ i pulsanti non hanno cambiato nome nel trasloco', () => {
  /**
   * ⛔ **«Presa visione» non è «Fatto».** Unificare due elenchi è la tentazione di unificare anche i
   * pulsanti: sarebbe stato dare a un pulsante un nome che non descrive quello che fa. «Presa
   * visione» registra una lettura e **non applica** la proposta del motore; «Fatto» chiude
   * un'attività. Il 19/8 questa stessa confusione è costata la rinomina di «Conferma», e la nota
   * che lo spiega è ancora in pagina.
   */
  it.each([['Presa visione'], ['Correggi…']])('⛔ «%s» è ancora lì', (etichetta) => {
    expect(sorgente('CodaDaValidare.tsx')).toContain(etichetta);
  });

  /**
   * ⛔ E la riga che dice cosa fanno quei pulsanti non si è persa per strada.
   *
   * ⚠️ **Riscritta il 28/8, e il test con lei.** Prima diceva che «in nessuno dei due casi» il piano
   * veniva toccato: era vero, e ha smesso di esserlo quando dentro «Correggi…» è nata **«Alza le
   * calorie»**, che il piano lo cambia davvero. Un test che si limitasse a cercare le parole vecchie
   * avrebbe tenuto in pagina una frase falsa — e falsa nel verso peggiore, perché avrebbe fatto
   * premere un pulsante a chi ha appena letto che non fa niente. Adesso il test chiede tutt'e due le
   * metà: che «Presa visione» non applichi, e che si dica che una delle azioni sì.
   */
  it('⛔ resta scritto che «Presa visione» non applica la proposta', () => {
    expect(sorgente('CodaDaValidare.tsx')).toContain('non viene');
    expect(sorgente('CodaDaValidare.tsx')).toContain('applicata al piano');
  });

  it('⛔ e che una delle azioni di «Correggi…» il piano lo cambia davvero', () => {
    const src = sorgente('CodaDaValidare.tsx');
    expect(src).toContain('Alza le calorie');
    expect(src).toContain('il piano lo cambia davvero');
  });
});

describe('⚠️ l\'interruttore del blocco non è rimasto acceso a vuoto', () => {
  /**
   * ⚠️ Un blocco che non si disegna più ma ha ancora il suo interruttore nelle preferenze è un
   * interruttore che non comanda niente: chi lo spegne crede di aver spento qualcosa.
   */
  it('⛔ `b_da_validare` non è più fra i blocchi della home', () => {
    expect(sorgente('dashboardModules.ts')).not.toMatch(/id:\s*'b_da_validare'/);
  });

  /** ⚠️ E gli altri blocchi della nutrizionista ci sono ancora: questa consegna toglie uno, non tre. */
  it.each([['b_pazienti'], ['b_regole_motore'], ['b_assistente']])('⚠️ «%s» c\'è ancora', (id) => {
    expect(sorgente('dashboardModules.ts')).toContain(`id: '${id}'`);
  });
});
