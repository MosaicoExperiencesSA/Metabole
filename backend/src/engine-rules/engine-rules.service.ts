import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CODICI_METODI } from '../common/metodi-cottura';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
import { avvisaCapiNutrizionisti } from '../common/avvisa-nutrizionista';
import { SLOT_ORDINE, coperturaCatalogo, slotAttesi, statoCopertura } from './copertura-catalogo';
import { sincronizzaTagSettimane } from '../menu/tag-settimane';
import { suggestAllergens } from '../catalog/allergens';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_RULES, ENGINE_RULES, ENGINE_RULE_BY_CODE, RULE_CATEGORIES } from './engine-rules.catalog';

import {
  prossimaDaGenerare,
  quantoManca,
  SETTIMANE_OBIETTIVO,
  type StrutturaPasti,
  type VarianteDaRiempire,
} from './prossima-generazione';

/**
 * Il catalogo si genera una SETTIMANA per volta: 7 giorni, 7 ricette per ogni pasto previsto.
 * Vedi `generateCatalogFromPreset` per il perché — in breve: chiedere all'AI 140 ricette in un
 * colpo solo produce JSON rotto, chiederne 7 alla volta no.
 */
const GIORNI_SETTIMANA = 7;
const SETTIMANE_MAX = 12;

/** Nomi dei pasti in italiano: entrano nel prompt, quindi devono essere quelli veri. */
const NOME_PASTO: Record<string, string> = {
  breakfast: 'colazione',
  morning_snack: 'spuntino di metà mattina',
  lunch: 'pranzo',
  afternoon_snack: 'merenda del pomeriggio',
  dinner: 'cena',
};

/**
 * Come si spartiscono le kcal della giornata fra i pasti. Prima la ripartizione la decideva
 * l'AI componendo le giornate; ora che le giornate le compone il codice, la quota va detta —
 * altrimenti ogni ricetta punterebbe alle kcal dell'intera giornata.
 */
function quoteKcalPerSlot(slots: string[], fasting: boolean): Record<string, number> {
  if (fasting) return { lunch: 0.45, afternoon_snack: 0.1, dinner: 0.45 };
  if (slots.length === 5) return { breakfast: 0.2, morning_snack: 0.1, lunch: 0.35, afternoon_snack: 0.1, dinner: 0.25 };
  return { breakfast: 0.25, lunch: 0.4, dinner: 0.35 };
}

/**
 * Gestione delle regole del motore per il CAPO NUTRIZIONISTA:
 * - regole GLOBALI (config_param) — attive subito sul motore;
 * - regole SUGGERITE per tipo di nutrizione (rule_preset, flag `suggested`) — modificabili/aggiungibili;
 * - applicazione di un preset a una DIETA (→ ProductRule, override per prodotto);
 * - PROPOSTE di regole nuove (rule_proposal) che poi implementiamo noi.
 */
