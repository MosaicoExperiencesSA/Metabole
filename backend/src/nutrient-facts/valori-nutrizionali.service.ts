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

    const esatto = conNomi.find((c) => c.nomi.includes(t));
    if (esatto) return esatto.v;

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

  /** Cerca più alimenti in un testo: serve ai confronti («meglio il basmati o l'integrale?»). */
  async cercaTutti(testo: string, massimo = 3): Promise<ValoreNutrizionale[]> {
    const t = normalizzaNome(testo);
    if (t.length < 3) return [];
    const tutti = (await this.prisma.nutrientFact.findMany()) as unknown as ValoreNutrizionale[];

    const trovati: { v: ValoreNutrizionale; lunghezza: number; posizione: number }[] = [];
    for (const v of tutti) {
      const nomi = [v.name, ...(v.synonyms ?? [])].map(normalizzaNome).filter(Boolean);
      let migliore: { lunghezza: number; posizione: number } | null = null;
      for (const n of nomi) {
        const pos = t.indexOf(n);
        if (pos < 0) continue;
        if (!migliore || n.length > migliore.lunghezza) migliore = { lunghezza: n.length, posizione: pos };
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
  }> {
    const trovati = await this.cercaTutti(testo);
    const righe: string[] = [];
    const numeriAmmessi: number[] = [];
    const fonti = new Set<string>();

    for (const v of trovati) {
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

    return { trovati, righe, numeriAmmessi, fonti: [...fonti], mancanti: [] };
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
