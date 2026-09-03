/**
 * ⛔ **LE PAROLE DELL'AVVISO «APERTA LO STESSO», fuori dal componente.**
 *
 * Sta in `lib/` per la stessa ragione di `famiglieDiete.ts`: è **la parte che si può sbagliare in
 * silenzio**. Un'etichetta che dice «aperta da Gestione dieta» quando la porta è aperta da
 * tutt'altro manda Simone a spegnere la cosa sbagliata, e poi a credere di aver chiuso. ⚠️ E una
 * revisione avversariale ha misurato che le prove sul componente — grep sul sorgente — passavano
 * tutte anche svuotando `AvvisoPortaAperta` a `return null`: la sola logica nuova del frontend non
 * era misurata da nessuno. Una funzione pura si prova; un ternario dentro il JSX no.
 */

export type Provenienza = 'hub' | 'riga del genitore' | 'default' | 'ruolo di base' | 'riga propria';

export interface CellaAperta {
  role: string;
  pageKey: string;
  livello: 'view' | 'manage';
  provenienza: Provenienza;
  /** La chiave di PAGINA che concede (hub, o genitore). */
  chiave?: string;
  /** La chiave di RUOLO che il guardiano legge davvero, quando non è quella della colonna. */
  ruolo?: string;
}

export interface Parole {
  /** Due o tre parole dentro l'etichetta gialla. */
  breve: string;
  /** La frase intera nel `title`, che dice anche cosa fare. */
  lunga: string;
}

/**
 * `nomePagina` e `nomeRuolo` arrivano da fuori (`pageLabel`, l'elenco dei ruoli): questa funzione
 * non conosce nessuna tabella, e non ne tiene una copia.
 *
 * ⛔ **Nessun ramo inventa un consiglio che non si può seguire.** Per `'default'` non c'è nessun
 * permesso su cui agire — il valore sta nel codice del backend — e dire «agisci sul permesso che la
 * concede» manderebbe a cercare una cosa che non esiste.
 */
export function paroleDellaPorta(
  cella: CellaAperta,
  nomePagina: (k: string) => string,
  nomeRuolo: (k: string) => string,
): Parole {
  const pagina = cella.chiave ? nomePagina(cella.chiave) : null;
  const ruolo = cella.ruolo ? nomeRuolo(cella.ruolo) : null;
  /**
   * ⛔ **Senza la chiave, il ramo che la nomina non si prende.** Una prova l'ha trovato subito:
   * l'etichetta scriveva «aperta da **null**» e il consiglio diceva «agisci su «null»». Un avviso
   * che nomina il nulla è peggio di un avviso generico, perché sembra preciso.
   */
  const generico: Parole = { breve: 'aperta lo stesso', lunga: 'Aperta lo stesso da un altro permesso.' };
  switch (cella.provenienza) {
    case 'hub':
      if (!pagina) return generico;
      return {
        breve: `aperta da ${pagina}`,
        lunga: `Aperta lo stesso da «${pagina}», che concede questa sezione. Spegnere questa casella non chiude la porta: agisci su «${pagina}».`,
      };
    case 'riga del genitore':
      if (!pagina) return generico;
      return {
        breve: `eredita ${pagina}`,
        lunga: `Aperta lo stesso: senza una riga sua, questa sezione eredita «${pagina}». Per chiuderla, spegni «${pagina}» oppure salva una riga esplicita qui.`,
      };
    case 'ruolo di base':
      if (!ruolo) return generico;
      return {
        breve: `vale ${ruolo}`,
        lunga: `Le API guardano il ruolo di base «${ruolo}», non questa colonna: qui si spegne la voce di menu, non la porta. Per chiuderla davvero, agisci sulla colonna «${ruolo}».`,
      };
    case 'default':
      return {
        breve: 'aperta dal default',
        lunga: 'Questa sezione non ha ancora una riga sua: vale il valore predefinito del ruolo, che è acceso.',
      };
    default:
      /**
       * ⚠️ Neutro **e vero per qualunque caso**: se un giorno il backend aggiunge una provenienza,
       * questa etichetta resta corretta invece di dire una cosa sbagliata con sicurezza. *Mentire
       * con precisione è peggio che dire poco.*
       */
      return generico;
  }
}