@Injectable()
export class EngineRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
  ) {}

  private coerce(code: string, raw: unknown): { value: number | boolean; asString: string } {
    const rule = ENGINE_RULE_BY_CODE.get(code);
    if (!rule) throw new BadRequestException(`Regola sconosciuta: ${code}`);
    if (rule.kind === 'boolean') {
      const value = raw === true || raw === 'true' || raw === 1 || raw === '1';
      return { value, asString: value ? 'true' : 'false' };
    }
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) throw new BadRequestException(`Valore non numerico per ${code}`);
    if (rule.min != null && n < rule.min) throw new BadRequestException(`${code}: minimo ${rule.min}`);
    if (rule.max != null && n > rule.max) throw new BadRequestException(`${code}: massimo ${rule.max}`);
    return { value: n, asString: String(n) };
  }

  /** Catalogo completo: metadati regole + valore globale attuale + categorie. */
  async catalog() {
    const params = (await this.prisma.configParam.findMany({
      where: { key: { in: ENGINE_RULES.map((r) => r.code) } },
      select: { key: true, value: true },
    })) as { key: string; value: string }[];
    const byKey = new Map(params.map((p) => [p.key, p.value]));
    const rules = ENGINE_RULES.map((r) => {
      const raw = byKey.get(r.code);
      let global: number | boolean = r.default;
      if (raw != null) global = r.kind === 'boolean' ? raw === 'true' : Number(raw);
      return { ...r, global, isSet: raw != null };
    });
    return { categories: RULE_CATEGORIES, rules, baseRules: BASE_RULES };
  }

  /** Imposta il valore GLOBALE di una regola (config_param). Attivo subito sul motore.
   *  Se il parametro non è ancora a DB (es. soglie agente coi soli default nel codice) lo crea. */
  async setGlobal(code: string, raw: unknown, actorId: string) {
    const rule = ENGINE_RULE_BY_CODE.get(code)!;
    const { value, asString } = this.coerce(code, raw);
    const exists = await this.prisma.configParam.findUnique({ where: { key: code }, select: { key: true } });
    if (exists) {
      await this.configParams.update(code, asString, actorId); // invalida anche la cache
    } else {
      await this.prisma.configParam.create({
        data: { key: code, value: asString, type: rule.kind === 'boolean' ? 'boolean' : 'number', description: rule.label, updatedById: actorId } as never,
      });
    }
    await this.audit.log({ action: 'engine_rule.global.set', actorId, entityType: 'engine_rule', entityId: code, metadata: { value } });
    return { code, value };
  }

  // ---------- Preset suggeriti per tipo di nutrizione ----------

  listPresets() {
    return this.prisma.rulePreset.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  }

  private cleanRules(rules: Record<string, unknown> | undefined): Record<string, number | boolean> {
    const out: Record<string, number | boolean> = {};
    for (const [code, v] of Object.entries(rules ?? {})) {
      if (!ENGINE_RULE_BY_CODE.has(code)) continue; // ignora codici non nel catalogo
      out[code] = this.coerce(code, v).value;
    }
    return out;
  }

  async createPreset(
    input: { style: string; label: string; description?: string; regime?: string | null; objective?: string | null; meals?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    if (!input.style?.trim() || !input.label?.trim()) throw new BadRequestException('Stile ed etichetta obbligatori.');
    const created = await this.prisma.rulePreset.create({
      data: {
        style: input.style.trim(),
        label: input.label.trim(),
        description: input.description ?? null,
        regime: input.regime ?? null,
        objective: input.objective ?? null,
        meals: ['3', '5', 'fasting'].includes(input.meals ?? '') ? input.meals : '5',
        rules: this.cleanRules(input.rules) as never,
        clinicalNotes: input.clinicalNotes ?? null,
        source: input.source ?? null,
        suggested: input.suggested ?? false, // creata a mano = adottata, non "suggerita da noi"
      } as never,
    });
    await this.audit.log({ action: 'engine_rule.preset.create', actorId, entityType: 'rule_preset', entityId: created.id });
    return created;
  }

  async updatePreset(
    id: string,
    input: { label?: string; description?: string; regime?: string | null; objective?: string | null; meals?: string | null; rules?: Record<string, unknown>; clinicalNotes?: string; source?: string; suggested?: boolean },
    actorId: string,
  ) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    const updated = await this.prisma.rulePreset.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.regime !== undefined ? { regime: input.regime || null } : {}),
        ...(input.objective !== undefined ? { objective: input.objective || null } : {}),
        ...(input.meals !== undefined ? { meals: ['3', '5', 'fasting'].includes(input.meals ?? '') ? input.meals : '5' } : {}),
        ...(input.rules !== undefined ? { rules: this.cleanRules(input.rules) as never } : {}),
        ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes || null } : {}),
        ...(input.source !== undefined ? { source: input.source || null } : {}),
        // modificare una suggerita la marca come adottata (non più "suggerita da noi")
        suggested: input.suggested ?? false,
      },
    });
    await this.audit.log({ action: 'engine_rule.preset.update', actorId, entityType: 'rule_preset', entityId: id });
    return updated;
  }

  async deletePreset(id: string, actorId: string) {
    const existing = await this.prisma.rulePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Preset non trovato.');
    await this.prisma.rulePreset.delete({ where: { id } });
    await this.audit.log({ action: 'engine_rule.preset.delete', actorId, entityType: 'rule_preset', entityId: id });
    return { ok: true };
  }

  /** Applica un preset a una dieta: scrive gli override per prodotto (ProductRule). */
  async applyPresetToDiet(presetId: string, dietId: string, actorId: string) {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const diet = await this.prisma.diet.findUnique({ where: { id: dietId }, select: { id: true } });
    if (!diet) throw new NotFoundException('Dieta non trovata.');
    const rules = (preset.rules ?? {}) as Record<string, number | boolean>;
    let applied = 0;
    for (const [code, value] of Object.entries(rules)) {
      const rule = ENGINE_RULE_BY_CODE.get(code);
      if (!rule) continue;
      const enabled = rule.kind === 'boolean' ? Boolean(value) : true;
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId, ruleCode: code } },
        create: { dietId, ruleCode: code, enabled, params: { value } as never },
        update: { enabled, params: { value } as never },
      });
      applied++;
    }
    await this.audit.log({ action: 'engine_rule.preset.apply', actorId, entityType: 'diet', entityId: dietId, metadata: { presetId, applied } });
    return { applied };
  }

  /**
   * GENERA una SETTIMANA di catalogo dal preset con l'AI: 7 ricette per ogni pasto previsto,
   * più 7 giornate che le usano una per una. Tutto in BOZZA: il nutrizionista rivede e approva
   * (R7) e conferma gli allergeni (R8) prima che il motore lo usi.
   *
   * ## Perché una settimana per volta
   *
   * Prima si chiedeva «per quanti giorni?» e si rispondeva 28 — ma il generatore produceva
   * **5 ricette per pasto** e poi *ricombinava quelle* per 28 giornate. Il commento nel codice
   * lo diceva («ridotto per output AI più piccolo e JSON più affidabile») e il conto tornava:
   * la Keto Mediterranea aveva 28 ricette **in tutto**, non 28 colazioni + 28 pranzi + 28 cene.
   * Con 5 colazioni su 28 giorni, ogni colazione torna cinque o sei volte: la ripetizione non
   * era sfortuna, era aritmetica.
   *
   * Chiedere 140 ricette in un colpo solo riporterebbe il problema di partenza (JSON enorme e
   * rotto). Quindi si lavora **una settimana per volta**, e dentro la settimana **un pasto per
   * volta**: sette richieste piccole invece di una gigante, lanciate in parallelo. Il
   * nutrizionista genera la settimana 1, guarda, genera la 2, e così via fino al mese.
   *
   * Le giornate si compongono **per indice**: il giorno 1 prende la prima ricetta di ogni pasto,
   * il giorno 2 la seconda… Dentro la settimana non si ripete niente per costruzione, e le
   * settimane successive partono da ricette nuove — all'AI si passa l'elenco dei nomi già in
   * catalogo perché non li riproponga.
   *
   * ## Le ricette che ci sono già non si buttano
   *
   * Il nutrizionista ne ha corrette parecchie a mano, e quel lavoro vale più di qualunque
   * generazione. Quindi la modalità normale su una settimana già esistente è **completa**: si
   * tengono le ricette che ci sono, si genera solo la differenza per arrivare a sette per pasto,
   * e si riscrivono le giornate perché nessun piatto torni due volte. Non si cancella niente.
   * `rifai` (butta e rigenera) resta possibile, ma va chiesta apposta.
   */
  async generateCatalogFromPreset(
    presetId: string,
    actorId: string,
    settimanaRichiesta = 1,
    modalita: 'auto' | 'completa' | 'rifai' = 'auto',
  ) {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } })) as { id: string } | null;
    if (!staff) throw new BadRequestException('Serve un profilo nutrizionista per generare il catalogo.');

    const rules = (preset.rules ?? {}) as Record<string, number | boolean>;
    const regime = ['omnivore', 'vegetarian', 'vegan'].includes(preset.regime ?? '') ? (preset.regime as string) : 'omnivore';
    const protMin = Math.round(Number(rules.menu_daycombo_protein_min ?? 0.2) * 100);
    const protMax = Math.round(Number(rules.menu_daycombo_protein_max ?? 0.35) * 100);
    const kcalTol = Number(rules.menu_kcal_balance_tolerance_pct ?? 15);
    const targetKcal = Math.max(600, Math.min(4000, Math.round(Number(rules.menu_daycombo_kcal_target ?? 1500)) || 1500));
    // Dimensione PASTI della variante: 3 pasti, 5 pasti (storico/default) o digiuno
    // intermittente 16:8 (3 pasti nella finestra 12-20, niente colazione).
    const meals = ['3', '5', 'fasting'].includes((preset as { meals?: string | null }).meals ?? '') ? String((preset as { meals?: string | null }).meals) : '5';
    const fasting = meals === 'fasting';
    const slots = meals === '5'
      ? ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
      : fasting
        ? ['lunch', 'afternoon_snack', 'dinner']
        : ['breakfast', 'lunch', 'dinner'];
    const mealsPerDay = slots.length;
    // La settimana CHIESTA. Quella che si genera davvero può essere più bassa: vedi il «recupero»
    // qui sotto, dopo che si sa a che punto è questa variante.
    const settimanaChiesta = Math.max(1, Math.min(SETTIMANE_MAX, Math.round(settimanaRichiesta) || 1));

    const objective = preset.objective ?? 'dimagrimento';
    // LA FAMIGLIA DI RICETTE è dieta + regime + obiettivo, SENZA la struttura pasti.
    // Lo ha chiarito il nutrizionista: la Keto Mediterranea onnivora a 3 pasti, a 5 pasti e a
    // digiuno intermittente mangia gli stessi piatti — cambia come sono distribuiti nella
    // giornata, non che cosa sono. I piatti cambiano davvero quando cambia il REGIME (vegano,
    // vegetariano) o lo STILE (keto invece di mediterranea).
    // Quindi le tre varianti di struttura CONDIVIDONO le ricette: si generano una volta sola e
    // le giornate delle altre varianti le riusano. Un Recipe non appartiene a una Diet — è
    // referenziato dalle giornate — quindi condividerlo non richiede duplicati.
    const famigliaWhere = { name: preset.label, style: preset.style, regime, objective } as never;
    const famiglia = (await this.prisma.diet.findMany({
      where: famigliaWhere,
      select: { id: true, name: true, mealsPerDay: true, fasting: true },
    })) as { id: string; name: string; mealsPerDay: number; fasting: boolean | null }[];
    const existingVariant = famiglia.find((d) => d.mealsPerDay === mealsPerDay && !!d.fasting === fasting) ?? null;
    const sorelle = famiglia.filter((d) => d.id !== existingVariant?.id).map((d) => d.id);

    // Quante settimane esistono già su questa variante (dal giorno più alto in catalogo).
    let settimaneFatte = 0;
    if (existingVariant) {
      const ultimo = (await this.prisma.dietDayTemplate.findFirst({
        where: { dietId: existingVariant.id },
        orderBy: { dayIndex: 'desc' },
        select: { dayIndex: true },
      })) as { dayIndex: number } | null;
      settimaneFatte = Math.ceil((ultimo?.dayIndex ?? 0) / GIORNI_SETTIMANA);
    }

    /**
     * SETTIMANA CHIESTA vs SETTIMANA POSSIBILE — il difetto dell'11/8 («fino alla 9 le ha generate,
     * la 10 no»).
     *
     * Le settimane si generano in ordine: un buco (la 1 e la 3 senza la 2) darebbe un ciclo con
     * giornate mancanti in mezzo, che il motore non sa colmare. Il controllo è giusto. Ma qui prima
     * c'era un'**eccezione**, e l'eccezione era la trappola:
     *
     *  - la striscia delle settimane nel backoffice, con la spunta «genera tutte le varianti»,
     *    conta le settimane della **famiglia** (il giorno più alto fra tutte le varianti);
     *  - questo controllo le conta sulla **singola variante**.
     *
     * Le due cose divergono appena una variante resta indietro — succede quando una settimana le
     * fallisce, o quando il giro precedente si è interrotto a metà famiglia. Da quel momento la
     * famiglia dice «la prossima è la 10» e quella variante dice «la mia prossima è la 9»: la
     * richiesta veniva rifiutata con un'eccezione, e in un giro su diciotto varianti quell'eccezione
     * fermava anche tutte quelle dopo. Diciassette varianti sane bloccate da una.
     *
     * Generare `settimaneFatte + 1` invece di rifiutare **non crea nessun buco** — è esattamente
     * l'invariante che il controllo difende — e fa quello che uno intende chiedendo «portale alla
     * 10»: chi è indietro recupera un passo per volta. Chi chiama sa cosa è stato fatto perché la
     * risposta dice sia la settimana chiesta sia quella generata.
     */
    const week = Math.min(settimanaChiesta, settimaneFatte + 1);
    const primoGiorno = (week - 1) * GIORNI_SETTIMANA + 1;
    const ultimoGiorno = week * GIORNI_SETTIMANA;
    // Settimana già in catalogo e nessuna istruzione: non si tocca niente e si torna indietro,
    // così è il backoffice a chiedere se completarla o rifarla.
    if (week <= settimaneFatte && modalita === 'auto') {
      return {
        alreadyExists: true as const,
        dietId: existingVariant!.id,
        dietName: existingVariant!.name,
        week,
        settimanaChiesta,
        settimaneFatte,
        recipes: 0,
        riusate: 0,
        days: 0,
        groups: 0,
      };
    }

    // Nomi già in catalogo in TUTTA la famiglia: servono all'AI per non riproporre gli stessi
    // piatti nelle settimane successive (è il punto di tutta l'operazione).
    const nomiGiaUsati = await this.nomiRicetteFamiglia(famiglia.map((d) => d.id));

    // Ricette che questa variante ha GIÀ e che possono servire a questa settimana: comprese
    // quelle corrette a mano dal nutrizionista. Si leggono PRIMA di toccare le giornate.
    const proprie = existingVariant && modalita !== 'rifai'
      ? await this.ricetteDisponibiliPerSettimana(existingVariant.id, week)
      : new Map<string, string[]>();

    if (existingVariant && week <= settimaneFatte) {
      if (modalita === 'rifai') {
        // BUTTA E RIFAI: si cancellano le giornate della settimana e le bozze che non usa più
        // nessuno. È l'unica strada che perde del lavoro fatto a mano, e va chiesta apposta.
        await this.cancellaSettimana(existingVariant.id, primoGiorno, ultimoGiorno);
      } else {
        // COMPLETA: via solo le giornate, che vanno riscritte. Nessuna ricetta viene cancellata.
        await this.prisma.dietDayTemplate.deleteMany({
          where: { dietId: existingVariant.id, dayIndex: { gte: primoGiorno, lte: ultimoGiorno } },
        });
      }
    }

    // Ricette che le varianti SORELLE hanno già per questa settimana, pasto per pasto e in
    // ordine di giornata. Se ci sono, questa variante le riusa invece di rigenerarle: stessa
    // dieta, stesso regime, stessi piatti.
    const condiviseGrezze = await this.ricetteSettimanaDelleSorelle(sorelle, primoGiorno, ultimoGiorno);

    /**
     * I piatti delle SORELLE vanno filtrati con la stessa regola delle proprie, e senza questo
     * filtro «completa» non completava niente.
     *
     * Il caso, quello vero del 9/8: settimane 1-4 fatte col metodo vecchio (pochi piatti
     * ricombinati), 5-12 fatte bene. Si chiede di completare la settimana 1. Le *proprie*
     * vengono filtrate — quei piatti compaiono anche nelle altre settimane, quindi non contano —
     * e fin qui bene. Ma poi arrivavano le sorelle (la variante a 3 pasti, quella a digiuno) che
     * per la settimana 1 hanno **esattamente gli stessi piatti presi in prestito**, e quelli
     * entravano senza controlli: `mancanti` tornava a zero, l'AI non veniva chiamata, e la
     * settimana restava magra. Rigenerando, identico. Dal backoffice: «il pulsante non fa
     * niente» — ed era vero.
     *
     * Un piatto di una sorella vale solo se **questa variante non lo sta già usando in un'altra
     * settimana**: altrimenti prenderlo qui non aggiunge varietà, la toglie.
     */
    const usoProprio = existingVariant && modalita !== 'rifai'
      ? (await this.usoDeiPiatti(existingVariant.id, week)).altrove
      : new Map<string, Set<string>>();
    const condivise = new Map<string, string[]>();
    for (const [slot, lista] of condiviseGrezze) {
      const occupate = usoProprio.get(slot) ?? new Set<string>();
      const libere = lista.filter((id) => !occupate.has(id));
      if (libere.length) condivise.set(slot, libere);
    }

    /**
     * RICETTE ORFANE: già generate per questa dieta e per questo regime, ma **fuori dal ciclo**
     * — nessuna giornata le usa. Ne nascono ogni volta che si compatta il catalogo
     * (`npm run compatta:menu` mette in fila i piatti e lascia fuori quello che avanza), e ogni
     * volta che una settimana viene rifatta.
     *
     * Vanno usate PRIMA di chiamare l'AI: sono piatti pagati, scritti e — spesso — già corretti
     * a mano dal nutrizionista. Chiedere all'AI un piatto nuovo mentre ne abbiamo uno buono che
     * nessuno usa è buttare via due volte, i soldi e il lavoro di chi l'ha riletto.
     *
     * Il filtro sul **regime** non è un dettaglio: una ricetta onnivora dentro una dieta vegana
     * sarebbe un errore grave e silenzioso. Si prendono solo quelle dello stesso regime e con il
     * tag della stessa dieta, che è come il generatore le marca alla nascita.
     */
    const orfane = existingVariant
      ? await this.ricetteOrfane(existingVariant.id, preset.label, regime, slots)
      : new Map<string, string[]>();

    // Per ogni pasto: prima quello che c'è (sorelle, poi le proprie, poi le orfane), e si genera
    // SOLO la differenza per arrivare a sette. È così che il lavoro del nutrizionista non si perde.
    const gia = new Map<string, string[]>();
    const mancanti = new Map<string, number>();
    for (const sl of slots) {
      const base: string[] = [];
      for (const fonte of [condivise.get(sl) ?? [], proprie.get(sl) ?? [], orfane.get(sl) ?? []]) {
        for (const id of fonte) {
          if (base.length >= GIORNI_SETTIMANA) break;
          if (!base.includes(id)) base.push(id);
        }
      }
      gia.set(sl, base);
      mancanti.set(sl, Math.max(0, GIORNI_SETTIMANA - base.length));
    }
    const daGenerare = slots.filter((sl) => (mancanti.get(sl) ?? 0) > 0);

    const regimeRule = regime === 'vegan' ? 'nessun alimento di origine animale' : regime === 'vegetarian' ? 'niente carne né pesce (uova/latticini sì)' : 'onnivoro';
    const quote = quoteKcalPerSlot(slots, fasting);

    // Un pasto per volta, in parallelo: richieste piccole al posto di una gigante. Se una
    // fallisce non trascina le altre — si genera quel che c'è e lo si dice.
    const generati = await Promise.all(
      daGenerare.map(async (slot) => ({
        slot,
        ricette: await this.generaRicetteDiUnPasto({
          slot,
          quante: mancanti.get(slot) ?? GIORNI_SETTIMANA,
          label: preset.label,
          style: preset.style,
          objective,
          regime,
          regimeRule,
          clinicalNotes: preset.clinicalNotes ?? null,
          kcalPasto: Math.round(targetKcal * (quote[slot] ?? 1 / slots.length)),
          kcalGiorno: targetKcal,
          kcalTol,
          protMin,
          protMax,
          fasting,
          settimana: week,
          nomiDaEvitare: nomiGiaUsati,
        }),
      })),
    );

    // Un pasto è "vuoto" solo se non ha NIENTE: né ricette già in casa né nuove.
    const vuoti = generati
      .filter((p) => p.ricette.length === 0 && (gia.get(p.slot) ?? []).length === 0)
      .map((p) => p.slot);
    if (vuoti.length === slots.length) {
      const motivo = this.ai.lastError ?? 'assistente AI non disponibile';
      /**
       * 503 quando l'AI è fuori uso per un motivo DEFINITIVO (credito esaurito, chiave non valida,
       * modello inesistente), 400 negli altri casi. La differenza non è formale: il backoffice, che
       * gira su diciotto varianti, sul 503 si ferma subito invece di ripetere diciassette volte una
       * richiesta che non può riuscire — e chi guarda smette di aspettare una barra inutile (12/8).
       */
      if (this.ai.lastErrorFatale) throw new ServiceUnavailableException(`Generazione non riuscita: ${motivo}.`);
      throw new BadRequestException(`Generazione non riuscita: ${motivo}.`);
    }

    // La dieta si crea solo alla prima settimana; dalla seconda si aggiunge a quella che c'è.
    const diet = existingVariant
      ? existingVariant
      : ((await this.prisma.diet.create({
          data: {
            name: preset.label,
            regime, style: preset.style, mealsPerDay, fasting,
            levels: [{ level: 1, kcal: targetKcal }], options: fasting ? { intermittentFasting: '16:8', window: '12-20' } : {},
            authorId: staff.id, status: 'draft',
            objective, clientVisible: false,
          } as never,
        })) as { id: string; name: string });

    // Ricette in bozza, tenute in ordine per pasto: l'ordine È l'abbinamento alle giornate.
    // Prima quelle che c'erano già (comprese le correzioni a mano), poi le nuove in coda.
    const bySlot = new Map<string, string[]>();
    let recCount = 0;
    let riusate = 0;
    for (const sl of slots) {
      const ids: string[] = [...(gia.get(sl) ?? [])];
      riusate += ids.length;
      const ricette = generati.find((g) => g.slot === sl)?.ricette ?? [];
      for (const r of ricette) {
        const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
        const allergens = suggestAllergens(ingredients).map((s) => s.allergen);
        const created = await this.prisma.recipe.create({
          data: {
            name: String(r.name ?? 'Ricetta generata').slice(0, 120),
            regime, mealSlot: sl as never,
            kcal: Math.max(0, Math.round(Number(r.kcal) || 0)),
            ingredients: ingredients as never,
            cookingMethods: (Array.isArray(r.cookingMethods) ? r.cookingMethods : []) as never,
            macros: (r.macros ?? undefined) as never,
            // Il tag registrava solo lo STILE (`gen:low_carb`), e due diete diverse possono
            // condividerlo — "Basso indice glicemico" e "Low carb" sono entrambe `low_carb`.
            // Guardando la riga in catalogo non si capiva da quale dieta venisse la ricetta.
            // NIENTE `sett:` qui: il tag della settimana lo scrive `sincronizzaTagSettimane` in
            // fondo, leggendolo dalle GIORNATE. Scriverlo alla nascita voleva dire registrare in
            // quale generazione era nata la ricetta, non dove finiva — e un piatto creato generando
            // la settimana 1 e poi usato nella 2 restava «sett:1» per sempre. Simone, 11/8: «quel tag
            // per me è dove viene utilizzato, non mi interessa quando è stato creato».
            tags: [`gen:${preset.style}`, `dieta:${preset.label}`],
            active: false, // BOZZA: non entra nel motore finché non approvata
            allergens, allergensReviewed: false,
          } as never,
        });
        ids.push(created.id);
        recCount++;
      }
      bySlot.set(sl, ids);
    }

    // Giornate per INDICE: giorno 1 = prima ricetta di ogni pasto, giorno 2 = seconda…
    // Dentro la settimana non si ripete niente per costruzione. Se un pasto ha prodotto meno
    // di sette piatti si ruota su quelli disponibili invece di lasciare il giorno monco.
    let dayCount = 0;
    for (let j = 0; j < GIORNI_SETTIMANA; j++) {
      const pasti = slots
        .map((sl) => {
          const pool = bySlot.get(sl) ?? [];
          return pool.length ? { slot: sl, recipeId: pool[j % pool.length] } : null;
        })
        .filter((m): m is { slot: string; recipeId: string } => !!m);
      if (pasti.length === 0) break;
      await this.prisma.dietDayTemplate.create({
        data: { dietId: diet.id, level: 1, dayIndex: primoGiorno + j, meals: pasti as never },
      });
      dayCount++;
    }

    /**
     * I TAG DELLE SETTIMANE, allineati alle giornate appena scritte (11/8).
     *
     * Va fatto **dopo** le giornate, perché è da quelle che si legge la settimana. Si passa l'elenco
     * delle ricette toccate — le nuove e quelle riusate — così non si rilegge tutto il catalogo a ogni
     * generazione. L'unione fra le varianti sorelle la fa la funzione: la stessa ricetta può stare
     * nella settimana 1 di una variante e nella 2 di un'altra.
     */
    const toccate = [...new Set([...bySlot.values()].flat())];
    await sincronizzaTagSettimane(this.prisma, toccate).catch(() => undefined);

    // Gruppi di equivalenza e regole del preset: roba della dieta, non della settimana.
    // Si fanno solo quando la dieta nasce, altrimenti si riscriverebbero identici ogni volta.
    let grpCount = 0;
    if (!existingVariant) {
      grpCount = await this.generaGruppiEquivalenza(diet.id, preset.label, regime, regimeRule);
      for (const [code, value] of Object.entries(rules)) {
        const rule = ENGINE_RULE_BY_CODE.get(code);
        if (!rule) continue;
        const enabled = rule.kind === 'boolean' ? Boolean(value) : true;
        await this.prisma.productRule.upsert({
          where: { dietId_ruleCode: { dietId: diet.id, ruleCode: code } },
          create: { dietId: diet.id, ruleCode: code, enabled, params: { value } as never },
          update: { enabled, params: { value } as never },
        });
      }
    }

    await this.audit.log({
      action: 'engine_rule.preset.generate_catalog',
      actorId, entityType: 'diet', entityId: diet.id,
      metadata: { presetId, week, recipes: recCount, riusate, days: dayCount, groups: grpCount, pastiVuoti: vuoti },
    });
    return {
      dietId: diet.id,
      dietName: diet.name,
      week,
      /** Quella chiesta: se è diversa da `week`, questa variante era rimasta indietro e ha recuperato. */
      settimanaChiesta,
      settimaneFatte: Math.max(settimaneFatte, week),
      recipes: recCount,
      /** Ricette prese da una variante sorella invece di rigenerarle (stessa dieta, stesso regime). */
      riusate,
      days: dayCount,
      groups: grpCount,
      /** Pasti per cui l'AI non ha prodotto niente: il nutrizionista deve saperlo. */
      pastiIncompleti: vuoti,
    };
  }

  /**
   * LA TABELLA DELLA COPERTURA: una riga per variante, con quanti piatti diversi ha per ogni pasto.
   *
   * Richiesta di Simone dell'11/8 — «così a colpo d'occhio capiamo dove siamo» — nata dal problema
   * «dice creata e validata, poi ci torno ed è vuota». Prima di correggere qualcosa serve sapere se i
   * piatti nel database ci sono: le tre colonne per pasto (piatti / attivi / rotti) distinguono
   * «generata e non validata» da «riferimenti morti» da «mai generata», che sono tre difetti diversi
   * con tre correzioni diverse. Vedi `copertura-catalogo.ts`.
   *
   * `settimana` guarda DENTRO una settimana (11/8): i conteggi si fanno solo sulle giornate da
   * `(N-1)*7+1` a `N*7` e l'atteso per pasto diventa 7. Serve a vedere se il ciclo è distribuito o
   * ammucchiato all'inizio — cosa che i totali nascondono per costruzione.
   */
  async coperturaVarianti(settimana?: number | null) {
    const [diete, copertura] = await Promise.all([
      this.prisma.diet.findMany({
        select: {
          id: true, name: true, style: true, regime: true, objective: true,
          mealsPerDay: true, fasting: true, status: true, clientVisible: true, siteVisible: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }, { regime: 'asc' }, { objective: 'asc' }, { mealsPerDay: 'asc' }],
      }) as unknown as Promise<{
        id: string; name: string; style: string | null; regime: string; objective: string | null;
        mealsPerDay: number; fasting: boolean | null; status: string;
        clientVisible: boolean | null; siteVisible: boolean | null; updatedAt: Date;
      }[]>,
      coperturaCatalogo(this.prisma, settimana),
    ]);

    const righe = diete.map((d) => {
      const c = copertura.get(d.id);
      const attesi = slotAttesi(d.mealsPerDay, !!d.fasting);
      const { stato, dettaglio } = statoCopertura(c, attesi, settimana);
      /** I pasti che questa struttura NON prevede tornano `null`: uno zero lì sembrerebbe un buco. */
      const perSlot: Record<string, { piatti: number; attivi: number; rotti: number } | null> = {};
      for (const sl of SLOT_ORDINE) {
        perSlot[sl] = attesi.includes(sl) ? (c?.perSlot[sl] ?? { piatti: 0, attivi: 0, rotti: 0 }) : null;
      }
      return {
        ...d,
        settimane: c?.settimane ?? 0,
        giorni: c?.giorni ?? 0,
        /** Giornate dentro la settimana guardata (= `giorni` quando si guarda tutto). */
        giorniSettimana: c?.giorniSettimana ?? 0,
        perSlot,
        stato,
        dettaglio,
        /**
         * Quanti piatti diversi per pasto servirebbero. Guardando tutto è 7 × le settimane presenti;
         * guardando UNA settimana è 7, perché il metro è «questa settimana si ripete o no».
         */
        attesoPerPasto: settimana ? GIORNI_SETTIMANA : (c?.settimane ?? 0) * GIORNI_SETTIMANA,
      };
    });

    const riassunto = {
      varianti: righe.length,
      complete: righe.filter((r) => r.stato === 'completa').length,
      magre: righe.filter((r) => r.stato === 'magra').length,
      daValidare: righe.filter((r) => r.stato === 'da_validare').length,
      rotte: righe.filter((r) => r.stato === 'rotta').length,
      vuote: righe.filter((r) => r.stato === 'vuota').length,
      /** La settimana guardata (`null` = tutto il catalogo): la pagina la rilegge da qui. */
      settimana: settimana ?? null,
      /**
       * La settimana più alta esistente in catalogo. Serve alla tendina della pagina: offrire 1-12
       * fissi vorrebbe dire proporre settimane che non esistono da nessuna parte, e ogni scelta a
       * vuoto è un giro di query per una tabella vuota.
       */
      settimaneMassime: righe.reduce((m, r) => Math.max(m, r.settimane), 0),
    };
    return { righe, riassunto };
  }

  /** Quante settimane di catalogo ha già la variante di questo preset (0 se non esiste). */
  async settimaneGenerate(presetId: string, famiglia = false): Promise<{
    dietId: string | null;
    settimane: number;
    giorni: number;
    /** Numeri delle settimane che hanno le giornate ma non i piatti: vanno completate. */
    settimaneMagre: number[];
    /** Piatti diversi del pasto messo peggio: è il numero che conta davvero. */
    ricettePerPasto: number;
  }> {
    const preset = await this.prisma.rulePreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException('Preset non trovato.');
    const regime = ['omnivore', 'vegetarian', 'vegan'].includes(preset.regime ?? '') ? (preset.regime as string) : 'omnivore';
    const meals = ['3', '5', 'fasting'].includes((preset as { meals?: string | null }).meals ?? '') ? String((preset as { meals?: string | null }).meals) : '5';
    const fasting = meals === 'fasting';
    const mealsPerDay = fasting ? 3 : meals === '5' ? 5 : 3;
    const diet = (await this.prisma.diet.findFirst({
      where: { name: preset.label, style: preset.style, regime, objective: preset.objective ?? 'dimagrimento', mealsPerDay, fasting } as never,
      select: { id: true },
    })) as { id: string } | null;
    if (!diet) return { dietId: null, settimane: 0, giorni: 0, settimaneMagre: [], ricettePerPasto: 0 };

    /**
     * `famiglia`: la striscia delle settimane risponde per TUTTE le varianti del gruppo, non
     * per quella attiva. Serve perché il nutrizionista lavora con la spunta «genera tutte le 18
     * varianti»: in quella modalità la generazione tocca tutto il gruppo, e mostrare lo stato di
     * una sola variante è una mezza verità — la settimana appare verde mentre su una sorella è
     * ancora magra, e le clienti di quella sorella ricevono un menu che si ripete.
     * Una settimana è magra se è magra **da qualche parte**: finché non sono a posto tutte, non
     * è a posto niente.
     */
    const diete = famiglia
      ? ((await this.prisma.diet.findMany({
          where: { name: preset.label, style: preset.style, status: { not: 'rejected' } } as never,
          select: { id: true },
        })) as { id: string }[])
      : [diet];
    if (diete.length === 0) return { dietId: diet.id, settimane: 0, giorni: 0, settimaneMagre: [], ricettePerPasto: 0 };

    const ultimo = (await this.prisma.dietDayTemplate.findFirst({
      where: { dietId: { in: diete.map((d) => d.id) } },
      orderBy: { dayIndex: 'desc' },
      select: { dayIndex: true },
    })) as { dayIndex: number } | null;
    const giorni = ultimo?.dayIndex ?? 0;

    /**
     * Quali settimane sono MAGRE. Terza versione, e le prime due sbagliavano bersaglio.
     *
     * 1. **Il magazzino** (piatti totali ÷ 7) dava il risultato *rovesciato*: su 63 giorni con
     *    43 pranzi distinti diceva «6 settimane piene» e marcava magre proprio quelle appena
     *    generate con sette piatti nuovi.
     * 2. **Dentro la settimana** («questi sette giorni hanno sette piatti diversi?») è vero ma
     *    non basta: una settimana può avere sette piatti diversi *fra loro* ed essere fatta di
     *    piatti presi in prestito da altre settimane. Il catalogo diceva «70 giorni, tutte
     *    complete» con 43 piatti in tutto — cioè quasi metà del mese era una ripetizione.
     *
     * La promessa alla cliente è «28 giorni senza mai lo stesso piatto», e la promessa vale sul
     * CICLO, non sulla singola settimana. Quindi un piatto conta per questa settimana solo se
     * **non lo usa nessun'altra settimana**: è la stessa regola con cui `completa` decide cosa
     * riusare, e le due cose devono dire la stessa cosa, altrimenti la pagina promette un lavoro
     * che il generatore non fa.
     *
     * Se due settimane si contendono un piatto risultano magre entrambe: è corretto, e si
     * risolve da sé — completando la prima, la seconda torna esclusiva e diventa piena.
     */
    // Il conto si fa DIETA PER DIETA — la regola «esclusiva della settimana» ha senso solo
    // dentro un ciclo, perché è quello che una cliente riceve. Poi si mette insieme: magra da
    // qualche parte = magra.
    const magreUnione = new Set<number>();
    let minimo = 0;
    let primo = true;
    for (const d of diete) {
      const templates = (await this.prisma.dietDayTemplate.findMany({
        where: { dietId: d.id },
        select: { dayIndex: true, meals: true },
      })) as { dayIndex: number; meals: unknown }[];
      if (templates.length === 0) continue;

      // Per ogni pasto: chi usa cosa, settimana per settimana.
      const perSettimana = new Map<number, { giorni: number; slot: Map<string, Set<string>> }>();
      const globale = new Map<string, Set<string>>();
      for (const t of templates) {
        const w = Math.ceil(t.dayIndex / GIORNI_SETTIMANA);
        const box = perSettimana.get(w) ?? { giorni: 0, slot: new Map<string, Set<string>>() };
        box.giorni++;
        for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
          if (!m.slot || !m.recipeId) continue;
          const set = box.slot.get(m.slot) ?? new Set<string>();
          set.add(m.recipeId);
          box.slot.set(m.slot, set);
          const g = globale.get(m.slot) ?? new Set<string>();
          g.add(m.recipeId);
          globale.set(m.slot, g);
        }
        perSettimana.set(w, box);
      }

      const settimane = [...perSettimana.entries()].sort((a, b) => a[0] - b[0]);
      for (const [w, box] of settimane) {
        if (box.slot.size === 0) { magreUnione.add(w); continue; }
        let magra = false;
        for (const [slot, usate] of box.slot) {
          // Quante di queste sono SOLO sue: un piatto condiviso con un'altra settimana è una
          // ripetizione nel ciclo, quindi non conta.
          let esclusive = 0;
          for (const id of usate) {
            const altrove = settimane.some(([w2, b2]) => w2 !== w && (b2.slot.get(slot)?.has(id) ?? false));
            if (!altrove) esclusive++;
          }
          if (esclusive < box.giorni) { magra = true; break; }
        }
        if (magra) magreUnione.add(w);
      }
      const minDieta = globale.size ? Math.min(...[...globale.values()].map((v) => v.size)) : 0;
      minimo = primo ? minDieta : Math.min(minimo, minDieta);
      primo = false;
    }
    const settimaneMagre = [...magreUnione].sort((a, b) => a - b);

    return {
      dietId: diet.id,
      settimane: Math.ceil(giorni / GIORNI_SETTIMANA),
      giorni,
      /** Numeri delle settimane che hanno le giornate ma non i piatti: vanno completate. */
      settimaneMagre,
      /** Piatti diversi del pasto messo peggio, su tutto il catalogo della variante. */
      ricettePerPasto: minimo,
    };
  }

  /**
   * Nomi delle ricette già presenti in TUTTA la famiglia (le varianti di struttura pasti della
   * stessa dieta e dello stesso regime): servono per non farle ripetere all'AI settimana dopo
   * settimana. Sulla famiglia e non sulla singola variante, perché le ricette sono condivise.
   */
  private async nomiRicetteFamiglia(dietIds: string[]): Promise<string[]> {
    if (dietIds.length === 0) return [];
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId: { in: dietIds } },
      select: { meals: true },
    })) as { meals: unknown }[];
    const ids = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) if (m.recipeId) ids.add(m.recipeId);
    }
    if (ids.size === 0) return [];
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: [...ids] } },
      select: { name: true },
    })) as { name: string }[];
    return recipes.map((r) => r.name);
  }

  /**
   * Le ricette che la dieta ha GIÀ e che possono servire alla settimana `week`, pasto per pasto.
   *
   * Serve a non buttare via niente: il nutrizionista ne ha corrette parecchie a mano, e le diete
   * vecchie hanno cinque piatti per pasto ricombinati su ventotto giorni. Quei cinque sono buoni,
   * mancano gli altri.
   *
   * ## Il criterio, e perché il primo era sbagliato
   *
   * La prima versione metteva in fila il "magazzino" di ogni pasto e ne prendeva la fetta
   * `[(week-1)*7, week*7)`. Funziona solo se le settimane si completano in ordine partendo da un
   * catalogo intatto. Appena non è così — ed è il caso reale — si rompe:
   *
   * *Cos'è successo l'8/8.* Su una dieta con le settimane 5-9 già generate, completare la
   * settimana 1 pescava dalla fetta `[0,7)` del magazzino, che conteneva i 5 piatti vecchi **più
   * due presi in prestito dalla settimana 5**. Risultato: `mancanti = 0`, nessuna ricetta nuova
   * generata, e due piatti duplicati fra la settimana 1 e la 5. Dal backoffice sembrava che
   * "completa" non facesse niente — e in effetti non faceva niente.
   *
   * La regola giusta non guarda le posizioni, guarda **chi sta già usando cosa**: una ricetta è
   * disponibile per questa settimana solo se **nessun'altra settimana la usa**. Le ricette già
   * dentro questa settimana e non usate altrove restano (è così che sopravvivono le correzioni a
   * mano); tutto il resto si genera nuovo.
   */
  private async ricetteDisponibiliPerSettimana(dietId: string, week: number): Promise<Map<string, string[]>> {
    const { inQuesta, altrove } = await this.usoDeiPiatti(dietId, week);
    const out = new Map<string, string[]>();
    for (const [slot, lista] of inQuesta) {
      const occupate = altrove.get(slot) ?? new Set<string>();
      // Solo quelle che non sta usando nessun'altra settimana: se un piatto compare anche
      // altrove, tenerlo qui vorrebbe dire ripeterlo nel ciclo.
      const libere = lista.filter((id) => !occupate.has(id)).slice(0, GIORNI_SETTIMANA);
      if (libere.length) out.set(slot, libere);
    }
    return out;
  }

  /**
   * Ricette della dieta che **non usa nessuna giornata**: generate e poi rimaste fuori dal ciclo
   * (compattazione del catalogo, settimane rifatte). Si riusano prima di chiedere all'AI piatti
   * nuovi: sono già scritte, spesso già corrette a mano, e ricomprarle è spreco doppio.
   *
   * Il filtro sul REGIME è la parte che non si può sbagliare: una ricetta onnivora finita in una
   * dieta vegana è un errore grave e silenzioso. Si guarda anche il tag `dieta:<nome>`, che il
   * generatore mette alla nascita, per non pescare da una famiglia diversa.
   */
  private async ricetteOrfane(
    dietId: string,
    label: string,
    regime: string,
    slots: string[],
  ): Promise<Map<string, string[]>> {
    const candidate = (await this.prisma.recipe.findMany({
      where: { regime, tags: { has: `dieta:${label}` }, mealSlot: { in: slots as never } } as never,
      select: { id: true, mealSlot: true },
      take: 2000,
    })) as { id: string; mealSlot: string }[];
    if (candidate.length === 0) return new Map();

    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId },
      select: { meals: true },
    })) as { meals: unknown }[];
    const usate = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) {
        if (m.recipeId) usate.add(m.recipeId);
      }
    }

    const out = new Map<string, string[]>();
    for (const r of candidate) {
      if (usate.has(r.id)) continue;
      const lista = out.get(r.mealSlot) ?? [];
      lista.push(r.id);
      out.set(r.mealSlot, lista);
    }
    return out;
  }

  /**
   * Chi usa cosa dentro una variante: i piatti di QUESTA settimana e quelli di TUTTE LE ALTRE.
   * Estratto da `ricetteDisponibiliPerSettimana` perché serve anche a filtrare i piatti che
   * arrivano dalle varianti sorelle (vedi sotto: era il buco che rendeva «completa» inutile).
   */
  private async usoDeiPiatti(dietId: string, week: number): Promise<{
    inQuesta: Map<string, string[]>;
    altrove: Map<string, Set<string>>;
  }> {
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId },
      orderBy: { dayIndex: 'asc' },
      select: { dayIndex: true, meals: true },
    })) as { dayIndex: number; meals: unknown }[];

    const inQuesta = new Map<string, string[]>();
    const altrove = new Map<string, Set<string>>();
    for (const t of templates) {
      const w = Math.ceil(t.dayIndex / GIORNI_SETTIMANA);
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        if (w === week) {
          const lista = inQuesta.get(m.slot) ?? [];
          if (!lista.includes(m.recipeId)) lista.push(m.recipeId);
          inQuesta.set(m.slot, lista);
        } else {
          const set = altrove.get(m.slot) ?? new Set<string>();
          set.add(m.recipeId);
          altrove.set(m.slot, set);
        }
      }
    }
    return { inQuesta, altrove };
  }

  /**
   * Ricette che le varianti SORELLE (stessa dieta, stesso regime, altra struttura pasti) hanno
   * già per questa settimana: pasto per pasto, in ordine di giornata.
   *
   * È quello che permette di generare una volta sola: la Keto Mediterranea onnivora a 5 pasti,
   * a 3 pasti e a digiuno intermittente mangiano gli stessi piatti — cambia come sono
   * distribuiti nella giornata. La variante a 3 pasti prende colazione, pranzo e cena da quella
   * a 5 e non chiede niente all'AI; il digiuno prende pranzo, merenda e cena.
   */
  private async ricetteSettimanaDelleSorelle(
    sorelle: string[],
    dalGiorno: number,
    alGiorno: number,
  ): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (sorelle.length === 0) return out;
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId: { in: sorelle }, dayIndex: { gte: dalGiorno, lte: alGiorno } },
      orderBy: { dayIndex: 'asc' },
      select: { dayIndex: true, meals: true },
    })) as { dayIndex: number; meals: unknown }[];
    // Un pasto per giornata: se due sorelle hanno la stessa giornata, la prima vince — sono
    // comunque le stesse ricette, e quel che conta è che l'ordine resti quello dei giorni.
    const perSlot = new Map<string, Map<number, string>>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { slot?: string; recipeId?: string }[]) : [])) {
        if (!m.slot || !m.recipeId) continue;
        const perGiorno = perSlot.get(m.slot) ?? new Map<number, string>();
        if (!perGiorno.has(t.dayIndex)) perGiorno.set(t.dayIndex, m.recipeId);
        perSlot.set(m.slot, perGiorno);
      }
    }
    for (const [slot, perGiorno] of perSlot) {
      const ordinate = [...perGiorno.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id);
      if (ordinate.length) out.set(slot, ordinate);
    }
    return out;
  }

  /**
   * Cancella UNA settimana: le sue giornate, e le ricette che nessun altro sta usando.
   *
   * Due protezioni, e la seconda è quella che conta:
   *  1. una ricetta usata da un'ALTRA settimana o da una variante SORELLA non si tocca;
   *  2. una ricetta **già attiva** non si cancella mai, nemmeno se non la usa più nessuna
   *     giornata. Attiva vuol dire che il motore l'ha potuta erogare, quindi può stare dentro
   *     un menu già consegnato: quel menu è una fotografia e continuerebbe a mostrarsi, ma le
   *     valutazioni e le sostituzioni la cercano per id e non la troverebbero più.
   *     Le bozze mai attivate (`active: false`) non sono mai uscite di qui: quelle si possono
   *     buttare, ed è il caso normale di una rigenerazione.
   * Il prezzo della protezione è qualche ricetta attiva orfana in catalogo dopo aver rigenerato
   * una settimana di una dieta già pubblicata. È il verso giusto in cui sbagliare.
   */
  private async cancellaSettimana(dietId: string, dalGiorno: number, alGiorno: number): Promise<void> {
    const dellaSettimana = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId, dayIndex: { gte: dalGiorno, lte: alGiorno } },
      select: { meals: true },
    })) as { meals: unknown }[];
    const orfane = new Set<string>();
    for (const t of dellaSettimana) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) if (m.recipeId) orfane.add(m.recipeId);
    }
    const altre = (await this.prisma.dietDayTemplate.findMany({
      where: { OR: [{ dietId: { not: dietId } }, { dayIndex: { lt: dalGiorno } }, { dayIndex: { gt: alGiorno } }] },
      select: { meals: true },
    })) as { meals: unknown }[];
    for (const t of altre) {
      for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) if (m.recipeId) orfane.delete(m.recipeId);
    }
    // Solo le bozze mai attivate: vedi sopra.
    const cancellabili = orfane.size
      ? ((await this.prisma.recipe.findMany({
          where: { id: { in: [...orfane] }, active: false },
          select: { id: true },
        })) as { id: string }[]).map((r) => r.id)
      : [];
    await this.prisma.$transaction([
      this.prisma.dietDayTemplate.deleteMany({ where: { dietId, dayIndex: { gte: dalGiorno, lte: alGiorno } } }),
      ...(cancellabili.length ? [
        this.prisma.recipeRating.deleteMany({ where: { recipeId: { in: cancellabili } } }),
        this.prisma.menuWeight.deleteMany({ where: { recipeId: { in: cancellabili } } }),
        this.prisma.recipe.deleteMany({ where: { id: { in: cancellabili } } }),
      ] : []),
    ]);
  }

  /**
   * Un pasto per volta: 7 ricette diverse fra loro e diverse da quelle già in catalogo.
   * Una richiesta piccola è molto più affidabile di una grande — è il motivo per cui prima
   * si chiedevano solo 5 ricette per pasto in tutto.
   */
  private async generaRicetteDiUnPasto(p: {
    slot: string;
    quante: number;
    label: string;
    style: string;
    objective: string;
    regime: string;
    regimeRule: string;
    clinicalNotes: string | null;
    kcalPasto: number;
    kcalGiorno: number;
    kcalTol: number;
    protMin: number;
    protMax: number;
    fasting: boolean;
    settimana: number;
    nomiDaEvitare: string[];
  }): Promise<Record<string, unknown>[]> {
    const nomeSlot = NOME_PASTO[p.slot] ?? p.slot;
    // Solo gli ultimi nomi: la lista completa dopo qualche settimana diventa lunghissima e
    // mangia il contesto senza aggiungere niente (i doppioni si fanno con i piatti recenti).
    const evita = p.nomiDaEvitare.slice(-60);
    const system = 'Sei un nutrizionista esperto che prepara BOZZE di catalogo per una piattaforma nutrizionale. Rispondi SOLO con JSON valido e minificato, senza testo attorno: ogni elemento di array/oggetto separato da virgola, nessuna virgola finale. Niente claim medici. kcal e macro realistici e coerenti (le kcal ~ 4·(prot+carbo)+9·grassi).';
    const user =
`Genera ${p.quante} ricette per il pasto "${nomeSlot}" della dieta "${p.label}" (stile ${p.style}, regime ${p.regime}, obiettivo ${p.objective}).
Ognuna ~${p.kcalPasto} kcal (è la quota di questo pasto su una giornata di ~${p.kcalGiorno} kcal, tolleranza ±${p.kcalTol}%); proteine ${p.protMin}-${p.protMax}% delle kcal sulla giornata. Regime: ${p.regimeRule}.${p.fasting ? ' Digiuno intermittente 16:8: pasti solo nella finestra 12:00-20:00.' : ''}${p.clinicalNotes ? ` Regole cliniche da rispettare: ${p.clinicalNotes}` : ''}
Le ${p.quante} ricette devono essere DIVERSE fra loro per ingrediente principale e metodo di cottura: servono a coprire ${p.quante} giorni consecutivi senza che la cliente mangi due volte la stessa cosa.${evita.length ? `\nNON riproporre questi piatti, sono già in catalogo: ${evita.join('; ')}.` : ''}
Formato: {"recipes":[{"slot":"${p.slot}","name":"nome piatto","kcal":<int>,"ingredients":[{"name":"ingrediente","qty":<numero o null>,"unit":"g|ml|pz|q.b."}],"macros":{"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>},"cookingMethods":[{"type":"${CODICI_METODI.join('|')}","steps":["passo 1","passo 2"]}]}]}`;

    // Su output grandi l'AI a volte restituisce JSON malformato (in punti diversi ogni volta):
    // fino a 3 tentativi, poi si rinuncia a QUESTO pasto senza far cadere gli altri.
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      const gen = await this.ai.generateJson<{ recipes?: unknown[] }>(system, user, 8000);
      const ricette = Array.isArray(gen?.recipes) ? (gen!.recipes as Record<string, unknown>[]) : [];
      const buone = ricette.filter((r) => r && typeof r.name === 'string' && r.name.trim());
      if (buone.length > 0) return buone.slice(0, p.quante);
      // Credito esaurito, chiave non valida, modello inesistente: riprovare non cambia niente.
      // Il 12/8 il credito è finito a metà generazione e questo ciclo, moltiplicato per cinque pasti
      // e diciotto varianti, ha sparato 270 chiamate destinate tutte allo stesso 400.
      if (this.ai.lastErrorFatale) break;
    }
    return [];
  }

  /** Gruppi di equivalenza (alimenti intercambiabili): una richiesta breve, solo alla nascita. */
  private async generaGruppiEquivalenza(dietId: string, label: string, regime: string, regimeRule: string): Promise<number> {
    const gen = await this.ai.generateJson<{ equivalenceGroups?: unknown[] }>(
      'Rispondi SOLO con JSON valido e minificato, senza testo attorno.',
      `Per la dieta "${label}" (regime ${regime}: ${regimeRule}) elenca 5-8 gruppi di alimenti intercambiabili fra loro (struttura nutrizionale simile).\nFormato: {"equivalenceGroups":[{"name":"es. Pesci bianchi","items":["branzino","orata","merluzzo"]}]}`,
      2000,
    );
    let grpCount = 0;
    for (const g of (Array.isArray(gen?.equivalenceGroups) ? gen!.equivalenceGroups : []) as Record<string, unknown>[]) {
      const items = Array.isArray(g.items) ? g.items.map((x) => String(x)) : [];
      if (!g.name || items.length < 2) continue;
      await this.prisma.equivalenceGroup.create({
        data: { name: String(g.name).slice(0, 120), productId: dietId, members: { items } as never, status: 'draft', version: 1 } as never,
      });
      grpCount++;
    }
    /**
     * UN avviso, non uno per gruppo (11/8). Qui i gruppi nascono a gruppetti di 5-8 tutti insieme,
     * generati dall'AI alla nascita di una dieta: otto notifiche identiche in tre secondi non sono
     * otto informazioni, sono una notifica e sette motivi per spegnerle. E sono i gruppi che più di
     * tutti hanno bisogno di essere guardati, perché nessuno li ha scritti a mano.
     */
    if (grpCount > 0) {
      await avvisaCapiNutrizionisti(this.prisma, null, {
        type: 'equivalence_group_new',
        title: 'Gruppi di equivalenza da approvare',
        body:
          `Per la dieta «${label}» sono stati generati ${grpCount} gruppi di equivalenza in bozza. ` +
          'Li ha proposti il generatore, non una persona: il motore non li usa finché non li approvi.',
        payload: { kind: 'equivalence_group_new', dietId, quanti: grpCount, origine: 'ai' },
      });
    }
    return grpCount;
  }

  // ---------- Creazione e validazione (wizard) ----------

  private slotsForMeals(n: number, fasting = false): string[] {
    if (fasting) return ['lunch', 'afternoon_snack', 'dinner']; // 16:8, finestra 12-20
    return n <= 3
      ? ['breakfast', 'lunch', 'dinner']
      : n === 4
        ? ['breakfast', 'lunch', 'afternoon_snack', 'dinner']
        : ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  }

  private async dietRecipeIds(dietId: string): Promise<string[]> {
    const templates = (await this.prisma.dietDayTemplate.findMany({ where: { dietId }, select: { meals: true } })) as { meals: unknown }[];
    const ids = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    return [...ids];
  }

  /** Avanzamento automatico della validazione di una dieta bozza. */
  async dietReviewStatus(dietId: string) {
    const diet = (await this.prisma.diet.findUnique({ where: { id: dietId }, include: { dayTemplates: { select: { meals: true } } } })) as
      | { id: string; name: string; status: string; mealsPerDay: number; fasting?: boolean; dayTemplates: { meals: unknown }[] }
      | null;
    if (!diet) throw new NotFoundException('Dieta non trovata.');
    const needed = this.slotsForMeals(diet.mealsPerDay, diet.fasting ?? false);
    const ids = new Set<string>();
    for (const t of diet.dayTemplates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    const recipes = ids.size
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: [...ids] } }, select: { id: true, active: true, allergensReviewed: true } })) as { id: string; active: boolean; allergensReviewed: boolean }[])
      : [];
    const daysComplete = diet.dayTemplates.filter((t) => {
      const meals = (Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[];
      return needed.every((sl) => meals.some((m) => m.slot === sl && !!m.recipeId));
    }).length;
    const groups = (await this.prisma.equivalenceGroup.findMany({ where: { productId: dietId }, select: { status: true } })) as { status: string }[];
    return {
      dietId: diet.id,
      name: diet.name,
      status: diet.status,
      mealsPerDay: diet.mealsPerDay,
      recipes: { total: recipes.length, active: recipes.filter((r) => r.active).length, allergensReviewed: recipes.filter((r) => r.allergensReviewed).length },
      days: { total: diet.dayTemplates.length, complete: daysComplete },
      groups: { total: groups.length, approved: groups.filter((g) => g.status === 'approved').length },
    };
  }

  /** Anteprima delle giornate generate (per il passo di validazione). */
  async dietPreview(dietId: string) {
    const templates = (await this.prisma.dietDayTemplate.findMany({ where: { dietId }, orderBy: { dayIndex: 'asc' }, select: { dayIndex: true, meals: true } })) as { dayIndex: number; meals: unknown }[];
    const ids = new Set<string>();
    for (const t of templates) {
      for (const m of (Array.isArray(t.meals) ? t.meals : []) as { recipeId?: string }[]) {
        if (m.recipeId) ids.add(m.recipeId);
      }
    }
    const recipes = ids.size
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, kcal: true } })) as { id: string; name: string; kcal: number }[])
      : [];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return templates.map((t) => ({
      dayIndex: t.dayIndex,
      meals: ((Array.isArray(t.meals) ? t.meals : []) as { slot?: string; recipeId?: string }[]).map((m) => {
        const r = m.recipeId ? byId.get(m.recipeId) : undefined;
        return { slot: m.slot ?? '', recipe: r?.name ?? '—', kcal: r?.kcal ?? 0 };
      }),
    }));
  }

  /** Attiva tutte le ricette della dieta (fine revisione ricette). */
  async activateDietRecipes(dietId: string, actorId: string) {
    const ids = await this.dietRecipeIds(dietId);
    if (ids.length) await this.prisma.recipe.updateMany({ where: { id: { in: ids } }, data: { active: true } });
    await this.audit.log({ action: 'engine_rule.review.activate_recipes', actorId, entityType: 'diet', entityId: dietId, metadata: { count: ids.length } });
    return this.dietReviewStatus(dietId);
  }

  /** Segna gli allergeni come verificati per tutte le ricette della dieta. */
  async reviewDietAllergens(dietId: string, actorId: string) {
    const ids = await this.dietRecipeIds(dietId);
    if (ids.length) await this.prisma.recipe.updateMany({ where: { id: { in: ids } }, data: { allergensReviewed: true } });
    await this.audit.log({ action: 'engine_rule.review.allergens', actorId, entityType: 'diet', entityId: dietId, metadata: { count: ids.length } });
    return this.dietReviewStatus(dietId);
  }

  /** Conferma (approva) i gruppi di equivalenza collegati alla dieta. */
  async approveDietGroups(dietId: string, actorId: string) {
    await this.prisma.equivalenceGroup.updateMany({ where: { productId: dietId }, data: { status: 'approved' } });
    await this.audit.log({ action: 'engine_rule.review.approve_groups', actorId, entityType: 'diet', entityId: dietId });
    return this.dietReviewStatus(dietId);
  }

  // ---------- Proposte di regole nuove ----------

  listProposals() {
    return this.prisma.ruleProposal.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async createProposal(input: { title?: string; text: string; dietId?: string | null }, actorId: string) {
    if (!input.text?.trim()) throw new BadRequestException('Descrivi la regola che vuoi proporre.');
    const created = await this.prisma.ruleProposal.create({
      data: { title: input.title?.trim() || null, text: input.text.trim(), dietId: input.dietId ?? null, proposedBy: actorId, status: 'pending' } as never,
    });
    await this.audit.log({ action: 'engine_rule.proposal.create', actorId, entityType: 'rule_proposal', entityId: created.id });
    return created;
  }

  async setProposalStatus(id: string, status: 'pending' | 'approved' | 'rejected', actorId: string) {
    const existing = await this.prisma.ruleProposal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proposta non trovata.');
    const updated = await this.prisma.ruleProposal.update({ where: { id }, data: { status } });
    await this.audit.log({ action: 'engine_rule.proposal.status', actorId, entityType: 'rule_proposal', entityId: id, metadata: { status } });
    return updated;
  }

  // ──────────────────────────────────────────── il catalogo che si riempie da solo (17/8) ─

  /**
   * UNA SETTIMANA DI CATALOGO, SCELTA DA SOLA — richiesta della nutrizionista girata da Simone il
   * 17/8: «invece di farlo lei una alla volta col pulsante *genera*, possiamo farli tutti noi fino
   * alla settimana 12, poi lei piano piano le controlla».
   *
   * ⚠️ **Un'unità di lavoro per chiamata**, e non un giro che macina tutto. Un ciclo da cinquecento
   * chiamate all'AI che cade a metà — credito, un 503, la connessione — lascia un lavoro a metà di
   * cui nessuno sa il punto, e rilanciarlo rischia di rifare. Così invece ogni chiamata è piccola,
   * finisce, e la successiva riparte esattamente da dove serve: lo stato è il catalogo stesso.
   *
   * ⚠️ **Non cambia niente per chi valida.** Si passa da `generateCatalogFromPreset`, la stessa
   * funzione del pulsante: le ricette nascono in bozza (`active: false`, allergeni da confermare) e
   * non entrano nei menu di nessuno finché la nutrizionista non le rivede. L'unica cosa che le si
   * toglie è stare lì a premere.
   */
  async generaProssimoCatalogo(actorUserId?: string | null): Promise<Record<string, unknown>> {
    const attore = actorUserId ?? (await this.autoreDiSistema());
    if (!attore) return { fatto: false, motivo: 'nessun capo nutrizionista a cui intestare la generazione' };

    const varianti = await this.varianteDaRiempire();
    const lavoro = prossimaDaGenerare(varianti, SETTIMANE_OBIETTIVO);
    const restano = quantoManca(varianti, SETTIMANE_OBIETTIVO);
    if (!lavoro) return { fatto: false, motivo: 'catalogo completo: dodici settimane piene su tutte le varianti', restano: 0 };

    const esito = await this.generateCatalogFromPreset(
      lavoro.variante.presetId,
      attore,
      lavoro.settimana,
      lavoro.modalita,
    );
    return {
      fatto: true,
      variante: lavoro.variante.etichetta,
      settimana: lavoro.settimana,
      perche: lavoro.motivo,
      // `restano` è contato PRIMA di questo giro: è «quante unità di lavoro c'erano», e serve a
      // stimare quante notti mancano. Dopo questa chiamata ne resta una di meno.
      restanoPrima: restano,
      esito,
    };
  }

  /** Il capo nutrizionista a cui intestare una generazione fatta dal cron: non c'è un umano loggato. */
  private async autoreDiSistema(): Promise<string | null> {
    const capo = (await this.prisma.user.findFirst({
      where: { role: 'head_nutritionist', status: 'active', deletedAt: null } as never,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) as { id: string } | null;
    return capo?.id ?? null;
  }

  /**
   * Lo stato del catalogo, variante per variante, nella forma che il modulo puro sa ordinare.
   *
   * ⚠️ Le settimane si contano in due modi perché **il conto delle giornate mente**: una variante
   * con 28 giornate e 19 piatti diversi per pasto risulta «quattro settimane fatte» ed è una
   * variante in cui la stessa colazione torna cinque volte al mese. Serve anche la prima settimana
   * MAGRA — quella che esiste ma non ha sette piatti diversi in ogni pasto — ed è quella che si
   * ripassa per prima, perché la sta mangiando qualcuno adesso.
   */
  private async varianteDaRiempire(): Promise<VarianteDaRiempire[]> {
    const [presets, diete, giornate, profili] = await Promise.all([
      this.prisma.rulePreset.findMany({
        select: { id: true, label: true, style: true, regime: true, objective: true, meals: true },
      }) as Promise<{ id: string; label: string; style: string; regime: string | null; objective: string | null; meals: string | null }[]>,
      this.prisma.diet.findMany({
        select: { id: true, name: true, style: true, regime: true, objective: true, mealsPerDay: true, fasting: true },
      }) as Promise<{ id: string; name: string; style: string | null; regime: string; objective: string | null; mealsPerDay: number; fasting: boolean | null }[]>,
      this.prisma.dietDayTemplate.findMany({
        where: { level: 1 },
        select: { dietId: true, dayIndex: true, meals: true },
      }) as Promise<{ dietId: string; dayIndex: number; meals: unknown }[]>,
      this.prisma.clientProfile.findMany({
        select: { dietFamily: true, dietStyle: true, regime: true, objective: true },
      }) as Promise<{ dietFamily: string | null; dietStyle: string | null; regime: string | null; objective: string | null }[]>,
    ]);

    const chiaveGruppo = (nome: string, stile: string | null, regime: string | null, obiettivo: string | null): string =>
      `${nome}|${stile ?? ''}|${regime ?? ''}|${obiettivo || 'dimagrimento'}`;

    const clientiPerGruppo = new Map<string, number>();
    for (const p of profili) {
      if (!p.dietFamily) continue;
      const k = chiaveGruppo(p.dietFamily, p.dietStyle, p.regime, p.objective);
      clientiPerGruppo.set(k, (clientiPerGruppo.get(k) ?? 0) + 1);
    }

    // Le giornate di ogni dieta, raccolte per settimana e per pasto: da qui escono sia il conto
    // delle settimane sia la prima magra.
    const perDieta = new Map<string, Map<number, Map<string, Set<string>>>>();
    const ultimoGiorno = new Map<string, number>();
    for (const g of giornate) {
      ultimoGiorno.set(g.dietId, Math.max(ultimoGiorno.get(g.dietId) ?? 0, g.dayIndex));
      const settimana = Math.ceil(g.dayIndex / GIORNI_SETTIMANA);
      if (!perDieta.has(g.dietId)) perDieta.set(g.dietId, new Map());
      const perSett = perDieta.get(g.dietId)!;
      if (!perSett.has(settimana)) perSett.set(settimana, new Map());
      const perSlot = perSett.get(settimana)!;
      for (const m of (g.meals as { slot?: string; recipeId?: string }[]) ?? []) {
        if (!m?.slot || !m?.recipeId) continue;
        if (!perSlot.has(m.slot)) perSlot.set(m.slot, new Set());
        perSlot.get(m.slot)!.add(m.recipeId);
      }
    }

    const out: VarianteDaRiempire[] = [];
    for (const p of presets) {
      const meals = (['3', '5', 'fasting'] as const).includes((p.meals ?? '') as never) ? (p.meals as StrutturaPasti) : '5';
      const fasting = meals === 'fasting';
      const mealsPerDay = fasting ? 3 : meals === '5' ? 5 : 3;
      const regime = ['omnivore', 'vegetarian', 'vegan'].includes(p.regime ?? '') ? (p.regime as string) : 'omnivore';
      const objective = p.objective ?? 'dimagrimento';
      const dieta = diete.find(
        (d) =>
          d.name === p.label &&
          d.style === p.style &&
          d.regime === regime &&
          (d.objective ?? 'dimagrimento') === objective &&
          d.mealsPerDay === mealsPerDay &&
          !!d.fasting === fasting,
      );

      const settimaneFatte = dieta ? Math.ceil((ultimoGiorno.get(dieta.id) ?? 0) / GIORNI_SETTIMANA) : 0;
      let primaSettimanaMagra: number | null = null;
      if (dieta) {
        const perSett = perDieta.get(dieta.id);
        const attesi = slotAttesi(mealsPerDay, fasting);
        for (let w = 1; w <= settimaneFatte; w++) {
          const perSlot = perSett?.get(w);
          const magra = !perSlot || attesi.some((s) => (perSlot.get(s)?.size ?? 0) < GIORNI_SETTIMANA);
          if (magra) { primaSettimanaMagra = w; break; }
        }
      }

      out.push({
        presetId: p.id,
        etichetta: `${p.label} · ${regime} · ${objective} · ${meals === 'fasting' ? 'digiuno' : `${meals} pasti`}`,
        gruppo: chiaveGruppo(p.label, p.style, regime, objective),
        struttura: meals,
        settimaneFatte,
        primaSettimanaMagra,
        clientiGruppo: clientiPerGruppo.get(chiaveGruppo(p.label, p.style, regime, objective)) ?? 0,
      });
    }
    return out;
  }

}
