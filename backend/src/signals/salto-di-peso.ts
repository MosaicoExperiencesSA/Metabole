/**
 * ⛔ **IL SALTO IMPROVVISO DI PESO — la seconda metà della regola di Lucia (5/9).**
 *
 * La nutrizionista responsabile, scheda 7 punto 5: *«Allarme su ritmo calo > 1.5 kg/settimana per
 * 2+ settimane consecutive **O salto improvviso > 4 kg**»*. La prima metà c'era già — è il
 * guardrail del calo rapido (`max_weight_change_alert_kg_week`, default 1,5, su una finestra di
 * quattordici giorni). Questa è la seconda, che mancava.
 *
 * ## ⛔ Perché serviva, e qual è il caso vero
 *
 * La voce `pesate-lontane-buco-del-ritmo` lo diceva con un esempio: una cliente sospende, sta ferma
 * venticinque giorni senza pesarsi, torna e ha perso venti chili. Il ritmo implicito è 5,6
 * kg/settimana — **sotto** le soglie del guardrail dei dati sporchi (10 kg **e** 7 kg/settimana
 * insieme), quindi non suonava niente. Un salto guardato **per quello che è** — la differenza fra
 * due pesate consecutive — quel caso lo prende.
 *
 * ## ⚠️ Tre cose che questa regola NON è
 *
 * · **Non è il guardrail dei dati sporchi** (`peso-incoerente.ts`, 10 kg + 7 kg/settimana): quello
 *   decide se **fidarsi** del numero per calcolare il fabbisogno, e sbagliare lì significa sporcare
 *   le calorie nel piatto. Questo decide se **avvisare una persona**, e sbagliare costa un avviso in
 *   più. Due domande diverse, due soglie diverse: metterle insieme vorrebbe dire azzerare il
 *   fabbisogno di chiunque cali quattro chili, cioè di un percorso riuscito.
 * · **Non guarda gli aumenti.** La decisione parla di *calo*, e un aumento di quattro chili ha già
 *   il suo avviso (`weight_gain`). ⚠️ Un salto in **su** di quattro chili fra due pesate resta però
 *   sospetto come dato: lo prende il guardrail dei dati sporchi quando supera le sue soglie.
 * · **Non è un ritmo.** Fra le due pesate possono esserci tre giorni o due mesi: è il **salto** che
 *   Lucia ha chiesto di guardare, ed è esattamente ciò che rende visibile il caso del rientro.
 */

export interface PesataPerSalto {
  date: Date;
  weightKg: number;
}

/** La soglia decisa da Lucia il 5/9. Il valore vero arriva da `config_param`. */
export const SALTO_ALLARME_KG_DEFAULT = 4;

export interface SaltoDiPeso {
  da: Date;
  a: Date;
  /** Chili persi fra le due pesate, sempre positivo. */
  persi: number;
  giorni: number;
}

/**
 * ⛔ **Il calo più grosso fra due pesate CONSECUTIVE**, sopra la soglia. `null` quando non c'è
 * niente da dire, che è il caso normale.
 *
 * ⚠️ Le pesate si riordinano qui dentro invece di pretenderle ordinate: chi chiama le legge da
 * query diverse (`desc` per il fabbisogno, `asc` per gli alert), e un ordinamento sbagliato non
 * darebbe un errore — darebbe salti col segno rovesciato, cioè un allarme che suona a caso.
 */
export function saltoDiPeso(
  pesate: readonly PesataPerSalto[],
  sogliaKg: number = SALTO_ALLARME_KG_DEFAULT,
): SaltoDiPeso | null {
  const buone = (pesate ?? [])
    .filter((p) => p && p.date instanceof Date && Number.isFinite(p.date.getTime()) && Number.isFinite(p.weightKg))
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  let peggiore: SaltoDiPeso | null = null;
  for (let i = 1; i < buone.length; i += 1) {
    const prima = buone[i - 1];
    const dopo = buone[i];
    const persi = Math.round((prima.weightKg - dopo.weightKg) * 10) / 10;
    if (persi <= sogliaKg) continue; // ⚠️ «> 4», non «≥ 4»: la soglia è scritta così.
    const giorni = Math.max(1, Math.round((dopo.date.getTime() - prima.date.getTime()) / 86_400_000));
    if (!peggiore || persi > peggiore.persi) peggiore = { da: prima.date, a: dopo.date, persi, giorni };
  }
  return peggiore;
}

/**
 * La frase per la coach e per la nutrizionista. ⚠️ Dice **le due date e i chili**, non «salto
 * anomalo»: chi legge deve poter decidere senza aprire nient'altro — e vedere da sé se è una
 * pesata sbagliata o una persona da chiamare.
 */
export const spiegaSaltoDiPeso = (s: SaltoDiPeso, giornoItaliano: (d: Date) => string): string =>
  `Salto di peso: −${s.persi} kg fra il ${giornoItaliano(s.da)} e il ${giornoItaliano(s.a)} `
  + `(${s.giorni} ${s.giorni === 1 ? 'giorno' : 'giorni'}). O una delle due pesate è sbagliata, oppure è successo `
  + 'qualcosa da guardare.';
