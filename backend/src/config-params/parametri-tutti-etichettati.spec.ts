import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * OGNI PARAMETRO DEL MOTORE HA UN'ETICHETTA IN ITALIANO.
 *
 * ⛔ **Il difetto che questa sentinella chiude, ed è ricorrente.** Un parametro nuovo nasce nel
 * backend (`configParams.getNumber('menu_qualcosa', 5)`) e funziona subito, col suo default. In
 * questa pagina però compare **in fondo, sotto «Altro», con la chiave grezza** — `menu_qualcosa` —
 * e senza una riga che spieghi cosa fa. Chi lo trova fra sei mesi non sa se toccarlo, e chi lo
 * tocca non sa cosa sta cambiando.
 *
 * ⚠️ L'1/9 erano **sei** insieme: i due dei panieri, i due dell'agente, i due dell'allargamento
 * della banda kcal. Nessuno se n'era accorto perché la pagina non è rotta — è solo muta.
 *
 * ⛔ Questa prova legge i sorgenti del **backend**: è voluto. La domanda «esistono parametri che il
 * motore legge e che qui non hanno un nome?» non si può fare guardando solo il front end, ed è
 * esattamente la domanda che nessuno si era fatto.
 */

const RADICE_BACKEND = join(__dirname, '..');
const PAGINA = join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'Parametri.tsx');

/** Le chiamate che leggono un parametro di configurazione, in tutte e quattro le forme. */
const LETTURA = /\bget(?:String|Number|Bool|Boolean|Json)\(\s*'([a-z0-9_]+)'/g;

function tuttiIFile(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) out.push(...tuttiIFile(pieno));
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
  }
  return out;
}

/**
 * ⚠️ Chiavi che il motore legge ma che in questa pagina **non devono** comparire, con la ragione.
 * Un'eccezione senza ragione è un'eccezione che fra un anno nessuno sa se togliere.
 */
const FUORI_PAGINA = new Set<string>([
  // Non è un parametro del motore: è l'elenco dei regimi, che ha una pagina sua (Impostazioni).
  'diet_regimes',
]);

/**
 * ⛔ **IL DEBITO, DICHIARATO — 90 parametri il 1/9/2026.**
 *
 * La prima stesura di questa prova falliva su novanta chiavi in una volta. ⚠️ Un guardiano che
 * grida su novanta cose è un guardiano che si impara a zittire: è la lezione già scritta in
 * `una-porta-per-le-esclusioni.spec.ts`, e vale qui uguale. Correggerle tutte insieme non è
 * nemmeno la cosa giusta — scrivere novanta etichette in italiano di fila vuol dire scriverne
 * ottanta a caso, e un'etichetta sbagliata è peggio della chiave grezza: quella almeno non mente.
 *
 * Quindi il debito si **congela**: quello che c'era resta, e la prova fallisce solo se ne compare
 * uno **nuovo**. La lista si accorcia quando qualcuno, passando di lì per un altro motivo, dà un
 * nome a un parametro che conosce — e la seconda prova qui sotto obbliga a toglierlo da questa
 * lista quando succede, così non marcisce.
 *
 * ⚠️ Chi aggiunge una riga qui invece di un'etichetta sta aumentando il debito: si fa solo se il
 * parametro è davvero temporaneo, e in quel caso la ragione va scritta accanto.
 */
const SENZA_NOME_OGGI = new Set<string>([
  'agent_comfort_max_days',
  'agent_plateau_pesate',
  'agent_post_event_days',
  'agent_pre_event_days',
  'agent_reentry_days',
  'agent_return_days',
  'alert_event_incoming_days',
  'alert_inactive_days',
  'alert_low_ratings_count',
  'alert_water_low_days',
  'alert_weight_gain_days',
  'cambi_soglia_giorni',
  'catalogo_taglia_dal_fabbisogno',
  'chat_chiusura_silenzio_ore',
  'cycle_cm_delta',
  'cycle_default_rating',
  'cycle_weight_delta_kg',
  'digiuno_passo_graduale_min',
  'escalation_reopen_days',
  'expiring_plan_days',
  'fasting_protocol_change_days',
  'kcal_need_default_deficit_pct',
  'kcal_need_deficit_max_kcal',
  'kcal_need_deficit_max_pct',
  'kcal_need_floor_female',
  'kcal_need_floor_male',
  'kcal_need_kcal_per_kg',
  'lead_accept_days',
  'lead_credentials_link_days',
  'learning_distinctive_weighting',
  'learning_distinctiveness_alpha',
  'low_adherence_days',
  'maintenance_regain_kg',
  'measures_ask_repeat_days',
  'measures_lock_after_hours',
  'measures_nudge_end_hour',
  'measures_nudge_hours',
  'measures_nudge_start_hour',
  'measures_unlock_hours',
  'menu_daycombo_enabled',
  'menu_daycombo_protein_max',
  'menu_daycombo_protein_min',
  'menu_kcal_balance_tolerance_pct',
  'menu_kcal_need_enabled',
  'menu_maintenance_w_eff',
  'menu_penalty_repeat',
  'menu_penalty_season',
  'menu_pre_event_protein_bonus',
  'menu_repeat_two_days_default',
  'menu_repeat_window_days',
  'menu_select_w_eff',
  'menu_select_w_grad',
  'menu_simple_recipes_enabled',
  'menu_state_boost',
  'menu_variety_min_gap_days',
  'menu_visible_days_before_return',
  'monitoring_duration_days',
  'monitoring_measure_ask_days',
  'monitoring_regain_kg',
  'monitoring_rientro_days',
  'no_progress_escalation',
  'path_ended_days',
  'pause_watch_ask_days',
  'pause_watch_regain_kg',
  'payment_pending_auto_cancel_days',
  'personal_base_min_recipes_per_slot',
  'plan_start_change_lock_hours',
  'porzione_tetto_colazione',
  'porzione_tetto_pasto_principale',
  'porzione_tetto_spuntino',
  'rapid_loss_reopen_worsening_kg',
  'rapid_loss_resume_min_days',
  'rapid_loss_resume_min_measures',
  'referral_card_after_days',
  'referral_reward_days',
  'repeat_twin_kcal_tolerance_pct',
  'site_stats_years',
  'stats_clients_base',
  'stats_reached_base',
  'supervision_reminder_days',
  'travel_max_days',
  'trial_offer_code_hours',
  'trial_offer_discount_type',
  'trial_offer_discount_value',
  'trial_offer_target_1m',
  'trial_offer_target_3m',
  'trial_plan_id',
  'vera_seconda_lettura',
  'weight_jump_impossible_kg',
  'weight_jump_impossible_kg_week',
]);

