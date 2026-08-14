/**
 * LE CALORIE SCRITTE A MANO DAL NUTRIZIONISTA — dove si inseriscono nel calcolo, e in che ordine.
 *
 * Fin qui il target calorico della giornata usciva tutto da una formula: Mifflin per il metabolismo
 * basale, per il fattore di attività, meno un deficit dedotto dal ritmo dell'obiettivo (o il 15% di
 * default), con tetti e un pavimento di sicurezza. Nessun posto in cui il nutrizionista potesse
 * dire «per questa cliente no».
 *
 * Ma il fabbisogno stimato è una **stima**: la formula non sa che quella cliente ha una tiroide che
 * ha fatto storia, che dichiara un'attività che non fa, o che a 1600 kcal si è fermata per tre
 * settimane. Chi lo sa è chi la segue. Da qui le due leve, decise da Simone l'11/8:
 *
 * 1. **il deficit imposto** (kcal/giorno) — sostituisce quello dedotto dal ritmo dell'obiettivo.
 *    È la leva clinica vera: il deficit è la cosa che si prescrive. Resta agganciato al fabbisogno,
 *    quindi se la cliente cala di peso il TDEE scende e le calorie scendono con lui, da sole;
 * 2. **la correzione percentuale** sul totale — un ritocco fine, dopo il deficit. Serve quando il
 *    ragionamento è giusto ma il risultato, sulla persona vera, è un po' alto o un po' basso.
 *
 * ## L'ORDINE, che è tutto
 *
 *     TDEE  −  deficit (imposto ▸ altrimenti calcolato, con i tetti)  =  target
 *     target  ×  (1 + correzione%)                                    =  target corretto
 *     e infine il pavimento di sicurezza
 *
 * La correzione va **dopo** il deficit e **prima** del pavimento. Se andasse prima del deficit
 * sarebbe una seconda percentuale sul fabbisogno e i due numeri si moltiplicherebbero fra loro
 * senza che nessuno se ne accorga; se andasse dopo il pavimento potrebbe scendere sotto la soglia
 * di sicurezza per strada e nessuno lo saprebbe, perché il pavimento avrebbe già dato il suo ok.
 *
 * ## I TETTI E IL PAVIMENTO, e chi li può scavalcare
 *
 * I tetti (max 30% del fabbisogno, max 1000 kcal) esistono per proteggere dal calcolo, non dal
 * nutrizionista: si applicano al deficit **calcolato**, non a quello scritto a mano. Se il motore
 * deduce dal ritmo dell'obiettivo un deficit di 1400 kcal/giorno, quello è un obiettivo irreale
 * scritto in fase di onboarding, e va tagliato. Se lo scrive un clinico, l'ha scritto un clinico.
 *
 * Il pavimento funziona allo stesso modo, e qui la decisione di Simone è esplicita: **il
 * nutrizionista lo può scavalcare, ma resta scritto**. Quindi:
 * - senza nessun valore a mano → il pavimento **alza** il target e basta (`sogliaApplicata`);
 * - con un valore a mano → il risultato **passa com'è** e si accende `sottoSoglia`, che chi chiama
 *   usa per registrare il motivo nello storico e aprire la segnalazione al capo nutrizionista.
 *
 * `sottoSoglia` non è un errore: è una cosa da dire a qualcuno. La differenza fra le due è tutta
 * qui, ed è la ragione per cui questo modulo restituisce un esito descritto invece di un numero.
 *
 * Modulo **puro**: nessun accesso al database, così la regola si prova per tabella.
 */

/**
 * Sotto questo valore non è una scelta clinica, è un errore di battitura (un `50` al posto di un
 * `500`, uno zero di troppo nella correzione). Non è la soglia di sicurezza — quella è
 * `kcal_need_floor_*` e il nutrizionista la può scavalcare di proposito. Questo è il limite oltre
 * il quale il numero **non vuol dire niente**, e nessuno lo scavalca perché nessuno lo intende.
 */
export const LIMITE_ASSOLUTO_KCAL = 500;

