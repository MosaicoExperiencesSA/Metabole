/**
 * TUTTO QUELLO CHE CAMBIA SULLE SUE CLIENTI — la fusione, senza banca dati.
 *
 * Decisione di Simone del 12/8: il registro sotto la chat non mostra solo quello che ha fatto
 * l'assistente, ma **tutto quello che è cambiato**. Perché sulle sue clienti scrivono in tanti — lei
 * dettando, Gaia concordando un cambio in chat, la cliente stessa che esclude un alimento dall'app,
 * il motore che sostituisce — e il pezzo che oggi le manca non è «cosa ho fatto io»: è «cosa è
 * cambiato».
 *
 * ## ⚠️ Non è una tabella nuova, ed è la ragione per cui questo file è una funzione
 *
 * Le fonti esistono già tutte: `AzioneVera` (l'assistente), `AuditLog` (le modifiche di profilo, con
 * i **valori** cambiati da quando l'ha chiesto Simone il 10/8 — «altrimenti non serve a nulla»), e
 * `FoodSwap` (le sostituzioni concordate). Scrivere una quarta tabella che le copia vorrebbe dire
 * tenerla allineata per sempre, e il giorno in cui si disallinea nessuno se ne accorge: un registro
 * sbagliato non produce nessun errore.
 *
 * Qui si **legge e si fonde**. Costa qualche query in più a ogni apertura di pagina, e in cambio non
 * esiste nessun modo di raccontare una storia diversa da quella vera.
 */

/** Da dove viene la modifica. È la colonna che risponde a «chi è stato». */
export type OrigineVoce = 'assistente' | 'gaia' | 'cliente' | 'staff' | 'motore';

export interface VoceRegistro {
  id: string;
  fonte: 'azione_vera' | 'audit' | 'food_swap';
  quando: Date;
  origine: OrigineVoce;
  /** Cosa è successo, in italiano e già leggibile. */
  cosa: string;
  clienteId: string | null;
  suChi: string | null;
  dettaglio: unknown;
  /** Solo per le righe dell'assistente: sono le uniche che si possono annullare da qui. */
  annullabile: boolean;
  stato?: string;
}

export interface RigaAzioneVera {
  id: string;
  createdAt: Date;
  azione: string;
  soggettoId: string | null;
  soggettoNome: string | null;
  frase: string;
  stato: string;
  dettaglio: unknown;
}

export interface RigaAudit {
  id: string;
  createdAt: Date;
  action: string;
  entityId: string | null;
  metadata: unknown;
}

export interface RigaFoodSwap {
  id: string;
  ultimaVoltaIl: Date;
  clientId: string;
  fromFood: string;
  toFood: string;
  origine: string;
  stato: string;
  dishName: string | null;
}

/** Le azioni di audit che raccontano un cambiamento sulla cliente. Il resto è rumore. */
const AUDIT_INTERESSANTI = new Set([
  'profile.update',
  'client.update',
  'chat.data_inizio.spostata',
  'client.diet_type.change',
  'client.plan_held',
  'client.plan_released',
]);

const ETICHETTA_AZIONE: Record<string, string> = {
  restrizione_cliente: 'Restrizione dettata all’assistente',
  sostituzione_cliente: 'Sostituzione dettata all’assistente',
  variante_cliente: 'Variante di piano',
  ricetta_modificata: 'Ricetta modificata',
  ricetta_nuova: 'Ricetta nuova',
  regola_dieta: 'Regola su un tipo di dieta',
  pasti_cliente: 'Spuntini della cliente',
  voce_dizionario: 'Parola nuova nel dizionario',
};

const ORIGINE_SWAP: Record<string, OrigineVoce> = {
  chat: 'gaia',
  app: 'cliente',
  manuale: 'staff',
  nutrizionista: 'staff',
};

/**
 * ⚠️ Chi ha cambiato il profilo si legge dal metadata, non dal ruolo di chi ha agito.
 *
 * `profile.update` lo scrive **la cliente dall'app** (`origine: 'app'`), `client.update` lo scrive
 * lo staff dalla scheda. Confonderli vorrebbe dire attribuire alla nutrizionista una cosa che ha
 * fatto la cliente — e quella colonna esiste proprio per non doverlo indovinare.
 */
