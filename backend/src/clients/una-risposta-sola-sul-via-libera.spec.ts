/**
 * ⛔ **«PERCORSO SUPERVISIONATO» NON VUOL DIRE «I MENU SONO FERMI» — 31/8, il caso Patrizia.**
 *
 * Lei aveva il **via libera clinico dalle 06:34**. Alle 09 la sua scheda mostrava ancora il bollino
 * rosso «Percorso supervisionato», e `diag:cliente` chiudeva con «Menu dopo la visita — si sblocca
 * fissando e svolgendo la visita». Due persone hanno passato mezza mattinata a cercare di
 * sbloccare una visita che non c'era da fare, mentre il menu era fermo per tutt'altro.
 *
 * ## Perché, e perché è la seconda volta
 *
 * `screeningFlag` è un **fatto**: il questionario l'ha segnalata, e resta vero per sempre. Il
 * **cancello** è la decisione clinica (`statoSupervisione`). Il 23/8 quel difetto era stato chiuso
 * nella card della cliente e nel gate del menu — ma la **scheda dello staff** e la **diagnostica**
 * continuavano a rispondere per conto loro guardando il solo flag.
 *
 * ⛔ La ragione per cui torna è sempre la stessa: la domanda «i menu si fermano?» aveva **tre**
 * risposte in tre file. Adesso ne ha **una**, quella che ferma davvero l'erogazione, e le due
 * schermate la **mostrano** invece di ricalcolarla. *Se due punti rispondono alla stessa domanda,
 * uno deve chiamare l'altro.*
 */
import { statoSupervisione } from './via-libera-clinico';

const IERI = new Date(Date.now() - 86_400_000);
const DOMANI = new Date(Date.now() + 86_400_000);

describe('il fatto e il cancello sono due cose diverse', () => {
  it('⛔ IL CASO PATRIZIA: segnalata dal questionario MA con il via libera → i menu NON sono fermi', () => {
    const st = statoSupervisione({ screeningFlag: true, idoneita: 'idonea' });
    expect(st.supervisionata).toBe(true); // il fatto resta vero
    expect(st.bloccata).toBe(false); // il cancello è aperto
  });

  it('segnalata e mai valutata: fermi, ed è la regola di sicurezza', () => {
    const st = statoSupervisione({ screeningFlag: true, idoneita: null });
    expect(st.bloccata).toBe(true);
    expect(st.motivo).toBe('mai_valutata');
  });

  it('«serve una visita» entro domani: NON fermi — il giorno della scadenza è ancora libero', () => {
    const st = statoSupervisione({ screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: DOMANI });
    expect(st.bloccata).toBe(false);
    expect(st.motivo).toBe('visita_da_fare');
  });

  it('⛔ «serve una visita» scaduta ieri: fermi, e il motivo è un ALTRO', () => {
    const st = statoSupervisione({ screeningFlag: true, idoneita: 'serve_visita', idoneitaVisitaEntro: IERI });
    expect(st.bloccata).toBe(true);
    expect(st.motivo).toBe('visita_scaduta');
  });

  it('mai segnalata dal questionario: non è affare di questa regola', () => {
    expect(statoSupervisione({ screeningFlag: false, idoneita: null }).bloccata).toBe(false);
  });
});

/**
 * ⛔ Le due schermate che il 31/8 hanno mentito. Si guardano nel **sorgente**: sono un file di
 * diagnostica e una pagina React, e quello che conta è che non ricalcolino la risposta da sé.
 */
describe('la diagnostica non ricalcola la risposta: la chiede a chi la sa', () => {
  const sorgente = require('fs').readFileSync(`${__dirname}/../../prisma/diag-cliente.ts`, 'utf8') as string;

  it('⛔ CHIEDE la decisione clinica al database: senza, `statoSupervisione` risponde sempre «mai valutata»', () => {
    expect(sorgente).toMatch(/idoneita:\s*true/);
    expect(sorgente).toMatch(/idoneitaVisitaEntro:\s*true/);
  });

  it('⛔ il verdetto si dirama su `bloccata`, NON sul solo `screeningFlag`', () => {
    expect(sorgente).toContain('} else if (supervisione.bloccata) {');
    // La forma vecchia — il ramo che diceva «Menu dopo la visita» a chiunque fosse segnalata.
    expect(sorgente).not.toContain('} else if (p?.screeningFlag) {');
  });
});

describe('la scheda dello staff riceve la risposta dal backend', () => {
  const servizio = require('fs').readFileSync(`${__dirname}/clients.service.ts`, 'utf8') as string;
  const scheda = require('fs').readFileSync(`${__dirname}/../../../backoffice/src/pages/ClientDetail.tsx`, 'utf8') as string;

  it('⛔ il backend calcola `bloccata` con la funzione che ferma davvero l\'erogazione', () => {
    expect(servizio).toContain('statoSupervisione(profile as never)');
    expect(servizio).toMatch(/bloccata:\s*st\.bloccata/);
  });

  it('⛔ e il bollino della scheda guarda quella, non il flag da solo', () => {
    // Il bollino rosso non deve più essere l'unica conseguenza di `screeningFlag`.
    expect(scheda).not.toContain('{p?.screeningFlag && <span className="chip red">Percorso supervisionato</span>}');
    expect(scheda).toContain('d?.idoneita?.bloccata === false');
  });
});
