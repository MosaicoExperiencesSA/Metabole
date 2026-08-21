/**
 * COSA È CAMBIATO, in una riga di log — la parte che rende utile un log delle modifiche.
 *
 * Richiesta di Simone del 10/8, guardando il log di una cliente: «va specificato anche cosa ha
 * modificato in piccolo, altrimenti non serve a nulla — e la stessa cosa vale per le modifiche
 * fatte da admin, coach o nutrizionista». Aveva ragione: le righe dicevano «Modifica dati (dal
 * cliente)» e sotto «Modificato dal cliente», cioè due volte la stessa informazione e mai quella
 * che serve. La domanda vera è sempre «chi ha cambiato QUEL numero di telefono, e quando».
 *
 * Sta in un file condiviso perché i posti che mostrano queste righe sono **due** — il log della
 * scheda cliente e quello del lead — e finora ognuno rendeva il proprio pezzo a modo suo: nel lead
 * i campi si vedevano, in scheda cliente no. Due copie della stessa cosa divergono sempre, e qui
 * la divergenza era già avvenuta.
 *
 * ## I tre modi in cui il backend scrive «cosa è cambiato»
 *
 * Non uno, tre — sono nati in momenti diversi e non si possono unificare a ritroso senza riscrivere
 * gli audit già registrati, che sono la storia e non si tocca:
 *  1. `campi: [{ campo, prima, dopo }]` — la forma buona (`campiCambiati` lato server);
 *  2. `before: {…}, after: {…}` — due oggetti da confrontare (cambio tipo di dieta, data inizio);
 *  3. `before: valore, after: valore` — due scalari (i pasti del digiuno).
 * `righeModifica` le riconosce tutte e tre e restituisce sempre la stessa cosa.
 */

export interface RigaModifica {
  campo: string;
  etichetta: string;
  prima: string;
  dopo: string;
}

/** Etichette italiane dei campi. Allineata a `ETICHETTA_CAMPO` del backend. */
export const CAMPO_LABEL: Record<string, string> = {
  name: 'Nome completo', firstName: 'Nome', lastName: 'Cognome', alias: 'Alias',
  nickname: 'Come vuole essere chiamata', email: 'Email', phone: 'Telefono',
  phone2: 'Secondo telefono', valueCents: 'Valore', previousStatus: 'Stato precedente',
  historicalPaidCents: 'Totale già pagato', codiceFiscale: 'Codice fiscale',
  address: 'Indirizzo', addressLine: 'Indirizzo', postalCode: 'CAP', city: 'Città',
  province: 'Provincia', country: 'Paese', birthDate: 'Data di nascita', tags: 'Tag',
  segment: 'Segmento', channel: 'Canale', marketingConsent: 'Consenso marketing',
  consentChannels: 'Canali del consenso',
  // Campi della scheda cliente (modifiche di admin, coach e nutrizioniste).
  age: 'Età', sex: 'Sesso', heightCm: 'Altezza', startWeightKg: 'Peso di partenza',
  startWaistCm: 'Vita di partenza', startHipsCm: 'Fianchi di partenza',
  regime: 'Regime', dietStyle: 'Stile alimentare', dietFamily: 'Dieta assegnata',
  mealsPerDay: 'Pasti al giorno', objective: 'Fase (obiettivo)', pathType: 'Percorso',
  coachStyle: 'Stile coach', character: 'Carattere', intolerances: 'Intolleranze',
  // Le allergie non erano in questo elenco: una loro modifica sarebbe comparsa nel registro col
  // nome tecnico del campo, cioè illeggibile — su un dato sanitario, proprio dove serve leggerlo.
  allergies: 'Allergie', allergiesOther: 'Allergie da codificare',
  intolerancesOther: 'Intolleranze scritte a mano',
  allergieDichiarateIl: 'Allergie dichiarate il',
  dislikedFoods: 'Cibi non graditi',
  /**
   * ⛔ **LE SETTE COLONNE DELL'OROLOGIO** (21/8). `fastingWindow` c'era già; le altre sei no, e si
   * vedevano: uscendo dal digiuno si azzerano **tutte e sette insieme**, e la coach leggeva sei
   * righe come `fastingSceltoIl: 2026-08-21T09:12:33.000Z → — vuoto —`. Un log pieno di nomi di
   * colonne è un log che si smette di leggere, proprio nel momento in cui spiega perché una cliente
   * si è ritrovata senza fasce.
   *
   * ⚠️ `fastingWindow` si chiama ancora «Pasti che salta» perché è quello che **è**: il dato che il
   * motore usa per saltarli. Che non si scelga più non cambia cosa fa.
   */
  fastingWindow: 'Pasti che salta',
  fastingProtocol: 'Digiuno: protocollo', fastingStartMin: 'Digiuno: apertura (minuti)',
  fastingTargetStartMin: 'Digiuno: apertura di arrivo', fastingTargetProtocol: 'Digiuno: protocollo di arrivo',
  fastingSceltoIl: 'Digiuno: finestra scelta il', fastingChangedAt: 'Digiuno: ultimo spostamento',
  activityLevel: 'Livello di attività', themeColor: 'Colore tema',
  planStartDate: 'Data inizio piano', startDate: 'Inizio', endDate: 'Fine',
  status: 'Stato', locale: 'Lingua', weightKg: 'Peso', waistCm: 'Vita', hipsCm: 'Fianchi',
  thighsCm: 'Cosce', plan: 'Piano', isStoreReviewer: 'Account di revisione store',
};

