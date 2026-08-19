import { abbina, paroleChe } from './abbinamento-alimenti';
import { type EsitoScelta, fraseAmbiguita, scegliPerStato } from './stato-alimento';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * LEGGERE I VALORI NUTRIZIONALI — e decidere **come** si dicono.
 *
 * Questo servizio è la ragione per cui Gaia può tornare a parlare di numeri dopo l'errore del
 * basmati (11/8). La differenza rispetto a prima non è che i dati adesso sono giusti: è che i numeri
 * **escono da qui** invece che dalla memoria del modello, e che accanto a ogni numero c'è quanto è
 * solido.
 *
 * ## La parte che conta: `comeSiDice`
 *
 * La ricerca sulle fonti ha trovato che l'indice glicemico delle patate va da 73 a 111 e quello
 * dell'anguria da 50 a 76 a seconda della tabella. Dire «l'anguria ha IG 72» è **falsa precisione**:
 * il numero esiste, ma la certezza che comunica non c'è. Quindi:
 *  - affidabilità `solida` → si dice il numero;
 *  - `media` con un range stretto → il numero;
 *  - `media` con un range largo, o `debole` → si dice il **range** («fra 50 e 76, dipende dalla
 *    varietà»), che è la verità;
 *  - niente valore → non si dice niente, e la domanda va alla nutrizionista.
 *
 * Un'app che dice «fra 50 e 76» sembra meno sicura di una che dice «72». È esattamente il punto: la
 * seconda si sta inventando una precisione, ed è quello che ha fatto Gaia col basmati.
 *
 * ## Gli alimenti che non ci sono
 *
 * Non si stima e non si prende il valore di un alimento «simile». Il termine finisce in
 * `nutrient_lookup_miss` col conteggio delle volte che è stato chiesto: è così che la tabella cresce
 * guidata dalle domande vere («tempeh chiesto 40 volte» è la prossima riga da scrivere) invece che da
 * un elenco deciso a tavolino.
 */

/** Come normalizzare un nome perché «Riso Basmati», «riso basmati» e «basmati " sporco» combacino. */
export const normalizzaNome = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ValoreNutrizionale {
  id: string;
  name: string;
  synonyms: string[];
  category: string | null;
  state: string | null;
  glycemicIndex: number | null;
  glycemicIndexMin: number | null;
  glycemicIndexMax: number | null;
  glycemicIndexSource: string | null;
  glycemicIndexReliability: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  sugars: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  sourceRef: string | null;
  note: string | null;
  verifiedAt: Date | null;
}

/** Il modo in cui un dato si può dire a una cliente: testo pronto + i numeri ammessi. */
export interface DaDire {
  /** La frase, già tarata sull'affidabilità. */
  testo: string;
  /** I numeri che compaiono nel testo: la guardia in uscita non ne accetta altri. */
  numeri: number[];
  /** Da dove viene, per poterlo citare. */
  fonte: string | null;
}

/** Oltre questa larghezza il range non si riassume in un numero: si dice il range. */
const RANGE_LARGO = 8;

