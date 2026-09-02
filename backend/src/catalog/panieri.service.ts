import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GIORNATA_CINQUE, slotCapofila, slotDaCuiPescare } from '../common/slot-pasto';
import { FAMIGLIE, IMPOSSIBILI, REGIMI, combinazioneImpossibile } from './appartenenza-panieri';

/**
 * I PANIERI, VISTI DAL BACK OFFICE — Fase 7 del piano.
 *
 * ⚠️ **Il paniere non è una dieta**, ed è la ragione per cui questa pagina esiste separata: è **da
 * dove arrivano i piatti** di ogni cliente di quella famiglia e di quel regime. Fino a oggi la
 * tabella di appartenenza si poteva leggere solo con un tabulato da shell, e scriverla solo con uno
 * script: chi risponde di cosa mangiano le clienti non aveva modo di guardarci dentro.
 *
 * ⛔ **E chi tocca una riga qui cambia il menu di tutte insieme.** Non è la giornata di una
 * cliente: è il pool da cui il motore pesca per tutte quelle del paniere. Per questo `manage` è del
 * capo nutrizionista e ogni scrittura passa dall'audit.
 */
/**
 * ⚠️ **DUE NUMERI PER PASTO, NON UNO** — è la stessa lezione della copertura del catalogo (11/8).
 *
 * Un piatto generato nasce in **bozza** e diventa attivo solo con la validazione: un paniere con
 * 200 piatti di cui 20 attivi **è un paniere da 20**, perché il motore gli altri non li vede. Con
 * un numero solo la pagina direbbe che va tutto bene proprio sul caso peggiore — quello in cui il
 * lavoro c'è ma non arriva a nessuna cliente.
 */
export interface ConteggioDelPasto {
  /** I piatti distinti che il paniere ha per quel pasto. */
  piatti: number;
  /** Quanti di quelli il motore userebbe davvero (`active: true`). */
  attivi: number;
}

export interface CellaDelPaniere {
  famiglia: string;
  regime: string;
  esiste: boolean;
  impossibile: string | null;
  /** Per ogni pasto: piatti e attivi, coi gemelli già uniti (spuntino e merenda insieme). */
  perSlot: Record<string, ConteggioDelPasto>;
  totale: number;
  totaleAttivi: number;
}

