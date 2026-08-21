/**
 * A CHI SI CHIEDE LA FINESTRA, E CON CHE COSA SI APRE LA PAGINA.
 *
 * Decisione di Simone del 21/8 (§14 porta 3, §17 del foglio decisioni): al primo avvio dopo il
 * rilascio, **le clienti già in digiuno atterrano sulla pagina dell'orologio** e scelgono loro.
 *
 * ## ⛔ Perché questo modulo esiste al posto di uno script di backfill
 *
 * La versione precedente della specifica prevedeva di **scrivere d'ufficio** protocollo e orario
 * nel profilo di ogni cliente, dedotti dalla sua finestra storica. Era il pezzo con più rischio di
 * tutta la consegna: una traduzione fatta a tavolino, scritta nel profilo di persone vere mentre
 * dormono, e che nessuna di loro ha chiesto.
 *
 * Qui la stessa traduzione c'è ancora — ma **non si salva**: diventa il valore con cui la pagina si
 * apre, cioè una proposta a schermo che si conferma o si cambia. *«Non lo so» deve costare meno di
 * «ho indovinato»*, e la differenza fra le due sta tutta in chi tocca il pulsante.
 *
 * ## ⚠️ E dove non so tradurre, non propongo niente
 *
 * `npm run diag:digiuni` (21/8) dice che le clienti in digiuno sono **sei**: cinque su
 * `skip_breakfast`, che l'orologio sa riprodurre esattamente, e **una** su `skip_dinner`, che no.
 *
 * Per quella la pagina si apre **vuota**, come per una cliente nuova, e quando sceglie parte una
 * segnalazione alla nutrizionista. Non c'è nessuna eccezione scritta per lei nel codice: la regola
 * è **«se non so tradurla, non la propongo, e lo dico a chi di dovere»**, e vale per tutte —
 * comprese quelle che si troveranno nello stesso caso fra sei mesi.
 *
 * ⚠️ Proporle la finestra «più vicina» sarebbe stato il difetto di Sonia rifatto da davanti:
 * servire a qualcuno pasti che non ha chiesto perché somigliano ai suoi.
 */
import { finestraDigiuno } from './finestre-digiuno';
import { derivaDaOrologio, type MarginiPasti, type SogliaPasti } from './orologio-digiuno';

/** Il minimo che serve per decidere. Strutturale: questo modulo non importa Prisma. */
export interface ProfiloPerOrologio {
  pathType?: string | null;
  fastingWindow?: string | null;
  /** `null` = non gliel'abbiamo ancora chiesto. Diverso da «non digiuna». */
  fastingSceltoIl?: Date | null;
}

export interface PropostaOrologio {
  protocollo: string;
  /** Minuti da mezzanotte. */
  inizioMin: number;
}

export interface Atterraggio {
  /** Se le si apre la pagina dell'orologio al prossimo avvio. */
  daChiedere: boolean;
  motivo: 'non_digiuna' | 'ha_gia_scelto' | 'mai_chiesta';
  /**
   * Con che finestra si apre la pagina. `undefined` = **vuota**, come per una cliente nuova:
   * la sua finestra storica non è riproducibile con l'orologio.
   */
  proposta?: PropostaOrologio;
  /**
   * ⚠️ Vero quando aveva una finestra e non si sa tradurla: qualunque cosa scelga, qualcosa cambia.
   * È il segnale da cui nasce l'evento per la nutrizionista (§15) — non un errore, una notizia.
   */
  finestraNonTraducibile: boolean;
}

interface ProposteRiga extends PropostaOrologio {
  /** Perché quella riga, in una frase. Serve a chi la legge fra un anno. */
  perche: string;
}

/**
 * LE PROPOSTE, una riga per finestra storica.
 *
 * ⚠️ È una tabella scritta a mano **e va bene**, perché è una tabella di *proposte*, non di
 * verità: dice «se aveva questa, aprile la pagina così». Ma non è lasciata a sé stessa — un test
 * chiede a `derivaDaOrologio` di confermare che ogni riga produce davvero la finestra a cui è
 * appesa. Il giorno che una soglia cambia, quel test lo dice invece di lasciar proporre a una
 * cliente una finestra che le cambierebbe i pasti in silenzio.
 *
 * ⚠️ Le finestre che **non** sono qui non sono dimenticate: sono quelle che l'orologio non sa
 * produrre, e per quelle la pagina si apre vuota. L'elenco di chi manca lo calcola
 * `finestreRaggiungibili()`, e un test lo dichiara per nome.
 *
 * Tutte finiscono alle 20:00: è l'ora di cena tipica, ed è quella del piano del manuale.
 */