export const etichettaCampo = (campo: string): string => CAMPO_LABEL[campo] ?? campo;

/** Il valore come lo legge una persona. «— vuoto —» e non «null»: lo legge lo staff, non un log. */
export function valoreLeggibile(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '— vuoto —';
  if (typeof v === 'boolean') return v ? 'sì' : 'no';
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(', ') : '— vuoto —';
  if (campo === 'valueCents' || campo === 'historicalPaidCents') {
    return '€ ' + (Number(v) / 100).toFixed(2).replace('.', ',');
  }
  if (campo === 'birthDate' || campo === 'planStartDate' || campo === 'startDate' || campo === 'endDate' || campo === 'date') {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('it-IT');
  }
  if (typeof v === 'object') {
    // Un oggetto dentro un campo non si mostra come JSON: si dicono le chiavi, che è
    // l'informazione utile, e il dettaglio sta nel log tecnico.
    const chiavi = Object.keys(v as Record<string, unknown>);
    return chiavi.length ? chiavi.map(etichettaCampo).join(', ') : '— vuoto —';
  }
  return String(v);
}

/** Chiavi di servizio: non sono campi modificati e non vanno mostrate come tali. */
const DA_IGNORARE = new Set([
  'campi', 'before', 'after', 'origine', 'fields', 'clientId', 'recordId', 'messageId',
  'profileId', 'reason', 'motivo', 'count', 'recordIds', 'coachStaffId', 'da', 'a',
]);

/**
 * Le righe «campo: prima → dopo» di una modifica, da qualunque delle tre forme arrivi il metadata.
 * Vuoto = per quella riga non sappiamo cosa è cambiato, e la UI non deve inventarselo.
 */
export function righeModifica(metadata: Record<string, unknown> | null | undefined): RigaModifica[] {
  const m = metadata ?? {};

  // Forma 1: `campi` — quella scritta da `campiCambiati`.
  const campi = m.campi;
  if (Array.isArray(campi)) {
    return campi
      .filter((c): c is { campo: string; prima: unknown; dopo: unknown } => !!c && typeof (c as { campo?: unknown }).campo === 'string')
      .map((c) => ({
        campo: c.campo,
        etichetta: etichettaCampo(c.campo),
        prima: valoreLeggibile(c.campo, c.prima),
        dopo: valoreLeggibile(c.campo, c.dopo),
      }));
  }

  const before = m.before;
  const after = m.after;
  const oggetti = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

  // Forma 2: due OGGETTI da confrontare. Si mostrano solo le chiavi davvero diverse: un `before`
  // completo accanto a un `after` completo riempirebbe la riga di campi immutati.
  if (oggetti(before) || oggetti(after)) {
    const a = oggetti(before) ? before : {};
    const b = oggetti(after) ? after : {};
    const chiavi = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !DA_IGNORARE.has(k));
    return chiavi
      .filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))
      .map((k) => ({
        campo: k,
        etichetta: etichettaCampo(k),
        prima: valoreLeggibile(k, a[k]),
        dopo: valoreLeggibile(k, b[k]),
      }));
  }

  // Forma 3: due SCALARI (es. i pasti del digiuno). Il nome del campo non è nel metadata: lo
  // fornisce la UI, che sa quale azione sta mostrando.
  if (before !== undefined || after !== undefined) {
    return [{ campo: 'valore', etichetta: 'Valore', prima: valoreLeggibile('valore', before), dopo: valoreLeggibile('valore', after) }];
  }

  return [];
}

/**
 * Il resto del metadata che vale la pena mostrare: il motivo di un rifiuto, la nuova email, la
 * nota di una correzione. Sono le informazioni che non sono «un campo cambiato» ma rispondono
 * comunque alla domanda «cosa è successo».
 */
export function noteModifica(metadata: Record<string, unknown> | null | undefined): string[] {
  const m = metadata ?? {};
  const out: string[] = [];
  const testo = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const motivo = testo(m.reason) ?? testo(m.motivo);
  if (motivo) out.push(`Motivo: ${motivo}`);
  const nuovaEmail = testo(m.newEmail);
  if (nuovaEmail) out.push(`Nuova email: ${nuovaEmail}`);
  const nota = testo(m.nota);
  if (nota) out.push(`Nota: ${nota}`);
  /**
   * ⛔ **LA FRASE CHE LA CLIENTE HA LETTO** (21/8, orologio del digiuno).
   *
   * Gli audit del digiuno non hanno né `campi` né `before`/`after`: portano numeri (`inizioMin: 960`,
   * `protocollo: '16:8'`) e **una frase in chiaro** — la stessa riga che la cliente ha letto sullo
   * schermo prima di confermare lo spostamento. Senza questa riga il log mostrava «dettaglio dei
   * campi non registrato per questa modifica» su una modifica che è registrata benissimo: cioè
   * proprio la bugia che quel messaggio serve a evitare.
   *
   * ⚠️ **Senza prefisso**, a differenza di «Motivo:» e «Nota:». Non è un'annotazione su cosa è
   * successo: *è* cosa è successo, in italiano. «Descrizione: hai spostato…» leggerebbe come un
   * campo di database messo in mezzo a una frase che sta già in piedi da sola.
   */
  const descrizione = testo(m.descrizione);
  if (descrizione) out.push(descrizione);
  if (m.origine === 'app') out.push('Fatta dall\'app');
  return out;
}