export interface IngressoCalcoloKcal {
  /** Fabbisogno di mantenimento (Mifflin × fattore di attività). */
  tdee: number;
  /** Il deficit dedotto dal motore: dal ritmo dell'obiettivo, o la percentuale di default. */
  deficitCalcolato: number;
  /** Scritto dal nutrizionista, kcal/giorno. `null` = si usa quello calcolato. */
  deficitImposto?: number | null;
  /** Scritta dal nutrizionista: −10 significa «togli il 10%». `null` o 0 = nessuna correzione. */
  correzionePct?: number | null;
  /** Pavimento di sicurezza per sesso (`kcal_need_floor_female` / `_male`). */
  soglia: number;
  /** Tetto del deficit **calcolato**, in frazione del fabbisogno (0.3 = 30%). */
  tettoDeficitPct: number;
  /** Tetto del deficit **calcolato**, in kcal/giorno assolute. */
  tettoDeficitKcal: number;
}

export interface EsitoCalcoloKcal {
  /** Le kcal/giorno da dare al generatore, arrotondate a 10. */
  target: number;
  /** Il deficit davvero applicato. */
  deficit: number;
  /** Da dove viene: scritto a mano, dedotto dal motore, o nessuno (mantenimento). */
  fonteDeficit: 'imposto' | 'calcolato' | 'nessuno';
  /** La correzione applicata, 0 se non impostata. */
  correzionePct: number;
  /** Il tetto ha tagliato il deficit calcolato. */
  tettoApplicato: boolean;
  /** Il pavimento ha ALZATO il target (succede solo senza valori a mano). */
  sogliaApplicata: boolean;
  /** C'è un valore a mano e il risultato sta SOTTO il pavimento: va detto a qualcuno. */
  sottoSoglia: boolean;
  /** Il limite anti-refuso ha alzato il target: qualcuno ha scritto un numero che non sta in piedi. */
  limiteAssolutoApplicato: boolean;
}

/** Vero se per questa cliente c'è almeno un valore scritto a mano dal nutrizionista. */
export function haCorrezioniAMano(deficitImposto?: number | null, correzionePct?: number | null): boolean {
  return (deficitImposto != null && deficitImposto > 0) || (correzionePct != null && correzionePct !== 0);
}

/**
 * Il target calorico del giorno, con le correzioni del nutrizionista al loro posto.
 *
 * `deficitCalcolato` arriva **senza tetti**: i tetti li mette questa funzione, perché è qui che si
 * sa se il deficit è dedotto o prescritto — e sul prescritto non vanno messi.
 */
export function calcolaTargetKcal(input: IngressoCalcoloKcal): EsitoCalcoloKcal {
  const correzionePct = input.correzionePct ?? 0;
  const imposto = input.deficitImposto != null && input.deficitImposto > 0 ? input.deficitImposto : null;
  const aMano = haCorrezioniAMano(input.deficitImposto, input.correzionePct);

  let deficit: number;
  let fonteDeficit: EsitoCalcoloKcal['fonteDeficit'];
  let tettoApplicato = false;

  if (imposto != null) {
    // Prescritto da un clinico: nessun tetto. Se è alto, è alto perché l'ha deciso lui.
    deficit = imposto;
    fonteDeficit = 'imposto';
  } else if (input.deficitCalcolato > 0) {
    const tagliato = Math.min(input.deficitCalcolato, input.tdee * input.tettoDeficitPct, input.tettoDeficitKcal);
    tettoApplicato = tagliato < input.deficitCalcolato;
    deficit = Math.max(0, tagliato);
    fonteDeficit = 'calcolato';
  } else {
    deficit = 0;
    fonteDeficit = 'nessuno';
  }

  // 1) il deficit, 2) la correzione sul totale.
  let target = input.tdee - deficit;
  if (correzionePct !== 0) target = target * (1 + correzionePct / 100);

  // 3) il pavimento: alza da solo se non c'è niente scritto a mano, altrimenti si limita a dirlo.
  let sogliaApplicata = false;
  let sottoSoglia = false;
  if (target < input.soglia) {
    if (aMano) sottoSoglia = true;
    else {
      target = input.soglia;
      sogliaApplicata = true;
    }
  }

  // 4) il limite anti-refuso, che vale per tutti e sempre.
  let limiteAssolutoApplicato = false;
  if (target < LIMITE_ASSOLUTO_KCAL) {
    target = LIMITE_ASSOLUTO_KCAL;
    limiteAssolutoApplicato = true;
  }

  return {
    target: Math.round(target / 10) * 10,
    deficit: Math.round(deficit),
    fonteDeficit,
    correzionePct,
    tettoApplicato,
    sogliaApplicata,
    sottoSoglia,
    limiteAssolutoApplicato,
  };
}