export const PROPOSTE_DA_FINESTRA_STORICA: Record<string, ProposteRiga> = {
  // Cinque clienti su questa (21/8). Le dà esattamente i pasti che riceve già: pranzo, merenda,
  // cena, dallo stesso catalogo digiuno. Per loro confermare non cambia niente.
  skip_breakfast: { protocollo: '16:8', inizioMin: 12 * 60, perche: 'i suoi tre pasti, invariati' },
  // Le tre nate dall'orologio: nessuna cliente ce l'ha oggi, ma se domani qualcuno la scrive dalla
  // scheda staff, la pagina sa già come aprirsi.
  skip_morning_snack: { protocollo: '14:10', inizioMin: 10 * 60, perche: 'finestra lunga, quattro pasti' },
  skip_breakfast_and_snacks: { protocollo: '18:6', inizioMin: 14 * 60, perche: 'finestra stretta, due pasti' },
  skip_all_but_dinner: { protocollo: '23:1', inizioMin: 19 * 60, perche: 'un pasto solo' },
};



/**
 * ⚠️ **Chiedere è un fatto della cliente, non del calendario.** Non c'è nessuna data di rilascio
 * qui dentro, e nessun «prima del 21/8»: si guarda se il dato c'è. Così la stessa regola serve le
 * clienti di oggi, quelle che passeranno a digiuno domani, e quelle a cui lo staff cambia il
 * percorso fra sei mesi — che sono le tre porte del §14, con una regola sola.
 */
export function atterraggioOrologio(profilo: ProfiloPerOrologio): Atterraggio {
  if (profilo.pathType !== 'intermittent_fasting') {
    return { daChiedere: false, motivo: 'non_digiuna', finestraNonTraducibile: false };
  }
  if (profilo.fastingSceltoIl) {
    // Ha già risposto: la pagina non ricompare. ⚠️ Un avviso che compare sempre non è un avviso.
    return { daChiedere: false, motivo: 'ha_gia_scelto', finestraNonTraducibile: false };
  }
  const riga = profilo.fastingWindow ? PROPOSTE_DA_FINESTRA_STORICA[profilo.fastingWindow] : undefined;
  return {
    daChiedere: true,
    motivo: 'mai_chiesta',
    proposta: riga ? { protocollo: riga.protocollo, inizioMin: riga.inizioMin } : undefined,
    // ⚠️ Vero solo se una finestra ce l'aveva: chi non ne ha mai avuta una non ha niente da
    // segnalare, è semplicemente una a cui la domanda non è mai stata fatta.
    finestraNonTraducibile: Boolean(profilo.fastingWindow) && !riga,
  };
}

/**
 * Il motivo, scritto per una persona, da mettere nell'evento per la nutrizionista (§15).
 *
 * ⛔ **PRENDE IL VALORE DELLA FINESTRA, NON UNA FRASE GIÀ PRONTA** (corretto in revisione, 21/8).
 *
 * Prima la firma era `(finestraPrecedente: string, …)` e si fidava che il chiamante passasse già
 * l'etichetta. Ma l'unico dato che il chiamante ha in mano è `profilo.fastingWindow`, cioè
 * `'skip_dinner'` — e alla nutrizionista sarebbe arrivato *«La finestra che aveva — skip_dinner —
 * …»*, esattamente quello che il commento vietava. La traduzione la fa questa funzione, che ha la
 * tabella a un import di distanza: la regola smette di dipendere dalla disciplina del prossimo.
 *
 * ⚠️ E non dice più «che **aveva**»: al momento della segnalazione quella finestra può essere di
 * sei mesi fa o di cinque minuti fa (l'ha scritta la coach dalla scheda). La frase dice la cosa che
 * è vera in tutti e due i casi — *questi pasti e l'orologio non stanno insieme*.
 */
export function motivoPerLaNutrizionista(
  finestraPrecedente: string,
  sceltaNuova: string,
): string {
  const riga = finestraDigiuno(finestraPrecedente);
  // ⚠️ Un valore che la tabella non conosce si dice, e si dice CHE è un codice. Nasconderlo
  // lascerebbe chi legge senza niente da cercare; buttarglielo in faccia senza dire cos'è, peggio.
  const come = riga
    ? `«${riga.etichettaStaff}»`
    : `una finestra che la tabella non riconosce (codice interno: ${finestraPrecedente})`;
  return (
    `La finestra ${come} non è riproducibile con l'orologio: nessuna posizione dei cinque ` +
    `protocolli dà quei pasti. La pagina le si è aperta vuota e ha scelto «${sceltaNuova}». ` +
    `⚠️ Qualunque cosa scegliesse, i pasti o il catalogo cambiano rispetto a prima: vale la pena ` +
    `guardarla.`
  );
}

/**
 * Verifica che ogni proposta produca davvero la finestra a cui è appesa. Usata dal test, ma
 * esportata apposta: se un giorno qualcuno cambia le soglie da `config_param`, questa funzione dà
 * la risposta senza dover leggere due tabelle e confrontarle a occhio.
 */
export function proposteIncoerenti(soglie?: SogliaPasti[], margini?: MarginiPasti): string[] {
  const rotte: string[] = [];
  for (const [finestra, riga] of Object.entries(PROPOSTE_DA_FINESTRA_STORICA)) {
    const esito = derivaDaOrologio(riga.inizioMin, riga.protocollo, soglie, margini);
    if (esito?.fastingWindow !== finestra) {
      rotte.push(`${finestra}: la proposta ${riga.protocollo}@${riga.inizioMin} dà ${esito?.fastingWindow ?? 'niente'}`);
    }
  }
  return rotte;
}