@Injectable()
export class PanieriService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Le 38 celle, con quante ricette per pasto.
   *
   * ⚠️ **Si contano le ricette DISTINTE, non le righe.** La stessa ricetta può stare in un paniere
   * per due pasti diversi (una vellutata a pranzo e a cena), e contare le righe direbbe che il
   * paniere è più ricco di quanto è. Chi guarda questa pagina si chiede «quanti piatti diversi può
   * ricevere», non «quante righe ci sono in tabella».
   *
   * ⚠️ E i due spuntini si contano **uniti** (Fase 2): è quello che vede la cliente.
   */
  async celle(): Promise<CellaDelPaniere[]> {
    const [panieri, righe, attive] = await Promise.all([
      this.prisma.paniere.findMany({ select: { id: true, famiglia: true, regime: true } }) as unknown as
        Promise<{ id: string; famiglia: string; regime: string }[]>,
      this.prisma.paniereRicetta.findMany({ select: { paniereId: true, recipeId: true, slot: true } }) as unknown as
        Promise<{ paniereId: string; recipeId: string; slot: string }[]>,
      /**
       * ⚠️ **Solo gli id delle ATTIVE**, non tutte le ricette: il catalogo è grande e qui serve
       * rispondere a una domanda sola. E si chiede al database di filtrare, non a noi dopo.
       *
       * ⛔ E i «rotti» della copertura per variante qui **non esistono**: `PaniereRicetta` ha una
       * chiave esterna con `onDelete: Cascade`, quindi una ricetta cancellata si porta via le sue
       * righe. È uno dei guadagni della Fase 1 — nelle giornate, che tengono i pasti in un JSON
       * senza vincoli, un riferimento rotto resta lì e nessuno lo vede.
       */
      this.prisma.recipe.findMany({ where: { active: true }, select: { id: true } }) as unknown as
        Promise<{ id: string }[]>,
    ]);
    const eAttiva = new Set(attive.map((r) => r.id));

    const perPaniere = new Map<string, Map<string, Set<string>>>();
    for (const r of righe) {
      const slots = perPaniere.get(r.paniereId) ?? new Map<string, Set<string>>();
      const set = slots.get(r.slot) ?? new Set<string>();
      set.add(r.recipeId);
      slots.set(r.slot, set);
      perPaniere.set(r.paniereId, slots);
    }

    const idDi = new Map(panieri.map((p) => [`${p.famiglia}|${p.regime}`, p.id]));
    const out: CellaDelPaniere[] = [];
    for (const famiglia of FAMIGLIE) {
      for (const regime of REGIMI) {
        const chiave = `${famiglia}|${regime}`;
        const id = idDi.get(chiave);
        const slots = id ? perPaniere.get(id) ?? new Map<string, Set<string>>() : new Map<string, Set<string>>();
        const perSlot: Record<string, ConteggioDelPasto> = {};
        for (const sl of GIORNATA_CINQUE) {
          const uniti = new Set<string>();
          for (const g of slotDaCuiPescare(sl)) for (const rid of slots.get(g) ?? []) uniti.add(rid);
          perSlot[sl] = { piatti: uniti.size, attivi: [...uniti].filter((rid) => eAttiva.has(rid)).length };
        }
        const tutte = new Set<string>();
        for (const s of slots.values()) for (const rid of s) tutte.add(rid);
        out.push({
          famiglia,
          regime,
          esiste: !!id,
          impossibile: IMPOSSIBILI.includes(chiave) ? combinazioneImpossibile(famiglia, regime) : null,
          perSlot,
          totale: tutte.size,
          totaleAttivi: [...tutte].filter((rid) => eAttiva.has(rid)).length,
        });
      }
    }
    return out;
  }

  /** Le ricette di un paniere per un pasto, coi gemelli uniti — quello che vedrebbe una cliente. */
  async ricetteDi(famiglia: string, regime: string, slot: string): Promise<{ id: string; name: string; kcal: number; mealSlot: string; active: boolean }[]> {
    const paniere = (await this.prisma.paniere.findFirst({
      where: { famiglia, regime },
      select: { id: true },
    })) as { id: string } | null;
    if (!paniere) throw new NotFoundException('Questo paniere non esiste ancora.');

    const righe = (await this.prisma.paniereRicetta.findMany({
      where: { paniereId: paniere.id, slot: { in: slotDaCuiPescare(slot) } },
      select: { recipeId: true },
    })) as { recipeId: string }[];
    const ids = [...new Set(righe.map((r) => r.recipeId))];
    if (!ids.length) return [];

    return (await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, kcal: true, mealSlot: true, active: true },
      orderBy: { name: 'asc' },
    })) as unknown as { id: string; name: string; kcal: number; mealSlot: string; active: boolean }[];
  }

  /**
   * Aggiunge una ricetta a un paniere.
   *
   * ⛔ **Il regime si controlla, e non è una formalità.** Una ricetta onnivora dentro il paniere
   * vegano finirebbe nel piatto di una cliente vegana, e nessuno se ne accorgerebbe fino a lì: è lo
   * stesso controllo che il collegamento a una giornata fa da sempre.
   *
   * ⚠️ **Lo slot si normalizza sul capofila** (Fase 2): spuntino e merenda sono un paniere solo, e
   * scrivere due righe per la stessa ricetta — una per pasto — significherebbe contarla due volte
   * in ogni tabulato. Chi legge poi la ritrova comunque su tutti e due, perché la lettura allarga.
   */
  async aggiungi(famiglia: string, regime: string, slot: string, recipeId: string, actorId: string): Promise<{ aggiunta: boolean }> {
    const paniere = (await this.prisma.paniere.findFirst({ where: { famiglia, regime }, select: { id: true } })) as { id: string } | null;
    if (!paniere) throw new NotFoundException('Questo paniere non esiste ancora: va creato con `npm run panieri:riempi`.');

    const recipe = (await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, name: true, regime: true, allergensReviewed: true, active: true },
    })) as { id: string; name: string; regime: string; allergensReviewed: boolean; active: boolean } | null;
    if (!recipe) throw new NotFoundException('Ricetta non trovata.');
    /**
     * ⛔ **UNA RICETTA SPENTA NON ENTRA — e questo controllo mancava, un giorno soltanto** (1/9).
     *
     * Il pool che il motore legge **non filtra `active`** (§2.4 del piano: 3546 ricette spente
     * ancora servite). Finché il paniere si riempiva dalle giornate approvate il buco era coperto
     * dalla validazione; da quando questa pagina permette di aggiungere una ricetta a mano, no:
     * una bozza dell'agente notturno — che nasce **spenta apposta** perché nessuno l'ha ancora
     * guardata — sarebbe finita nei menu al primo clic.
     *
     * ⚠️ È lo stesso ragionamento degli allergeni non confermati due righe sotto: da qui non si
     * ripassa dal controllo di pubblicazione, quindi i controlli che quello farebbe vanno fatti qui.
     */
    if (!recipe.active) {
      throw new BadRequestException(
        'La ricetta è archiviata o è ancora una bozza: riattivala prima di metterla in un paniere. '
        + 'Da qui non si ripassa dal controllo di pubblicazione, quindi entrerebbe nei menu senza che nessuno l\'abbia approvata.',
      );
    }
    if (recipe.regime !== regime) {
      throw new BadRequestException(
        `La ricetta è ${recipe.regime} e questo paniere è ${regime}. Un piatto di un altro regime dentro un paniere è un errore che nessuno vede finché non arriva nel piatto di una cliente.`,
      );
    }
    /**
     * ⛔ Gli allergeni non confermati non entrano, per la stessa ragione del collegamento a una
     * giornata: da qui non si ripassa dal controllo di pubblicazione, quindi il piatto entrerebbe
     * nei menu con gli allergeni solo **suggeriti**.
     */
    if (!recipe.allergensReviewed) {
      throw new BadRequestException(
        'Gli allergeni di questa ricetta non sono ancora confermati. Confermali in «Allergeni ricette»: da qui non si ripassa dal controllo di pubblicazione.',
      );
    }

    const slotVero = slotCapofila(slot);
    const gia = await this.prisma.paniereRicetta.findFirst({
      where: { paniereId: paniere.id, recipeId, slot: slotVero },
      select: { id: true },
    });
    if (gia) return { aggiunta: false };

    await this.prisma.paniereRicetta.create({ data: { paniereId: paniere.id, recipeId, slot: slotVero } as never });
    await this.audit.log({
      action: 'paniere.ricetta.aggiunta',
      actorId,
      entityType: 'paniere',
      entityId: paniere.id,
      metadata: { famiglia, regime, slot: slotVero, recipeId, nome: recipe.name },
    });
    return { aggiunta: true };
  }

  /**
   * Toglie una ricetta da un paniere.
   *
   * ⛔ **Toglie da TUTTI gli slot gemelli**, e va detto: chi toglie una merenda dallo spuntino si
   * aspetta che sparisca, non che resti servita al pomeriggio. Sono un paniere solo anche quando si
   * disfa, altrimenti la pagina mostrerebbe una cosa e il motore ne farebbe un'altra.
   */
  async togli(famiglia: string, regime: string, slot: string, recipeId: string, actorId: string): Promise<{ tolte: number }> {
    const paniere = (await this.prisma.paniere.findFirst({ where: { famiglia, regime }, select: { id: true } })) as { id: string } | null;
    if (!paniere) throw new NotFoundException('Questo paniere non esiste.');

    const esito = await this.prisma.paniereRicetta.deleteMany({
      where: { paniereId: paniere.id, recipeId, slot: { in: slotDaCuiPescare(slot) } },
    });
    if (esito.count) {
      await this.audit.log({
        action: 'paniere.ricetta.tolta',
        actorId,
        entityType: 'paniere',
        entityId: paniere.id,
        metadata: { famiglia, regime, slot, recipeId, righe: esito.count },
      });
    }
    return { tolte: esito.count };
  }

  /**
   * ⛔ **IN QUALI PANIERI STA QUESTA RICETTA — e in quali potrebbe stare.**
   *
   * Richiesta di Simone (2/9): dal popup «Modifica ricetta», sotto «Dove è usata», poter aggiungere
   * la ricetta a uno o più panieri.
   *
   * ⚠️ **«Dove è usata» e «in quali panieri sta» sono DUE COSE DIVERSE**, e vanno lette come tali:
   * la prima sono le **giornate** che la nominano, la seconda è il **pool** da cui il motore pesca.
   * Con `panieri_sorgente_pool` su `paniere` è la seconda a decidere cosa arriva alla cliente, e la
   * prima diventa storia. Metterle nello stesso elenco farebbe credere che siano la stessa cosa.
   *
   * ⛔ **`bloccata` risponde PRIMA al clic che fallisce.** `aggiungi` rifiuta una ricetta spenta o
   * con gli allergeni non confermati, e sono rifiuti giusti — ma scoprirli premendo un pulsante,
   * paniere per paniere, è far cercare a qualcuno una cosa che sappiamo già. Se non si può
   * aggiungere da nessuna parte, si dice subito e si dice perché.
   *
   * ⚠️ E `disponibili` contiene **solo i panieri del suo regime**: un piatto onnivoro in un paniere
   * vegano `aggiungi` lo rifiuta, e offrirlo nella tendina sarebbe offrire un errore. Il perché lo
   * dice `regime`, che si restituisce apposta.
   */
  async doveSta(recipeId: string): Promise<{
    ricetta: { id: string; name: string; regime: string; active: boolean; allergensReviewed: boolean };
    dentro: { famiglia: string; regime: string; slot: string }[];
    disponibili: { famiglia: string; regime: string }[];
    bloccata: string | null;
  }> {
    const ricetta = (await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, name: true, regime: true, active: true, allergensReviewed: true },
    })) as { id: string; name: string; regime: string; active: boolean; allergensReviewed: boolean } | null;
    if (!ricetta) throw new NotFoundException('Ricetta non trovata.');

    const [panieri, righe] = await Promise.all([
      this.prisma.paniere.findMany({ select: { id: true, famiglia: true, regime: true } }) as unknown as
        Promise<{ id: string; famiglia: string; regime: string }[]>,
      this.prisma.paniereRicetta.findMany({ where: { recipeId }, select: { paniereId: true, slot: true } }) as unknown as
        Promise<{ paniereId: string; slot: string }[]>,
    ]);
    const paniereDi = new Map(panieri.map((p) => [p.id, p]));

    const dentro = righe
      .map((r) => {
        const p = paniereDi.get(r.paniereId);
        return p ? { famiglia: p.famiglia, regime: p.regime, slot: r.slot } : null;
      })
      .filter((x): x is { famiglia: string; regime: string; slot: string } => x !== null)
      .sort((a, b) => a.famiglia.localeCompare(b.famiglia));

    const giaDentro = new Set(righe.map((r) => r.paniereId));
    const disponibili = panieri
      .filter((p) => p.regime === ricetta.regime && !giaDentro.has(p.id))
      .map((p) => ({ famiglia: p.famiglia, regime: p.regime }))
      .sort((a, b) => a.famiglia.localeCompare(b.famiglia));

    /** ⚠️ Le stesse frasi di `aggiungi`, dette prima invece che dopo il clic. */
    const bloccata = !ricetta.active
      ? 'La ricetta è archiviata o è ancora una bozza: riattivala prima di metterla in un paniere. '
        + 'Da qui non si ripassa dal controllo di pubblicazione, quindi entrerebbe nei menu senza che nessuno l\'abbia approvata.'
      : !ricetta.allergensReviewed
        ? 'Gli allergeni di questa ricetta non sono ancora confermati. Confermali in «Allergeni ricette»: '
          + 'da qui non si ripassa dal controllo di pubblicazione.'
        : null;

    return { ricetta, dentro, disponibili, bloccata };
  }

}