/**
 * La frase che spiega il numero, per la scheda cliente e per lo storico.
 *
 * Un target calorico senza il suo perché è un numero che nessuno può contestare — e le cose che
 * nessuno può contestare, in clinica, sono quelle che restano sbagliate più a lungo.
 */
export interface DurataCorrezione {
  /** Fino a quando vale (compreso). */
  finoAl?: Date | null;
  /** È scritta ma già scaduta: il numero è tornato normale da solo. */
  scaduta?: boolean;
  /** La percentuale come sta scritta in scheda, anche se spenta. */
  pctScritta?: number | null;
}

export function spiegaTargetKcal(e: EsitoCalcoloKcal, tdee: number, durata?: DurataCorrezione): string {
  const parti: string[] = [`fabbisogno ${Math.round(tdee)} kcal`];
  if (e.fonteDeficit === 'imposto') parti.push(`deficit imposto dal nutrizionista ${e.deficit} kcal`);
  else if (e.fonteDeficit === 'calcolato') parti.push(`deficit calcolato ${e.deficit} kcal${e.tettoApplicato ? ' (tagliato dal tetto di sicurezza)' : ''}`);
  else parti.push('nessun deficit (mantenimento)');
  /**
   * ⚠️ La correzione a termine si racconta con la sua data: «togli il 10%» e «togli il 10% fino al
   * 21/8» sono due cose diverse per chi legge la scheda. E quando è scaduta si dice che il numero
   * è tornato normale — un target che cambia da solo senza una frase che lo spiega è un guasto.
   */
  if (e.correzionePct !== 0) {
    const fino = durata?.finoAl ? ` fino al ${durata.finoAl.toISOString().slice(8, 10)}/${durata.finoAl.toISOString().slice(5, 7)}` : '';
    parti.push(`correzione del nutrizionista ${e.correzionePct > 0 ? '+' : ''}${e.correzionePct}%${fino}`);
  } else if (durata?.scaduta && durata.pctScritta) {
    parti.push(
      `la correzione del ${durata.pctScritta > 0 ? '+' : ''}${durata.pctScritta}% è scaduta` +
        `${durata.finoAl ? ` il ${durata.finoAl.toISOString().slice(8, 10)}/${durata.finoAl.toISOString().slice(5, 7)}` : ''}: ` +
        'si è tornati al ritmo normale',
    );
  }
  if (e.sogliaApplicata) parti.push('alzato alla soglia minima di sicurezza');
  if (e.sottoSoglia) parti.push('⚠️ SOTTO la soglia minima di sicurezza, per scelta del nutrizionista');
  if (e.limiteAssolutoApplicato) parti.push(`⚠️ alzato al limite assoluto di ${LIMITE_ASSOLUTO_KCAL} kcal: il valore scritto non sta in piedi`);
  return `${e.target} kcal/giorno — ${parti.join(', ')}.`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * LA CORREZIONE A TERMINE — «riduci le kcal del 10% per 7 giorni e poi riprendi col normale ritmo»
 * (risposta di Nocanty, 13/8; decisione in `progetto/NOTA_Correzione_Kcal_A_Termine.md`).
 *
 * Fin qui la percentuale, una volta scritta, restava per sempre finché qualcuno se ne ricordava — e
 * nessuno se ne ricorda: è il classico dato che agisce e non si vede. La scadenza la fa smettere da
 * sola.
 *
 * ⚠️ **Scade senza cron.** Si guarda qui, al momento del calcolo. Un lavoro notturno che «pulisce»
 * i campi è un lavoro notturno che un giorno pulisce il campo sbagliato, e il valore scritto serve
 * comunque a chi apre la scheda dopo («le avevo tolto il 10% fino al 21»): si spegne, non si
 * cancella.
 *
 * ⚠️ **Si confronta per GIORNO.** Con un confronto per istante un menu generato alle 23:50
 * dell'ultimo giorno si comporterebbe diversamente da uno generato alle 8:00 dello stesso giorno —
 * e la differenza finirebbe nel piatto di una persona senza che nessuno sappia perché.
 */
export function correzioneAttiva(
  correzionePct: number | null | undefined,
  scadenza: Date | null | undefined,
  oggi: Date = new Date(),
): number {
  const pct = typeof correzionePct === 'number' && Number.isFinite(correzionePct) ? correzionePct : 0;
  if (!pct) return 0;
  // Nessuna scadenza = «vale finché non la tolgo»: è il comportamento di prima, e non cambia.
  if (!scadenza) return pct;
  return giorno(oggi) <= giorno(scadenza) ? pct : 0;
}

/** La data ridotta al suo giorno (UTC), che è l'unità in cui si ragiona sui menu. */
function giorno(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * L'ultimo giorno coperto da «per N giorni», a partire da oggi (compreso).
 *
 * «Per 7 giorni» vuol dire oggi e i sei successivi: dal settimo giorno dopo si riprende col ritmo
 * normale. ⚠️ Zero o meno non è una durata: si torna `null` invece di scrivere una scadenza già
 * passata, che spegnerebbe la correzione nello stesso istante in cui qualcuno la sta scrivendo.
 */
export function scadenzaDaGiorni(giorni: number, oggi: Date = new Date()): Date | null {
  if (!Number.isFinite(giorni) || giorni < 1) return null;
  const fine = new Date(giorno(oggi));
  fine.setUTCDate(fine.getUTCDate() + Math.floor(giorni) - 1);
  return fine;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * «RIFAI CON PIÙ PROTEINE» — la quota proteica minima di UNA cliente (14/8, decisione A di Simone).
 *
 * La banda esisteva già, ma solo per DIETA (`menu_daycombo_protein_min`, pagina Regole motore):
 * «più proteine a Giulia» non aveva dove scriversi. Ora la sua vince su quella della dieta.
 *
 * ⚠️ Vince **solo sul minimo**: il massimo resta della dieta. Alzare il pavimento non deve spostare
 * il soffitto — sono due decisioni diverse, e legarle vorrebbe dire che chi ne prende una prende
 * anche l'altra senza saperlo.
 *
 * ⚠️ E vale anche se è più BASSA di quella della dieta: il campo esiste per contare più della
 * regola generale, in tutte e due le direzioni. Chi lo scrive è chi la segue.
 */
export function quotaProteicaMinima(
  suaFrazione: number | null | undefined,
  minimoDellaDieta: number,
): number {
  const v = typeof suaFrazione === 'number' && Number.isFinite(suaFrazione) ? suaFrazione : null;
  // Fuori dalla scala 0–1 è un errore di battitura (un 30 al posto di 0,30), non una scelta:
  // si ignora e si torna alla dieta, che è il ripiego che non sbaglia.
  if (v === null || v < 0 || v > 1) return minimoDellaDieta;
  return v;
}

/** Quanto sale il minimo quando «più proteine» arriva senza un numero (decisione di Simone). */
export const SCATTO_PIU_PROTEINE = 0.10;

/** ⚠️ Oltre questo non è più una giornata bilanciata: è un integratore con un contorno. */
export const MASSIMO_QUOTA_PROTEICA = 0.60;

/**
 * «Più proteine» senza un numero: +10 punti sul minimo che ha adesso, col tetto di sicurezza.
 * Resta comunque dettabile («portala al 35%»), che è la strada da preferire quando lei lo dice.
 */
export function minimoDaPiuProteine(minimoAttuale: number): number {
  return Math.min(MASSIMO_QUOTA_PROTEICA, Math.round((minimoAttuale + SCATTO_PIU_PROTEINE) * 100) / 100);
}
