/**
 * IL DIZIONARIO CHE INVECCHIA — l'ultimo guasto silenzioso rimasto.
 *
 * «Formaggi molli» sono nove nomi, spuntati un martedì. Entra in catalogo la burrata: la lista non
 * la contiene, e la regola della nutrizionista continua a esistere, a girare e a **non toglierla**.
 * Nessun errore, nessuna riga rossa, nessuno che se ne accorga — la regola semplicemente copre meno
 * di quello che lei crede, e la differenza si vede solo nel piatto di qualcuno.
 *
 * `dizionario.famiglieCheForsePrendono()` sapeva già rispondere alla domanda «questo alimento nuovo
 * riguarda qualche famiglia?», ma **non la chiamava nessuno**: mancava chi le portasse gli alimenti
 * nuovi. Questo file è quel pezzo, girato dalla parte giusta — non «chi si accorge che è nata la
 * burrata», ma «cosa è entrato in catalogo da quando mi hai insegnato questa parola».
 *
 * ## ⚠️ Perché la domanda la fa l'assistente e non una schermata del catalogo
 *
 * Chi pubblica una ricetta non è chi ha insegnato la parola, e non sa cosa vuol dire «molle» per
 * Lucia. Chiederglielo lì vorrebbe dire far decidere a una persona il vocabolario di un'altra —
 * oppure, più probabilmente, far premere «avanti». Chiederlo a lei, nella sua chat, quando non c'è
 * niente di più urgente, è l'unico momento in cui la risposta vale qualcosa.
 *
 * ## ⚠️ Funzione pura, e il confronto è quello del motore
 *
 * `combaciaAlimento` (parola intera, con la radice) e mai la sottostringa: «pepe» prenderebbe
 * «peperoni». Se il filtro qui divergesse da quello che usa il motore per escludere, la famiglia
 * imparerebbe nomi che poi non tolgono niente.
 */
import { chiaveAlimento, combaciaAlimento, paroleAlimento, radice } from '../common/nomi-alimento';

/**
 * ⚠️ LA PAROLA-TESTA di un nome di alimento: la prima che porta significato.
 *
 * In italiano il nome viene prima e la qualifica dopo — «yogurt greco», «formaggio spalmabile»,
 * «pane integrale» — quindi la testa è quella che dice *che cosa è*. Confrontare le teste, e non
 * una parola qualsiasi in comune, è ciò che separa «yogurt magro» da «sugo greco»: condividere
 * l'aggettivo non vuol dire essere lo stesso cibo, e una famiglia che si allarga per un aggettivo
 * comincia a togliere piatti che nessuno voleva togliere.
 *
 * La radice si applica **due volte** per la stessa ragione per cui esiste `chiaveLarga` nel
 * dizionario: `radice` toglie una sola vocale, quindi «formaggio» dà `formaggi` e «formaggi» dà
 * `formagg` — due forme della stessa parola che non combacerebbero mai.
 */
function testa(nome: string): string | null {
  const parole = paroleAlimento(nome);
  return parole.length ? radice(radice(parole[0])) : null;
}

export interface FamigliaDaControllare {
  id: string;
  nome: string;
  membri: string[];
  /** Quando è stata insegnata o corretta l'ultima volta: la linea che separa «vecchio» da «nuovo». */
  aggiornataIl: Date;
}

export interface RicettaInCatalogo {
  id: string;
  createdAt: Date;
  /** I nomi degli ingredienti, già estratti dal JSON. */
  ingredienti: string[];
}

export interface FamigliaInvecchiata {
  famigliaId: string;
  nome: string;
  membri: string[];
  /** Gli alimenti entrati dopo, che sembrano appartenerle. */
  candidati: string[];
}

/**
 * ⚠️ Quanti se ne propongono per volta. Oltre, non è più una domanda: è un modulo da compilare, e a
 * un modulo si risponde «va bene tutto» senza leggerlo — che è il modo di far entrare nel dizionario
 * proprio le cose che non c'entrano.
 */
export const MAX_CANDIDATI = 8;

export function cercaNuoviMembri(
  famiglie: FamigliaDaControllare[],
  ricette: RicettaInCatalogo[],
  maxCandidati = MAX_CANDIDATI,
): FamigliaInvecchiata[] {
  const fuori: FamigliaInvecchiata[] = [];

  for (const f of famiglie) {
    if (!f.membri.length) continue;
    const teste = new Set(f.membri.map(testa).filter((t): t is string => !!t));
    if (!teste.size) continue;
    const visti = new Map<string, string>();

    for (const r of ricette) {
      // ⚠️ Solo quello che è entrato DOPO. Sulle ricette che c'erano già la nutrizionista ha
      // deciso: riproporgliele vorrebbe dire chiederle di nuovo una cosa a cui ha già risposto, che
      // è il modo più rapido per insegnarle a chiudere questa domanda senza leggerla.
      if (r.createdAt.getTime() <= f.aggiornataIl.getTime()) continue;

      for (const grezzo of r.ingredienti) {
        const nome = (grezzo ?? '').trim();
        if (!nome) continue;
        const chiave = chiaveAlimento(nome);
        if (!chiave || visti.has(chiave)) continue;
        // Già dentro, o è quello stesso cibo detto più preciso («mozzarella di bufala» quando la
        // famiglia ha «mozzarella»): niente da chiedere.
        if (f.membri.some((m) => combaciaAlimento(nome, m))) continue;
        // È lo stesso CIBO di un membro, in un'altra versione: «yogurt magro» accanto a «yogurt
        // greco». ⚠️ Il caso che questa euristica non prende — «burrata» accanto a «mozzarella» —
        // va bene così: proporre troppo poco costa una domanda mancata, proporre troppo insegna a
        // rispondere di no senza leggere.
        const t = testa(nome);
        if (!t || !teste.has(t)) continue;
        visti.set(chiave, nome);
        if (visti.size >= maxCandidati) break;
      }
      if (visti.size >= maxCandidati) break;
    }

    if (visti.size) {
      fuori.push({ famigliaId: f.id, nome: f.nome, membri: f.membri, candidati: [...visti.values()] });
    }
  }

  // ⚠️ Prima la famiglia con più roba nuova: è quella la cui regola sta coprendo meno di quanto
  // sembra. E se ne chiede UNA per volta — vedi chi chiama.
  return fuori.sort((a, b) => b.candidati.length - a.candidati.length);
}

/** I nomi degli ingredienti dal JSON di una ricetta, senza fidarsi della forma. */
export function nomiIngredienti(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((i) => (typeof i === 'string' ? i : ((i ?? {}) as { name?: unknown }).name))
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map((n) => n.trim());
}