@Injectable()
export class ValoriNutrizionaliService {
  private readonly logger = new Logger(ValoriNutrizionaliService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cerca un alimento per nome o sinonimo. Prima l'uguaglianza esatta, poi il nome contenuto nel
   * testo: `contains` è la ragione per cui «vorrei sapere del riso basmati» trova «riso basmati».
   *
   * Non fa ricerca approssimata di proposito. Un errore di battitura che porta all'alimento sbagliato
   * è peggio di un «non lo so»: qui si parla di quello che una persona mangia.
   */
  async cerca(termine: string): Promise<ValoreNutrizionale | null> {
    const t = normalizzaNome(termine);
    if (t.length < 3) return null;

    const tutti = (await this.prisma.nutrientFact.findMany()) as unknown as ValoreNutrizionale[];
    const conNomi = tutti.map((v) => ({
      v,
      nomi: [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).filter(Boolean),
    }));

    /**
     * ⚠️ CRUDO O COTTO — voce 228. Prima qui c'era `find`, cioè «la prima riga che combacia», e con
     * due righe «riso bianco» (una crudo e una bollita) quale rispondeva lo decideva l'ordine di
     * lettura del database. Dalla tabella del 18/8: il farro va da 353 kcal a 127, un rapporto di
     * 0,36× — rispondere con quella sbagliata non è un'imprecisione, è un altro pasto.
     *
     * Ora, se gli stati sono diversi e la domanda non dice quale, `cerca` torna `null`: chi vuole
     * l'ambiguità la chiede a `cercaConStato`. ⚠️ `null` è la risposta giusta, perché tutti i
     * chiamanti di `cerca` sanno già trattare «non lo so» — e nessuno di loro sa trattare un numero
     * sbagliato.
     */
    const esatti = conNomi.filter((c) => c.nomi.includes(t));
    if (esatti.length) {
      const scelta = scegliPerStato(esatti.map((c) => c.v), termine);
      return scelta.tipo === 'unica' || scelta.tipo === 'per_stato' ? scelta.riga : null;
    }

    /**
     * Il nome DENTRO il testo. Si prende il più lungo che combacia, e non è un'ottimizzazione: «riso
     * integrale» contiene «riso», e col primo che passa una domanda sull'integrale risponderebbe col
     * riso bianco — che è lo stesso genere di scambio da cui è nata tutta questa storia.
     */
    const dentro = conNomi
      .flatMap((c) => c.nomi.filter((n) => t.includes(n)).map((n) => ({ v: c.v, lunghezza: n.length })))
      .sort((a, b) => b.lunghezza - a.lunghezza);
    return dentro[0]?.v ?? null;
  }

  /**
   * L'ALIMENTO DI UN INGREDIENTE DI RICETTA — dove il testo è un **nome**, non una domanda.
   *
   * ⚠️ È separato da `cerca` di proposito, e la differenza non è cosmetica. `cerca` riceve anche
   * **frasi intere** («vorrei sapere del riso basmati»), e su una frase la regola «la ricetta è più
   * specifica della tabella» diventa pericolosa: una frase lunga contiene le parole di mezza
   * tabella, e si abbinerebbe a caso. Qui l'ingresso è «spinaci freschi», e lì quella regola è
   * esattamente quello che serve.
   *
   * Le regole stanno in `abbinamento-alimenti.ts`, con scritto perché la terza che sembrava ovvia
   * non esiste. ⚠️ Dopo l'abbinamento si applica lo **stato**: la riga trovata può essere in più
   * stati, e la convenzione delle ricette è «a crudo».
   */
  async cercaPerIngrediente(nome: string): Promise<ValoreNutrizionale | null> {
    const t = normalizzaNome(nome);
    if (t.length < 3) return null;
    const tutti = (await this.prisma.nutrientFact.findMany()) as unknown as ValoreNutrizionale[];
    // ⚠️ Prima l'uguaglianza esatta, che non ha bisogno di nessuna regola.
    const esatti = tutti.filter((v) => [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).includes(t));
    if (esatti.length) return esatti[0];
    const trovato = abbina(nome, tutti, (v) => [v.name, ...(v.synonyms ?? [])]);
    return trovato?.riga ?? null;
  }

  /**
   * Come `cerca`, ma dice anche **quando non si può rispondere**: più righe con stati diversi e la
   * domanda che non specifica quale. Serve a `schedaPerRisposta`, che deve poter istruire Gaia a
   * chiedere invece di dare un numero.
   */
  async cercaConStato(termine: string): Promise<EsitoScelta<ValoreNutrizionale>> {
    const t = normalizzaNome(termine);
    if (t.length < 3) return { tipo: 'niente' };
    const tutti = (await this.prisma.nutrientFact.findMany()) as unknown as ValoreNutrizionale[];
    const esatti = tutti.filter((v) => [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).includes(t));
    return scegliPerStato(esatti, termine);
  }

  /** Cerca più alimenti in un testo: serve ai confronti («meglio il basmati o l'integrale?»). */
  async cercaTutti(testo: string, massimo = 3): Promise<ValoreNutrizionale[]> {
    const t = normalizzaNome(testo);
    if (t.length < 3) return [];
    const tutti = (await this.prisma.nutrientFact.findMany()) as unknown as ValoreNutrizionale[];

    /**
     * ⚠️ LE PAROLINE NON CONTANO, NEMMENO QUI (19/8). In tabella c'è «olio extravergine **di**
     * oliva» e le clienti scrivono «olio extravergine d'oliva»: la stessa cosa, e la ricerca per
     * sottostringa non la trovava — Gaia rispondeva «non ce l'ho» su un alimento che ha.
     *
     * ⚠️ Si toglie la stessa cosa da tutt'e due i lati e si cerca come prima: **non è una ricerca
     * più larga**, è la stessa ricerca su una scrittura normalizzata. Non può abbinare niente che
     * non fosse già a un «di» di distanza.
     */
    const senzaParoline = (x: string) => paroleChe(x).join(' ');
    const tp = senzaParoline(t);

    const trovati: { v: ValoreNutrizionale; lunghezza: number; posizione: number }[] = [];
    for (const v of tutti) {
      const nomi = [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).filter(Boolean);
      let migliore: { lunghezza: number; posizione: number } | null = null;
      for (const n of nomi) {
        const np = senzaParoline(n);
        if (!np) continue;
        const pos = tp.indexOf(np);
        if (pos < 0) continue;
        if (!migliore || np.length > migliore.lunghezza) migliore = { lunghezza: np.length, posizione: pos };
      }
      if (migliore) trovati.push({ v, ...migliore });
    }

    /**
     * Si scartano i nomi CONTENUTI in un altro nome trovato: se il testo dice «riso integrale», il
     * «riso» che ci sta dentro non è un secondo alimento, e trattarlo come tale produrrebbe il
     * confronto «riso integrale contro riso bianco» a una cliente che non l'ha chiesto.
     */
    const perLunghezza = [...trovati].sort((a, b) => b.lunghezza - a.lunghezza);
    const tenuti: typeof trovati = [];
    for (const c of perLunghezza) {
      const dentroUnAltro = tenuti.some(
        (t2) => t2.posizione <= c.posizione && t2.posizione + t2.lunghezza >= c.posizione + c.lunghezza,
      );
      if (!dentroUnAltro) tenuti.push(c);
    }
    // Nell'ordine in cui la cliente li ha scritti: «meglio A o B» va risposto parlando di A e poi B.
    return tenuti.sort((a, b) => a.posizione - b.posizione).slice(0, massimo).map((c) => c.v);
  }

  /**
   * Come si dice l'indice glicemico di questo alimento: numero, range, o niente.
   * È qui che vive la regola contro la falsa precisione — vedi il commento in testa.
   */
  indiceGlicemicoDaDire(v: ValoreNutrizionale): DaDire | null {
    const { glycemicIndex: gi, glycemicIndexMin: min, glycemicIndexMax: max } = v;

    /**
     * ⚠️ «NON SI APPLICA» NON È «NON LO SO» (18/8).
     *
     * Prima questa funzione tornava `null` sia per un alimento di cui non avevamo l'indice, sia per
     * uno che un indice **non ce l'ha**: l'olio, il parmigiano, il petto di pollo. E `null` vuol
     * dire «non passare niente al modello», cioè: a «qual è l'indice glicemico del salmone?» Gaia
     * rispondeva **tacendo** sull'unica cosa che le era stata chiesta. Vero, e indistinguibile da
     * una reticenza.
     *
     * Il capo nutrizionista ha marcato quelle righe `non_applicabile` nella sua tabella del 18/8, e
     * adesso la risposta è quella giusta. ⚠️ `numeri: []` è voluto: non c'è nessun numero da
     * autorizzare, e la guardia in uscita continua a rifiutare qualunque cifra il modello inventi.
     */
    if (v.glycemicIndexReliability === 'non_applicabile') {
      return {
        testo:
          `l'indice glicemico del/della ${v.name} non si applica: è un alimento senza carboidrati ` +
          'o con quantità trascurabili, e l\'indice glicemico misura la risposta ai carboidrati',
        numeri: [],
        fonte: v.glycemicIndexSource,
      };
    }

    if (gi === null && min === null) return null;

    const affidabilita = v.glycemicIndexReliability ?? 'debole';
    const larghezza = min !== null && max !== null ? max - min : 0;
    const usaRange = min !== null && max !== null && (affidabilita === 'debole' || larghezza > RANGE_LARGO);

    if (usaRange) {
      return {
        testo: `l'indice glicemico del/della ${v.name} sta fra ${min} e ${max}`,
        numeri: [min as number, max as number],
        fonte: v.glycemicIndexSource,
      };
    }
    if (gi === null) return null;
    return {
      testo: `l'indice glicemico del/della ${v.name} è circa ${gi}`,
      numeri: [gi],
      fonte: v.glycemicIndexSource,
    };
  }

  /** Le calorie e i macro per 100 g, se ci sono. Lo stato (crudo/cotto) fa parte della risposta. */
  valoriDaDire(v: ValoreNutrizionale): DaDire | null {
    if (v.kcal === null) return null;
    const pezzi: string[] = [`${v.kcal} kcal`];
    const numeri: number[] = [100, v.kcal];
    if (v.protein !== null) { pezzi.push(`${v.protein} g di proteine`); numeri.push(v.protein); }
    if (v.carbs !== null) { pezzi.push(`${v.carbs} g di carboidrati`); numeri.push(v.carbs); }
    if (v.fat !== null) { pezzi.push(`${v.fat} g di grassi`); numeri.push(v.fat); }
    if (v.fiber !== null) { pezzi.push(`${v.fiber} g di fibre`); numeri.push(v.fiber); }
    const stato = v.state ? ` (${v.state})` : '';
    return {
      testo: `100 g di ${v.name}${stato}: ${pezzi.join(', ')}`,
      numeri,
      fonte: v.source,
    };
  }

  /**
   * Il pacchetto di dati da mettere davanti al modello, con l'elenco dei numeri ammessi.
   *
   * Il modello riceve queste righe e può SOLO usare questi numeri: la guardia in uscita
   * (`chat/guardia-risposta-ai.ts`) rifiuta la risposta se ne contiene altri. È così che «può
   * affermarlo ma deve prima verificare» diventa una cosa verificabile e non una raccomandazione.
   */
  async schedaPerRisposta(testo: string): Promise<{
    trovati: ValoreNutrizionale[];
    righe: string[];
    numeriAmmessi: number[];
    fonti: string[];
    /** I termini che sembravano alimenti e non sono in tabella: già registrati fra i mancanti. */
    mancanti: string[];
    /** ⚠️ Alimenti presenti in più stati (crudo/cotto): per questi NON si dice nessun numero. */
    ambigui: string[];
  }> {
    const trovati = await this.cercaTutti(testo);
    const righe: string[] = [];
    const numeriAmmessi: number[] = [];
    const fonti = new Set<string>();

    /**
     * ⚠️ GLI ALIMENTI CON PIÙ STATI, PRIMA DI TUTTO IL RESTO (voce 228). Se lo stesso nome esiste
     * crudo e bollito e la domanda non dice quale, non si mette **nessun numero** fra i dati: si
     * mette l'istruzione di chiedere. Un numero plausibile e sbagliato non lo ferma nessuno, perché
     * non ha l'aspetto di un errore.
     */
    const ambigui: string[] = [];
    for (const v of trovati) {
      const scelta = await this.cercaConStato(v.name).catch(() => ({ tipo: 'niente' as const }));
      if (scelta.tipo === 'ambiguo') ambigui.push(v.name);
    }

    for (const v of trovati) {
      if (ambigui.includes(v.name)) {
        const scelta = await this.cercaConStato(v.name).catch(() => ({ tipo: 'niente' as const }));
        if (scelta.tipo === 'ambiguo') righe.push(fraseAmbiguita(v.name, scelta.stati));
        // ⚠️ E nessun numero di questo alimento entra fra quelli ammessi: la guardia in uscita
        // deve fermare anche un numero che, per caso, coincide con quello di uno dei due stati.
        continue;
      }
      const ig = this.indiceGlicemicoDaDire(v);
      const val = this.valoriDaDire(v);
      if (ig) {
        righe.push(`${ig.testo}${ig.fonte ? ` [${ig.fonte}]` : ''}`);
        numeriAmmessi.push(...ig.numeri);
        if (ig.fonte) fonti.add(ig.fonte);
      }
      if (val) {
        righe.push(`${val.testo}${val.fonte ? ` [${val.fonte}]` : ''}`);
        numeriAmmessi.push(...val.numeri);
        if (val.fonte) fonti.add(val.fonte);
      }
      if (v.note) righe.push(`nota su ${v.name}: ${v.note}`);
      if (!ig && !val) righe.push(`di ${v.name} non abbiamo né indice glicemico né valori: non dire numeri.`);
    }

    return { trovati, righe, numeriAmmessi, fonti: [...fonti], mancanti: [], ambigui };
  }

  /**
   * Registra un alimento chiesto e non trovato. Non fallisce mai: chi chiama sta rispondendo a una
   * cliente, e la contabilità dei buchi non deve intralciare la conversazione.
   */
  async registraMancante(termine: string): Promise<void> {
    const t = normalizzaNome(termine);
    if (t.length < 3 || t.length > 60) return;
    try {
      const esistente = (await this.prisma.nutrientLookupMiss.findUnique({
        where: { term: t },
        select: { id: true, times: true },
      })) as { id: string; times: number } | null;
      if (esistente) {
        await this.prisma.nutrientLookupMiss.update({
          where: { id: esistente.id },
          data: { times: esistente.times + 1, lastAskedAt: new Date() } as never,
        });
        return;
      }
      await this.prisma.nutrientLookupMiss.create({ data: { term: t } as never });
    } catch (e) {
      this.logger.warn(`Non ho potuto registrare l'alimento mancante «${t}»: ${e instanceof Error ? e.message : e}`);
    }
  }
}
