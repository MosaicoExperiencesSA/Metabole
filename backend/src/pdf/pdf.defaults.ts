/**
 * Template HTML predefiniti dei PDF inviati ai clienti.
 * Modificabili da admin (tabella pdf_template); questi sono i valori iniziali
 * usati dal seed e come fallback se la riga manca.
 *
 * Segnaposto disponibili (sostituiti con {{nome}}):
 *  - receipt: number, date, clientName, email, description, method, status, total
 *  - monthly_report: name, period, lostThisMonth, lostTotal, currentWeight,
 *                    target, checkins, measurements, trend
 */

export interface PdfTemplateDefault { key: string; name: string; html: string; placeholders: string[]; }

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a2a27; margin: 0; }
  .doc { padding: 8px 4px; }
  .brand { color: #10403a; font-size: 26px; font-weight: 800; letter-spacing: .3px; }
  .sub { color: #7c8c88; font-size: 12px; margin-top: 2px; }
  .rule { height: 1px; background: #e6e2d8; margin: 18px 0; border: 0; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.kv td { padding: 6px 0; vertical-align: top; }
  table.kv td.k { color: #10403a; font-weight: 700; width: 38%; }
  .total { text-align: right; color: #10403a; font-weight: 800; font-size: 18px; margin-top: 8px; }
  .foot { color: #9aa39f; font-size: 10px; text-align: center; margin-top: 40px; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .card { border: 1px solid #e6e2d8; border-radius: 10px; padding: 10px 14px; min-width: 130px; }
  .card .lab { color: #7c8c88; font-size: 11px; }
  .card .val { font-size: 17px; font-weight: 700; color: #10403a; }
`;

const RECEIPT_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body><div class="doc">
  <div class="brand">Metabole</div>
  <div class="sub">Ricevuta di pagamento</div>
  <hr class="rule"/>
  <table class="kv">
    <tr><td class="k">Numero ricevuta</td><td>{{number}}</td></tr>
    <tr><td class="k">Data</td><td>{{date}}</td></tr>
    <tr><td class="k">Cliente</td><td>{{clientName}}</td></tr>
    <tr><td class="k">Email</td><td>{{email}}</td></tr>
    <tr><td class="k">Descrizione</td><td>{{description}}</td></tr>
    <tr><td class="k">Metodo</td><td>{{method}}</td></tr>
    <tr><td class="k">Stato</td><td>{{status}}</td></tr>
  </table>
  <hr class="rule"/>
  <div class="total">Totale: {{total}}</div>
  <div class="foot">Documento generato automaticamente da Metabole. Non costituisce fattura fiscale.</div>
</div></body></html>`;

const MONTHLY_REPORT_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1F2933; margin: 0; background: #F4F1EA; }
  .page { padding: 26px 28px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { color: #0E7C66; font-size: 22px; font-weight: 800; }
  .brand small { display: block; color: #7c8c88; font-size: 8px; letter-spacing: 2px; font-weight: 700; margin-top: 2px; }
  .head .right { text-align: right; color: #7c8c88; font-size: 10px; line-height: 1.5; }
  .head .right b { color: #1F2933; }
  .kicker { color: #0E7C66; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; margin: 22px 0 4px; }
  h1 { font-size: 22px; line-height: 1.25; margin: 0 0 6px; color: #1F2933; }
  h1 .teal { color: #0E7C66; }
  .lead { color: #5c6a66; font-size: 11px; margin: 0 0 14px; }
  .cards { display: flex; gap: 8px; }
  .stat { flex: 1; background: #EAF4EF; border-radius: 12px; padding: 12px 10px; text-align: center; }
  .stat .num { font-size: 19px; font-weight: 800; color: #0E7C66; }
  .stat .lab { color: #5c6a66; font-size: 9px; font-weight: 700; margin-top: 3px; }
  .stat .sub { color: #8a968f; font-size: 8px; margin-top: 2px; }
  .band { background: #0E7C66; color: #fff; border-radius: 12px; padding: 12px 16px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
  .band .k { font-size: 8px; letter-spacing: 1px; font-weight: 700; opacity: .85; }
  .band .v { font-size: 16px; font-weight: 800; margin-top: 2px; }
  .panel { background: #fff; border: 1px solid #E8E4DA; border-radius: 12px; padding: 14px 16px; margin-top: 12px; }
  .panel .t { font-weight: 800; font-size: 12px; margin-bottom: 5px; }
  .panel .g { display: inline-flex; width: 16px; height: 16px; border-radius: 8px; background: #0E7C66; color: #fff; font-size: 10px; font-weight: 800; align-items: center; justify-content: center; margin-right: 6px; vertical-align: -3px; }
  .panel p { margin: 0; font-size: 11px; line-height: 1.55; color: #3D4C48; }
  .foot { color: #9aa39f; font-size: 8px; line-height: 1.5; margin-top: 26px; border-top: 1px solid #E8E4DA; padding-top: 8px; }
</style></head>
<body><div class="page">
  <div class="head">
    <div class="brand">MetaboleAI<small>C O A C H &nbsp; & &nbsp; N U T R I Z I O N E &nbsp; A I</small></div>
    <div class="right">Report di percorso<br/><b>{{period}}</b></div>
  </div>

  <div class="kicker">IL TUO PUNTO A → PUNTO B</div>
  <h1>{{name}}, ecco la strada<br/><span class="teal">che hai fatto questo mese.</span></h1>
  <p class="lead">Il riepilogo di {{period}} del tuo percorso con la tua coach e con Gaia — e cosa serve ora per arrivare al tuo obiettivo.</p>

  <div class="cards">
    <div class="stat"><div class="num">{{lostThisMonth}}</div><div class="lab">Perso questo mese</div></div>
    <div class="stat"><div class="num">{{lostTotal}}</div><div class="lab">Perso dall'inizio</div></div>
    <div class="stat"><div class="num">{{currentWeight}}</div><div class="lab">Peso attuale</div></div>
    <div class="stat"><div class="num">{{checkins}}</div><div class="lab">Check-in nel mese</div><div class="sub">{{measurements}} pesate</div></div>
  </div>

  <div class="band">
    <div><div class="k">IL TUO OBIETTIVO</div><div class="v">{{target}}</div></div>
    <div style="text-align:right"><div class="k">IL TUO RITMO</div><div class="v" style="font-size:12px">un passo alla volta, insieme</div></div>
  </div>

  <div class="panel">
    <div class="t"><span class="g">G</span>La tua traiettoria</div>
    <p>{{trend}}</p>
  </div>

  <div class="foot">MetaboleAI · Report generato automaticamente per {{name}} — Il calo di peso può variare da persona a persona e includere una quota di liquidi.
  Questo documento non sostituisce un parere medico: per patologie è disponibile la visita con il nutrizionista in app. Il report completo, con misure e dettagli, è sempre nella tua app.</div>
</div></body></html>`;

export const DEFAULT_PDF_TEMPLATES: PdfTemplateDefault[] = [
  { key: 'receipt', name: 'Ricevuta di pagamento', html: RECEIPT_HTML, placeholders: ['number', 'date', 'clientName', 'email', 'description', 'method', 'status', 'total'] },
  { key: 'monthly_report', name: 'Report mensile', html: MONTHLY_REPORT_HTML, placeholders: ['name', 'period', 'lostThisMonth', 'lostTotal', 'currentWeight', 'target', 'checkins', 'measurements', 'trend'] },
];

/** Dati d'esempio per l'anteprima dell'editor. */
export const PDF_PREVIEW_SAMPLE: Record<string, Record<string, string>> = {
  receipt: {
    number: 'RIC-2026-ABCD1234', date: '11/07/2026', clientName: 'Mario Rossi', email: 'mario@example.com',
    description: 'Abbonamento Percorso Metabole 12 mesi', method: 'Carta', status: 'Pagato', total: '€ 797,00',
  },
  monthly_report: {
    name: 'Mario', period: 'giugno 2026', lostThisMonth: '2,4 kg', lostTotal: '7,8 kg',
    currentWeight: '82,2 kg', target: '76,0 kg', checkins: '21', measurements: '8',
    trend: 'Ottimo ritmo: sei in linea con l\'obiettivo. Continua così!',
  },
};

/** Sostituisce {{segnaposto}} con i valori forniti (mancanti → stringa vuota). */
export function fillTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? vars[k] : ''));
}
