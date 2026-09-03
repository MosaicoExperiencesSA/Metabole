/**
 * ⛔ **LE FAMIGLIE DI DIETE — il raggruppamento, e il numero che dice se una cliente resta senza.**
 *
 * Sta in `lib/` e non dentro la pagina perché è **la parte che si può sbagliare in silenzio**: se
 * `coperte` conta male, la tabella dice «tutto a posto» mentre una cliente apre il «?» e trova il
 * vuoto. Una funzione pura si prova; un `useMemo` dentro una pagina no.
 *
 * ⚠️ **Questo file è nato con un byte NUL dentro**, finito in mezzo a un template literal mentre lo
 * estraevo dalla pagina. TypeScript compilava, il build passava e i test erano verdi — un NUL dentro
 * una stringa è un carattere valido, e la chiave restava unica lo stesso. L'ha scoperto una
 * **mutazione sopravvissuta**: il `replace` non trovava la riga da mutare, ed è stato quello a far
 * guardare il file. ⛔ Un file con un NUL diventa «binario» per `grep` e per git: i test che leggono
 * i sorgenti — e in questo progetto ce ne sono parecchi — lo salterebbero **in silenzio**.
 */

export interface DietRow {
  id: string;
  name: string;
  style: string;
  regime: string;
  objective?: string | null;
  mealsPerDay: number;
  fasting?: boolean;
  status: string;
  clientName?: string | null;
  clientDescription?: string | null;
  highlights?: unknown;
  seasonalTag?: string | null;
  clientVisible?: boolean;
}

/** Una famiglia: la coppia (nome, stile), che è la stessa chiave con cui la registrazione raggruppa. */
export interface Famiglia {
  chiave: string;
  nome: string;
  stile: string;
  varianti: DietRow[];
  /** Quante varianti hanno una descrizione non vuota. */
  coperte: number;
  /** Il testo da mostrare: quello della prima variante compilata. */
  descrizione: string | null;
  clientName: string | null;
  /** ⚠️ Quante varianti sono accese alle clienti E approvate: una bozza spuntata non la vede nessuna. */
  accese: number;
  /** ⚠️ Quante sono state escluse dal conteggio perché archiviate. Si dice, non si nasconde. */
  archiviate: number;
  /** ⚠️ Le varianti compilate NON dicono tutte la stessa cosa: va detto, o si sovrascrive alla cieca. */
  testiDiversi: boolean;
  /**
   * ⛔ **La famiglia sta chiudendo** (`FAMIGLIE_CHE_SPARISCONO` nel backend): le sue clienti si
   * spostano altrove e i suoi testi non li leggerà più nessuno. Scriverli è tempo buttato — e
   * peggio, il numero «famiglie incomplete» resterebbe rosso per sempre su righe che stanno per
   * sparire.
   */
  inChiusura: boolean;
}

/**
 * ⛔ **LE FAMIGLIE CHE STANNO CHIUDENDO, e perché l'elenco sta QUI e non nel backend.**
 *
 * La lista canonica è una sola — `FAMIGLIE_CHE_SPARISCONO` in `catalog/appartenenza-panieri.ts` — e
 * arriva al backoffice da `GET /catalog/taxonomy`, dove ogni famiglia porta `inChiusura`. Questo
 * elenco è il **ripiego** per quando quella chiamata non c'è o non risponde: senza, la pagina
 * mostrerebbe le nove vecchie famiglie come se fossero da compilare.
 *
 * ⚠️ **Due elenchi divergono**, e va detto invece di far finta di niente: se in futuro una famiglia
 * si chiude e questo non lo sa, comparirà di nuovo in elenco — un errore per eccesso, che si vede.
 * L'errore opposto (nascondere una famiglia viva) non è possibile: queste nove sono già chiuse.
 */
export const FAMIGLIE_IN_CHIUSURA_NOTE: readonly string[] = [
  'Flexitariana', 'Pescetariana', 'Vegana', 'Vegetariana (latto-ovo)',
  'Digiuno intermittente (16:8)', 'Mediterranea ipocalorica', 'Mediterranea senza glutine',
  'Ritorno in Equilibrio', 'Vacanze in Serenità',
];

/** ⚠️ Una stringa di soli spazi non è un testo: alla cliente non dice niente, e non va contata. */
const vuota = (t?: string | null): boolean => !t || !t.trim();

/**
 * ⛔ **Il raggruppamento è `nome + stile`, con lo STESSO separatore della registrazione.**
 *
 * `onboarding.service.ts` e `catalog.service.publicPaths` compongono la stessa chiave con `\u0000`
 * in mezzo. La prima stesura di questo file usava ` · `, e il docstring diceva lo stesso «la stessa
 * chiave della registrazione»: non era vero, ed è il tipo di differenza che non si vede mai — finché
 * una dieta si chiama «Mediterranea · estate» e si fonde con un'altra famiglia. Allora la tabella
 * mostrerebbe una riga sola, il salvataggio scriverebbe su **una** delle due, e la pagina
 * annuncerebbe «Scritto su N varianti». Cioè esattamente il difetto che questa pagina esiste per
 * prevenire.
 *
 * ⚠️ Un carattere che in un nome di dieta non può esserci: è per questo che si sceglie quello, e non
 * un separatore leggibile. ⛔ Ma si scrive **con l'escape**, mai col byte alla lettera — un sorgente
 * con un NUL dentro diventa «binario» per grep e sparisce dai test che leggono i sorgenti. Vedi la
 * nota in testa a questo file, e `sorgenti-leggibili.spec.ts`.
 */
