import { Injectable } from '@nestjs/common';

export interface GiudiceResult {
  pass: boolean;
  issues: string[];
}

/**
 * Giudice (gate di compliance) — regole prese dal catalogo del socio
 * (marketing/vignette/catalogo_vignette.json → compliance.regole):
 *  - no prima/dopo;
 *  - no numeri/tempi/misure/garanzie nei contenuti;
 *  - no seconda persona su attributi fisici;
 *  - (18+ è un requisito di targeting/audience, non del testo → controllo a parte).
 * Euristica volutamente prudente: in dubbio segnala, così un umano decide.
 */
@Injectable()
export class GiudiceService {
  check(input: { caption: string; hashtags?: string[] }): GiudiceResult {
    const issues: string[] = [];
    const text = `${input.caption ?? ''} ${(input.hashtags ?? []).join(' ')}`.toLowerCase();

    // 1) prima/dopo
    if (/(prima\s*(?:e|\/|-)\s*dopo|before\s*[/&-]?\s*after)/i.test(text)) {
      issues.push('Riferimento "prima/dopo" non ammesso.');
    }

    // 2) numeri con misure/percentuali/calorie
    if (/\b\d+(?:[.,]\d+)?\s*(?:kg|kili|chil[oi]|cm|centimetri|taglia|taglie|%|percento|kcal|calorie)\b/i.test(text)) {
      issues.push('Numeri/misure/percentuali nei contenuti non ammessi.');
    }

    // 3) promesse a tempo ("in/entro N giorni/settimane/mesi")
    if (/\b(?:in|entro)\s*\d+\s*(?:giorn|settiman|mes|ann)/i.test(text)) {
      issues.push('Promesse a tempo (in N giorni/settimane) non ammesse.');
    }

    // 4) garanzie di risultato
    if (/(garant|risultati\s+garantiti|assicur\w*\s+risultat)/i.test(text)) {
      issues.push('Garanzie di risultato non ammesse.');
    }

    // 5) seconda persona su attributi fisici
    if (
      /\b(?:il|i|la|le)\s+tuo\w*\s+(?:peso|chil[oi]|kili|panci\w*|grass\w*|corpo|difett\w*|taglia)\b/i.test(text) ||
      /\bnel\s+vestito\b/i.test(text)
    ) {
      issues.push('Riferimenti in seconda persona ad attributi fisici non ammessi.');
    }

    return { pass: issues.length === 0, issues };
  }
}
