/**
 * Fix una-tantum dei TESTI email live: sostituisce il riferimento fisso a "colazione" con la
 * variabile {{primoPasto}} nei modelli `onb_g1` e `piano_domani` (così chi fa digiuno non si sente
 * dire "parti dalla colazione"). Il seed aggiorna solo il nome dei modelli, non il corpo: questo
 * script tocca il bodyHtml nel DB. Idempotente (se già corretto non ricambia).
 *
 *   npm run fix:email-primopasto            # DRY-RUN: mostra cosa cambierebbe
 *   npm run fix:email-primopasto -- --apply # APPLICA
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Sostituzioni per chiave: [testo vecchio esatto, testo nuovo con {{primoPasto}}]
const REPLACEMENTS: Record<string, [string, string][]> = {
  onb_g1: [[
    'Un consiglio: parti dalla colazione e prenditela con calma.',
    'Un consiglio: comincia dal tuo primo pasto ({{primoPasto}}) e prenditela con calma.',
  ]],
  piano_domani: [[
    'Un consiglio: prepara stasera ciò che ti serve per la colazione. Iniziare bene la mattina fa la differenza.',
    'Un consiglio: prepara ciò che ti serve per il tuo primo pasto ({{primoPasto}}). Cominciare bene fa la differenza.',
  ]],
};

async function main() {
  console.log(APPLY ? '>>> APPLICA (scrivo) <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply <<<');
  let changed = 0;
  for (const [key, subs] of Object.entries(REPLACEMENTS)) {
    const tpl = (await prisma.emailTemplate.findUnique({ where: { key }, select: { bodyHtml: true } })) as { bodyHtml: string } | null;
    if (!tpl) { console.log(`  · ${key}: modello non trovato, salto`); continue; }
    let body = tpl.bodyHtml;
    let touched = false;
    for (const [from, to] of subs) {
      if (body.includes(to)) { console.log(`  · ${key}: già aggiornato`); continue; }
      if (body.includes(from)) { body = body.split(from).join(to); touched = true; }
      else console.log(`  ⚠ ${key}: testo originale non trovato (forse modificato a mano) — controllare a mano`);
    }
    if (touched) {
      changed++;
      console.log(`  ✎ ${key}: "colazione" → "{{primoPasto}}"`);
      if (APPLY) await prisma.emailTemplate.update({ where: { key }, data: { bodyHtml: body } });
    }
  }
  console.log(APPLY ? `\n✔ Modelli aggiornati: ${changed}` : `\nDa aggiornare: ${changed}. Per applicare: npm run fix:email-primopasto -- --apply`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
