/**
 * ⛔ **OGNI TIPO DI DOMANDA DEVE AVERE LA SUA STRADA IN CHAT — e finora non era vero.**
 *
 * Il difetto, trovato in revisione il 25/8, era il peggiore della consegna sui percorsi
 * supervisionati. `TipoRichiesta` è un'unione di stringhe; `prossimaRichiesta` non fa uno `switch`
 * esaustivo ma **un `if` e un ramo generico**. Quindi aggiungere un tipo nuovo non rende rosso
 * niente: il compilatore è contento, i test passano, e la domanda cade nel ramo generico — che
 * chiede *«quali alimenti tolgo dal piatto?»* e scrive la risposta **fra le intolleranze della
 * cliente**, via `ClientsService.updateClient`, con audit, come se l'avesse dettata una
 * nutrizionista. E il giro dopo Vera chiede se vale «per tutte», cioè propone una voce del
 * dizionario di tutte le clienti nata da un promemoria di sorveglianza.
 *
 * ⚠️ Questo file è il guardiano che mancava: **elenca i tipi e dice, per ciascuno, dove va**. Un
 * tipo nuovo senza una riga qui è rosso, e chi lo aggiunge deve scegliere — o gli dà un ramo, o
 * dichiara per iscritto che il ramo generico va bene per lui.
 *
 * ⛔ «Va bene per lui» vuol dire una cosa precisa: *rispondere a questa domanda con un elenco di
 * alimenti scrive la cosa giusta sul profilo di quella cliente*. Se non è così, serve un ramo.
 */
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const SRC = resolve(__dirname, '..');

/**
 * I tipi, e la strada che ciascuno deve prendere.
 *  · `alimenti` = il ramo generico: la risposta è un elenco di cibi da togliere dal piatto;
 *  · `<passo>` = ha un suo passo dedicato, e la risposta NON tocca le esclusioni della cliente.
 */
const STRADA: Record<string, string> = {
  allergia_da_tradurre: 'alimenti',
  intolleranza_da_tradurre: 'alimenti',
  girata_da_gaia: 'risposta_cliente',
  // ⛔ Il promemoria di sorveglianza: si legge e si mette da parte. Nessuna risposta scrive niente.
  supervisione_da_guardare: 'promemoria_supervisione',
};

/** I tipi dichiarati in `TipoRichiesta`, letti dal file invece che ricopiati. */
function tipiDichiarati(): string[] {
  const testo = readFileSync(join(SRC, 'vera/apri-richiesta.ts'), 'utf8');
  const blocco = testo.slice(testo.indexOf('export type TipoRichiesta'), testo.indexOf(';', testo.indexOf('export type TipoRichiesta')));
  return [...blocco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('⛔ nessun tipo di domanda finisce nel ramo sbagliato', () => {
  it('⛔ ogni tipo dichiarato ha la sua strada scritta qui', () => {
    const senzaStrada = tipiDichiarati().filter((t) => !(t in STRADA));
    expect(
      senzaStrada.length
        ? `${senzaStrada.join(', ')}\n→ Tipo nuovo in «TipoRichiesta» senza una strada dichiarata. `
          + 'Il ramo generico di `prossimaRichiesta` chiede «quali alimenti tolgo dal piatto?» e '
          + 'scrive la risposta fra le esclusioni della cliente: va bene solo se è davvero quello '
          + 'che deve succedere. Se no, dagli un passo suo e aggiungilo a STRADA.'
        : '',
    ).toBe('');
  });

  it('⚠️ e non ci sono strade dichiarate per tipi che non esistono più', () => {
    const dichiarati = new Set(tipiDichiarati());
    expect(Object.keys(STRADA).filter((t) => !dichiarati.has(t))).toEqual([]);
  });

  /**
   * ⛔ **E la strada dichiarata esiste davvero nel codice.** Senza questo, `STRADA` sarebbe un
   * elenco di buone intenzioni: si può scrivere «ha il suo passo» e non averlo scritto.
   */
  it('⛔ ogni tipo con un passo dedicato ha il suo ramo in `prossimaRichiesta`', () => {
    const servizio = readFileSync(join(SRC, 'vera/vera-chat.service.ts'), 'utf8');
    const passi = readFileSync(join(SRC, 'vera/vera-chat.ts'), 'utf8');
    const mancanti: string[] = [];
    for (const [tipo, strada] of Object.entries(STRADA)) {
      if (strada === 'alimenti') continue;
      // Il passo è dichiarato…
      if (!passi.includes(`'${strada}'`)) mancanti.push(`${tipo}: il passo «${strada}» non è in PassoVera`);
      // …c'è un ramo che ci porta…
      if (!servizio.includes(`passo: '${strada}'`)) mancanti.push(`${tipo}: nessuno porta al passo «${strada}»`);
      // …e qualcuno lo gestisce quando arriva la risposta.
      if (!servizio.includes(`case '${strada}':`)) mancanti.push(`${tipo}: il passo «${strada}» non è gestito`);
    }
    expect(mancanti).toEqual([]);
  });

  /**
   * ⛔ **Il ramo generico scrive sul profilo sanitario: chi ci finisce va nominato.** È la riga che
   * rende questo file utile fra sei mesi, quando nessuno si ricorderà perché esiste.
   */
  it('⛔ solo i due tipi «traduci questa parola» passano dal ramo che scrive le esclusioni', () => {
    const conAlimenti = Object.entries(STRADA).filter(([, s]) => s === 'alimenti').map(([t]) => t);
    expect(conAlimenti.sort()).toEqual(['allergia_da_tradurre', 'intolleranza_da_tradurre']);
  });
});
