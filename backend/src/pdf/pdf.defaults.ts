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

const MONTHLY_REPORT_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body><div class="doc">
  <div class="brand">Metabole</div>
  <div class="sub">Report mensile · {{period}}</div>
  <hr class="rule"/>
  <p style="font-size:14px">Ciao <b>{{name}}</b>, ecco il tuo riepilogo di <b>{{period}}</b>.</p>
  <div class="cards">
    <div class="card"><div class="lab">Perso questo mese</div><div class="val">{{lostThisMonth}}</div></div>
    <div class="card"><div class="lab">Perso dall'inizio</div><div class="val">{{lostTotal}}</div></div>
    <div class="card"><div class="lab">Peso attuale</div><div class="val">{{currentWeight}}</div></div>
    <div class="card"><div class="lab">Obiettivo</div><div class="val">{{target}}</div></div>
    <div class="card"><div class="lab">Check-in</div><div class="val">{{checkins}}</div></div>
    <div class="card"><div class="lab">Pesate</div><div class="val">{{measurements}}</div></div>
  </div>
  <p style="font-size:13px; margin-top:16px">{{trend}}</p>
  <div class="foot">Documento generato automaticamente da Metabole.</div>
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