export function raggruppaFamiglie(righe: DietRow[], inChiusura?: ReadonlySet<string>): Famiglia[] {
  const chiuse = inChiusura ?? new Set(FAMIGLIE_IN_CHIUSURA_NOTE);
  const per = new Map<string, DietRow[]>();
  for (const r of righe) {
    const chiave = `${r.name}\u0000${r.style}`;
    const gia = per.get(chiave);
    if (gia) gia.push(r);
    else per.set(chiave, [r]);
  }

  const out: Famiglia[] = [];
  for (const [chiave, varianti] of per) {
    /**
     * ⛔ **LE ARCHIVIATE NON SI CONTANO** (revisione, 22/8). `archiveDiet` non ha uno stato suo:
     * archivia mettendo `status: 'rejected'`, e quelle righe restano in `GET /diets`.
     *
     * ⚠️ Contandole, una famiglia con sei varianti archiviate resterebbe **12/18 in rosso per
     * sempre**: «Famiglie incomplete» non tornerebbe mai a zero, il filtro «solo quelle incomplete»
     * non si svuoterebbe mai, e per le clienti la copertura sarebbe completa. *Un avviso che compare
     * sempre non è un avviso* — e l'unico modo di spegnerlo sarebbe scrivere su righe morte.
     *
     * ⚠️ Quante ne sono state escluse si dice (`archiviate`): *niente tagli silenziosi*.
     */
    const vive = varianti.filter((v) => v.status !== 'rejected');
    const compilate = vive.filter((v) => !vuota(v.clientDescription));
    const testi = new Set(compilate.map((v) => (v.clientDescription ?? '').trim()));
    out.push({
      chiave,
      nome: varianti[0].name,
      stile: varianti[0].style,
      varianti: vive,
      inChiusura: chiuse.has(varianti[0].name),
      archiviate: varianti.length - vive.length,
      coperte: compilate.length,
      descrizione: compilate[0]?.clientDescription ?? null,
      clientName: vive.find((v) => !vuota(v.clientName))?.clientName ?? null,
      // ⚠️ «Accesa» vuol dire visibile E approvata: una bozza con la spunta non la vede nessuna.
      accese: vive.filter((v) => v.clientVisible && v.status === 'approved').length,
      testiDiversi: testi.size > 1,
    });
  }

  /**
   * ⚠️ **Prima le famiglie con dei buchi.** La pagina esiste per quelle: ordinarle per nome le
   * seppellirebbe in mezzo a quelle a posto, ed è il modo in cui uno strumento nato per far vedere
   * una cosa finisce per nasconderla.
   */
  // ⚠️ Una famiglia interamente archiviata non è una riga da compilare: sparisce, non va in rosso.
  return out.filter((f) => f.varianti.length > 0).sort((a, b) => {
    const bucoA = a.varianti.length - a.coperte;
    const bucoB = b.varianti.length - b.coperte;
    if (bucoA !== bucoB) return bucoB - bucoA;
    return a.nome.localeCompare(b.nome);
  });
}

/**
 * ⛔ **I NUMERI IN CIMA ALLA PAGINA, e stanno qui per la ragione scritta in testa a questo file:
 * sono la parte che si può sbagliare in silenzio.**
 *
 * Se `scoperte` conta anche le famiglie che stanno chiudendo, «famiglie incomplete» non torna
 * **mai** a zero, il filtro «solo quelle incomplete» non si svuota mai, e l'unico modo di spegnere
 * l'avviso sarebbe scrivere testi su famiglie che nessuna cliente leggerà. ⚠️ *Un avviso che
 * compare sempre non è un avviso* — è la stessa ragione per cui le varianti archiviate non si
 * contano.
 */
export interface ContiDescrizioni {
  vive: Famiglia[];
  inChiusura: number;
  varianti: number;
  coperte: number;
  scoperte: number;
}

export function contiDelleFamiglie(famiglie: readonly Famiglia[]): ContiDescrizioni {
  const vive = (famiglie ?? []).filter((f) => !f.inChiusura);
  return {
    vive,
    inChiusura: (famiglie ?? []).length - vive.length,
    varianti: vive.reduce((n, f) => n + f.varianti.length, 0),
    coperte: vive.reduce((n, f) => n + f.coperte, 0),
    scoperte: vive.filter((f) => f.coperte < f.varianti.length).length,
  };
}

