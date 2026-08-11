/**
 * QUANDO L'ALLARME «CALO TROPPO RAPIDO» È ARMATO — e quando il nutrizionista l'ha messo in pausa.
 *
 * Nasce dalla decisione di Simone dell'11/8 (§15.2 punto 3): «Autorizza a proseguire» **azzera il
 * punto di partenza del calcolo**. Parole sue: «dal momento in cui dà il suo ok il calcolo deve
 * ripartire da quel momento».
 *
 * ## Cosa si azzera, e cosa NON si azzera
 *
 * Si azzera **il calcolo dell'allarme**. Non i progressi della cliente: grafico, chili persi e
 * proiezione continuano a leggere tutta la sua storia, perché quella è la sua storia e non c'entra
 * niente con una decisione clinica presa su di lei. Se azzerassimo anche quelli, un'autorizzazione
 * del nutrizionista le cancellerebbe dallo schermo i chili persi — il contrario di quello che serve
 * a chi sta perdendo peso troppo in fretta e ha bisogno di vedere che il percorso ha un senso.
 *
 * ## Il pavimento, e perché senza sarebbe una finta
 *
 * Se ci si limitasse a «conta solo dalle pesate successive», due pesate ravvicinate basterebbero a
 * ricostruire una pendenza enorme: la retta su due punti vicini è ripidissima per costruzione, e
 * l'allarme risuonerebbe **il giorno dopo l'ok**. Il nutrizionista avrebbe premuto un pulsante che
 * non fa niente, e la volta dopo non lo premerebbe.
 *
 * Quindi servono due condizioni insieme, decise da Simone: **almeno 4 giorni** dall'autorizzazione
 * **e almeno 3 pesate nuove**. Sono un pavimento, non una tregua a tempo: passati i quattro giorni
 * l'allarme non torna «comunque», torna **se il ritmo calcolato sulle pesate nuove lo merita**.
 *
 * I due numeri sono configurabili (`rapid_loss_resume_min_days`, `rapid_loss_resume_min_measures`)
 * perché sono clinici: li deve poter cambiare Nocanty dai Parametri, non noi con un deploy.
 *
 * Modulo **puro**: nessuna dipendenza: si verifica con una tabella di date, che è l'unico modo
 * onesto di collaudare una regola che parla di tempo.
 */

/** Una pesata, ridotta a quello che serve qui. */
export interface PesataDatata {
  date: Date;
  value: number;
}

export interface EsitoAllarme {
  /** Vero se l'allarme può suonare: il calcolo va fatto su `pesate`. */
  armato: boolean;
  /** Le pesate su cui calcolare il ritmo: tutte, o solo quelle dopo l'autorizzazione. */
  pesate: PesataDatata[];
  /**
   * Perché è spento, quando lo è. Serve alle diagnostiche e al backoffice: «non suona» senza dire
   * perché è indistinguibile da «non c'è niente che non va», ed è il modo in cui un guardrail
   * spento passa inosservato per settimane.
   */
  motivo: 'nessun_baseline' | 'attesa_giorni' | 'attesa_pesate' | null;
  /** Quanti giorni e quante pesate mancano al ri-armo (0 quando è armato). */
  giorniMancanti: number;
  pesateMancanti: number;
}

export const MIN_GIORNI_DEFAULT = 4;
export const MIN_PESATE_DEFAULT = 3;

const GIORNO = 86_400_000;

/**
 * Decide se l'allarme è armato e su quali pesate si calcola.
 *
 * `baseline` è `ClientProfile.rapidLossBaselineAt`: null (il caso di quasi tutte) → tutto come
 * prima, si guardano tutte le pesate ricevute.
 *
 * Il confronto sulle pesate è **stretto** (`> baseline`): la pesata del giorno stesso in cui il
 * nutrizionista autorizza è quella che ha fatto scattare l'allarme, non una prova che le cose
 * vadano meglio. Tenerla dentro significherebbe ripartire proprio dal punto che si voleva lasciare
 * indietro.
 */
export function statoAllarmeCalo(
  pesate: PesataDatata[],
  baseline: Date | null | undefined,
  adesso: Date = new Date(),
  minGiorni: number = MIN_GIORNI_DEFAULT,
  minPesate: number = MIN_PESATE_DEFAULT,
): EsitoAllarme {
  if (!baseline) {
    return { armato: true, pesate, motivo: 'nessun_baseline', giorniMancanti: 0, pesateMancanti: 0 };
  }

  const nuove = pesate.filter((p) => p.date.getTime() > baseline.getTime());
  const giorniPassati = Math.floor((adesso.getTime() - baseline.getTime()) / GIORNO);
  const giorniMancanti = Math.max(0, minGiorni - giorniPassati);
  const pesateMancanti = Math.max(0, minPesate - nuove.length);

  if (giorniMancanti > 0) {
    return { armato: false, pesate: nuove, motivo: 'attesa_giorni', giorniMancanti, pesateMancanti };
  }
  if (pesateMancanti > 0) {
    return { armato: false, pesate: nuove, motivo: 'attesa_pesate', giorniMancanti: 0, pesateMancanti };
  }
  return { armato: true, pesate: nuove, motivo: null, giorniMancanti: 0, pesateMancanti: 0 };
}

/**
 * Frase per il backoffice e per `diag:cliente`, così chi guarda sa **perché** non sta suonando.
 * Restituisce null quando l'allarme è armato: lì non c'è niente da spiegare.
 */
export function spiegaAllarmeSpento(e: EsitoAllarme): string | null {
  if (e.armato) return null;
  if (e.motivo === 'attesa_giorni') {
    const g = e.giorniMancanti;
    const p = e.pesateMancanti;
    return `Calcolo del calo ripartito dall'autorizzazione: l'allarme può tornare fra ${g} giorn${g === 1 ? 'o' : 'i'}${p > 0 ? ` e dopo altre ${p} pesate` : ''}.`;
  }
  if (e.motivo === 'attesa_pesate') {
    const p = e.pesateMancanti;
    return `Calcolo del calo ripartito dall'autorizzazione: servono ancora ${p} pesat${p === 1 ? 'a' : 'e'} prima che l'allarme possa tornare.`;
  }
  return null;
}
