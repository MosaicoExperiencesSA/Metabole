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

// Allineato al modello del socio "Diario del Percorso" (marketing/report_cliente/
// MetaboleAI_Diario_Percorso.html, lug 2026): palette verde/menta, hero "il tuo
// mese con Gaia", stat, goalbox, pannello "Gaia consiglia".
const MONTHLY_REPORT_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #122019; margin: 0; background: #f6faf7; }
  .page { padding: 26px 28px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { color: #0d5a3e; font-size: 22px; font-weight: 800; }
  .brand small { display: block; color: #5b6b63; font-size: 8px; letter-spacing: 2px; font-weight: 700; margin-top: 2px; }
  .head .right { text-align: right; color: #5b6b63; font-size: 10px; line-height: 1.5; }
  .head .right b { color: #0d5a3e; }
  .kicker { color: #2fb27a; font-size: 9px; font-weight: 800; letter-spacing: 2px; margin: 22px 0 4px; text-transform: uppercase; }
  h1 { font-size: 23px; line-height: 1.2; margin: 0 0 6px; color: #122019; letter-spacing: -.3px; }
  h1 .teal { color: #137a55; }
  .lead { color: #5b6b63; font-size: 11px; margin: 0 0 14px; line-height: 1.5; }
  .cards { display: flex; gap: 8px; }
  .stat { flex: 1; background: #fff; border: 1px solid #e4ebe6; border-radius: 12px; padding: 12px 10px; text-align: center; }
  .stat .num { font-size: 20px; font-weight: 800; color: #137a55; letter-spacing: -.5px; }
  .stat .lab { color: #5b6b63; font-size: 9px; font-weight: 700; margin-top: 3px; }
  .stat .sub { color: #93a29a; font-size: 8px; margin-top: 2px; }
  .stat .delta { display: inline-block; margin-top: 5px; font-size: 8px; font-weight: 700; color: #0d5a3e; background: #d9efe4; padding: 2px 7px; border-radius: 20px; }
  .band { background: linear-gradient(135deg, #0d5a3e, #137a55); color: #fff; border-radius: 14px; padding: 13px 17px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
  .band .k { font-size: 8px; letter-spacing: 1px; font-weight: 700; opacity: .85; text-transform: uppercase; }
  .band .v { font-size: 16px; font-weight: 800; margin-top: 2px; }
  .panel { background: #fff; border: 1px solid #e4ebe6; border-radius: 14px; margin-top: 12px; overflow: hidden; }
  .panel .hd { background: #eaf6f0; padding: 9px 15px; font-weight: 800; font-size: 12px; color: #0d5a3e; }
  .panel .hd .g { display: inline-flex; width: 17px; height: 17px; border-radius: 9px; background: #137a55; color: #fff; font-size: 10px; font-weight: 800; align-items: center; justify-content: center; margin-right: 7px; vertical-align: -3px; }
  .panel p { margin: 0; padding: 11px 15px 4px; font-size: 11px; line-height: 1.55; color: #122019; }
  .panel .habit { padding: 7px 15px 9px; font-size: 10.5px; color: #122019; border-top: 1px solid #eef4f0; }
  .panel .habit b { color: #0d5a3e; }
  .panel .habit .hic { margin-right: 5px; }
  .foot { color: #93a29a; font-size: 8px; line-height: 1.5; margin-top: 26px; border-top: 1px solid #e4ebe6; padding-top: 8px; }
</style></head>
<body><div class="page">
  <div class="head">
    <div class="brand">MetaboleAI<small>C O A C H &nbsp; & &nbsp; N U T R I Z I O N E &nbsp; A I</small></div>
    <div class="right">Il tuo diario del percorso<br/><b>{{period}}</b></div>
  </div>

  <div class="kicker">Il tuo mese con Gaia</div>
  <h1>{{name}}, un altro mese,<br/><span class="teal">un altro passo verso l'obiettivo.</span></h1>
  <p class="lead">Ecco com'è andato {{period}}: i risultati che il corpo ha portato e cosa serve ora per rendere il prossimo mese ancora migliore.</p>

  <div class="cards">
    <div class="stat"><div class="num">{{lostThisMonth}}</div><div class="lab">Peso</div><div class="delta">&#9660; questo mese</div></div>
    <div class="stat"><div class="num">{{lostTotal}}</div><div class="lab">Dall'inizio</div><div class="delta">&#9660; totale</div></div>
    <div class="stat"><div class="num">{{currentWeight}}</div><div class="lab">Peso attuale</div></div>
    <div class="stat"><div class="num">{{checkins}}</div><div class="lab">Check-in nel mese</div><div class="sub">{{measurements}} pesate</div></div>
  </div>

  <div class="band">
    <div><div class="k">Il tuo obiettivo</div><div class="v">{{target}}</div></div>
    <div style="text-align:right"><div class="k">Il tuo ritmo</div><div class="v" style="font-size:12px">un passo alla volta, insieme</div></div>
  </div>

  <div class="panel">
    <div class="hd"><span class="g">G</span>Gaia consiglia</div>
    <p>{{trend}}</p>
    <div class="habit"><span class="hic">&#128167;</span><b>Acqua</b> — media <b>{{waterAvg}}</b> al giorno · obiettivo {{waterGoal}}{{waterBars}}</div>
    <div class="habit"><span class="hic">&#128095;</span><b>Passi</b> — media <b>{{stepsAvg}}</b> al giorno · obiettivo {{stepsGoal}}{{stepsBars}}</div>
  </div>

  <div class="foot">MetaboleAI · Diario del percorso generato automaticamente per {{name}} — I risultati variano da persona a persona; il calo può includere una quota di liquidi.
  Questo documento non sostituisce un parere medico: per patologie è disponibile la visita con il nutrizionista in app. Il diario completo, con timeline e tappe, è sempre nella tua app.</div>
</div></body></html>`;

export const DEFAULT_PDF_TEMPLATES: PdfTemplateDefault[] = [
  { key: 'receipt', name: 'Ricevuta di pagamento', html: RECEIPT_HTML, placeholders: ['number', 'date', 'clientName', 'email', 'description', 'method', 'status', 'total'] },
  { key: 'monthly_report', name: 'Report mensile', html: MONTHLY_REPORT_HTML, placeholders: ['name', 'period', 'lostThisMonth', 'lostTotal', 'currentWeight', 'target', 'checkins', 'measurements', 'trend', 'waterAvg', 'waterGoal', 'waterBars', 'stepsAvg', 'stepsGoal', 'stepsBars'] },
];

/** Mini-grafico a barre d'esempio per l'anteprima (stessa resa di reports.service.barsHtml). */
function sampleBars(values: number[], goal: number, color: string): string {
  const H = 34;
  const max = Math.max(...values, goal, 0.1);
  const bars = values
    .map((v) => `<i style="flex:1;max-width:9px;height:${Math.max(2, Math.round((v / max) * H))}px;border-radius:2px;background:${color};opacity:${v >= goal ? '1' : '.35'}"></i>`)
    .join('');
  const goalLine = `<span style="position:absolute;left:0;right:0;top:${Math.max(0, Math.round(H - (goal / max) * H))}px;border-top:1.2px dashed #d9482f;opacity:.7"></span>`;
  return `<div style="position:relative;display:flex;align-items:flex-end;gap:2px;height:${H}px;margin:4px 0 2px">${goalLine}${bars}</div>`;
}

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
    waterAvg: '1,6 L', waterGoal: '2,5 L',
    waterBars: sampleBars([1.5, 2, 1.25, 2.5, 1.75, 2.5, 1.5, 2.25, 2.5, 1.75, 2, 2.5, 1.5, 2.5], 2.5, '#3a6ea5'),
    stepsAvg: '6.100', stepsGoal: '8.000',
    stepsBars: sampleBars([5400, 7200, 4800, 8300, 6100, 9200, 5100, 7800, 8600, 6400, 5900, 8100, 7000, 8900], 8000, '#137a55'),
  },
};

/** Sostituisce {{segnaposto}} con i valori forniti (mancanti → stringa vuota). */
export function fillTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (k in vars ? vars[k] : ''));
}