describe('i parametri del motore hanno tutti un nome leggibile', () => {
  it('⛔ nessun parametro finisce in pagina con la chiave grezza', () => {
    if (!existsSync(PAGINA)) {
      // Il backend si può costruire da solo (è così che gira su Render): senza il back office
      // accanto la domanda non si può fare, e fingere che sia passata sarebbe peggio del silenzio.
      // eslint-disable-next-line no-console
      console.warn('Parametri.tsx non trovato accanto: la prova delle etichette non è stata fatta.');
      return;
    }

    const lette = new Set<string>();
    for (const f of tuttiIFile(RADICE_BACKEND)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(LETTURA)) lette.add(m[1]);
    }
    expect(lette.size).toBeGreaterThan(10); // se fosse zero, la regex non sta più trovando niente

    const pagina = readFileSync(PAGINA, 'utf8');
    const meta = pagina.slice(pagina.indexOf('const META'), pagina.indexOf('const GROUP_ORDER'));

    const senzaNome = [...lette]
      .filter((k) => !FUORI_PAGINA.has(k))
      .filter((k) => !new RegExp(`\\b${k}\\s*:\\s*\\{`).test(meta))
      .sort();

    // Solo i NUOVI: il debito di partenza è dichiarato in `SENZA_NOME_OGGI`, e non cresce.
    expect(senzaNome.filter((k) => !SENZA_NOME_OGGI.has(k))).toEqual([]);
  });

  /**
   * ⚠️ La lista del debito non deve marcire. Il giorno che qualcuno dà un nome a uno di quei
   * parametri, la riga qui va tolta — altrimenti fra un anno la lista dice che mancano novanta
   * etichette e ne mancano dieci, e nessuno si fida più del numero.
   */
  it('⚠️ e la lista del debito si accorcia: chi ha già un nome non ci resta', () => {
    if (!existsSync(PAGINA)) return;
    const pagina = readFileSync(PAGINA, 'utf8');
    const meta = pagina.slice(pagina.indexOf('const META'), pagina.indexOf('const GROUP_ORDER'));
    const giaNominati = [...SENZA_NOME_OGGI].filter((k) => new RegExp(`\\b${k}\\s*:\\s*\\{`).test(meta)).sort();
    expect(giaNominati).toEqual([]);
  });

  /**
   * ⚠️ Un gruppo che non sta in `GROUP_ORDER` non sparisce — quel difetto è stato corretto l'11/8 —
   * ma finisce in coda, dopo tutti gli altri e prima di «Altro». Per un gruppo nuovo è quasi sempre
   * un dimenticato, non una scelta.
   */
  it('⚠️ ogni gruppo usato ha un posto dichiarato nell\'ordine', () => {
    const pagina = readFileSync(PAGINA, 'utf8');
    const meta = pagina.slice(pagina.indexOf('const META'), pagina.indexOf('const GROUP_ORDER'));
    const gruppi = new Set([...meta.matchAll(/group:\s*'([^']+)'/g)].map((m) => m[1]));

    const riga = pagina.slice(pagina.indexOf('const GROUP_ORDER'));
    const ordine = new Set([...riga.slice(0, riga.indexOf(';')).matchAll(/'([^']+)'/g)].map((m) => m[1]));

    expect([...gruppi].filter((g) => !ordine.has(g)).sort()).toEqual([]);
  });
});