function origineAudit(action: string, metadata: unknown): OrigineVoce {
  if (action === 'profile.update') {
    return ((metadata as { origine?: string } | null)?.origine ?? 'app') === 'app' ? 'cliente' : 'staff';
  }
  if (action === 'chat.data_inizio.spostata') {
    return ((metadata as { origine?: string } | null)?.origine ?? 'chat') === 'chat' ? 'gaia' : 'cliente';
  }
  return 'staff';
}

/** I campi cambiati, scritti in modo che si capiscano leggendo la riga e basta. */
function raccontaAudit(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as { campi?: { campo?: string; da?: unknown; a?: unknown }[] | string[]; prima?: unknown; dopo?: unknown };
  if (action === 'chat.data_inizio.spostata') return `Data di inizio spostata da ${m.prima ?? '?'} a ${m.dopo ?? '?'}`;

  const campi = Array.isArray(m.campi) ? m.campi : [];
  if (!campi.length) return action === 'profile.update' ? 'Ha modificato i suoi dati' : 'Scheda cliente modificata';
  const nomi = campi
    .map((c) => (typeof c === 'string' ? c : c?.campo))
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
  return `${action === 'profile.update' ? 'Modifica dall’app' : 'Modifica dalla scheda'}: ${nomi}`;
}

/**
 * Fonde le tre fonti in un elenco solo, dal più recente.
 *
 * `nomePerCliente` serve perché due delle tre fonti hanno l'id e non il nome: senza, metà delle
 * righe direbbe «su un id», che è il modo di rendere illeggibile proprio la colonna che si guarda.
 */
export function unisciRegistro(
  azioni: RigaAzioneVera[],
  audit: RigaAudit[],
  swap: RigaFoodSwap[],
  nomePerCliente: Map<string, string>,
  limite = 200,
): VoceRegistro[] {
  const voci: VoceRegistro[] = [];

  for (const a of azioni) {
    voci.push({
      id: a.id,
      fonte: 'azione_vera',
      quando: a.createdAt,
      origine: 'assistente',
      cosa: `${ETICHETTA_AZIONE[a.azione] ?? a.azione}: «${a.frase}»`,
      clienteId: a.soggettoId,
      suChi: a.soggettoNome ?? (a.soggettoId ? nomePerCliente.get(a.soggettoId) ?? null : null),
      dettaglio: a.dettaglio,
      // ⚠️ Solo le righe dell'assistente si annullano da qui. Annullare da questa pagina una
      // modifica fatta dalla cliente sul suo profilo vorrebbe dire disfare una cosa che lei ha
      // deciso, da una schermata che non è la sua.
      annullabile: a.stato === 'attiva',
      stato: a.stato,
    });
  }

  for (const r of audit) {
    if (!AUDIT_INTERESSANTI.has(r.action)) continue;
    voci.push({
      id: r.id,
      fonte: 'audit',
      quando: r.createdAt,
      origine: origineAudit(r.action, r.metadata),
      cosa: raccontaAudit(r.action, r.metadata),
      clienteId: r.entityId,
      suChi: r.entityId ? nomePerCliente.get(r.entityId) ?? null : null,
      dettaglio: r.metadata,
      annullabile: false,
    });
  }

  for (const s of swap) {
    voci.push({
      id: s.id,
      fonte: 'food_swap',
      quando: s.ultimaVoltaIl,
      origine: ORIGINE_SWAP[s.origine] ?? 'staff',
      cosa: `Sostituzione: «${s.fromFood}» → «${s.toFood}»${s.dishName ? ` su ${s.dishName}` : ''}`,
      clienteId: s.clientId,
      suChi: nomePerCliente.get(s.clientId) ?? null,
      dettaglio: { origine: s.origine, stato: s.stato },
      annullabile: false,
      stato: s.stato,
    });
  }

  return voci.sort((a, b) => b.quando.getTime() - a.quando.getTime()).slice(0, limite);
}
