/**
 * Bonifica dei dati importati (email/telefono sporchi da Mosaico) sui record CRM.
 *
 * SICUREZZA:
 * - DRY-RUN di default: stampa solo cosa CAMBIEREBBE, senza scrivere. Scrive solo con `--apply`.
 * - Tocca SOLO i casi "sicuri" (deterministici). I casi ambigui (dominio troncato, caratteri
 *   extra, telefoni di lunghezza anomala) NON vengono toccati: restano da rivedere a mano.
 *
 * Casi trattati:
 *   EMAIL  - deleted_<email>_deleted        -> <email>            (contatti eliminati in Mosaico, ripristino l'indirizzo)
 *          - email con ; , o spazi FINALI    -> ripulita
 *          - x@dominio.tld@dominio.tld        -> x@dominio.tld     (dominio duplicato identico)
 *   PHONE  - 20 cifre (due numeri appiccicati)-> primo 10 in phone, secondo 10 in phone2
 *
 * Uso (dalla Shell di Render sul backend, dove c'è DATABASE_URL):
 *   npm run bonifica:crm            # DRY-RUN: mostra cosa cambierebbe
 *   npm run bonifica:crm -- --apply # APPLICA davvero
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const validEmail = (e: string): boolean =>
  /^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(e) &&
  (e.match(/@/g) || []).length === 1 &&
  !e.includes('..');

/** Ritorna l'email pulita se il caso è SICURO, altrimenti null (da rivedere a mano). */
function fixEmail(raw: string): { value: string; pattern: string } | null {
  const e = raw.trim();
  const low = e.toLowerCase();
  if (validEmail(e)) return null; // già buona
  // 1) deleted_..._deleted
  if (low.startsWith('deleted_') && low.endsWith('_deleted')) {
    const inner = e.slice('deleted_'.length, e.length - '_deleted'.length);
    return validEmail(inner) ? { value: inner, pattern: 'deleted_wrapper' } : null;
  }
  // 2) separatori/spazi finali
  const t = e.replace(/[;,\s]+$/g, '');
  if (t !== e && validEmail(t)) return { value: t, pattern: 'separatore_finale' };
  // 3) dominio duplicato identico  x@d.tld@d.tld
  const m = e.match(/^(.+@([^@]+))@([^@]+)$/);
  if (m && m[2].toLowerCase() === m[3].toLowerCase() && validEmail(m[1])) {
    return { value: m[1], pattern: 'dominio_duplicato' };
  }
  return null;
}

/** Ritorna {phone, phone2} se il telefono sono DUE numeri (20 cifre), altrimenti null. */
function fixPhone(raw: string): { phone: string; phone2: string; pattern: string } | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('39') && d.length === 12) d = d.slice(2); // prefisso +39
  if (d.length === 20) return { phone: d.slice(0, 10), phone2: d.slice(10), pattern: 'due_numeri_20' };
  return null;
}

async function main() {
  console.log(APPLY ? '>>> MODALITÀ APPLICA (scrivo sul database) <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply per applicare <<<');

  const records = (await prisma.crmRecord.findMany({
    select: { id: true, email: true, phone: true, phone2: true },
  })) as { id: string; email: string | null; phone: string | null; phone2: string | null }[];
  console.log(`Record CRM totali: ${records.length}`);

  const emailByPattern: Record<string, number> = {};
  const phoneByPattern: Record<string, number> = {};
  let emailChanged = 0, phoneChanged = 0, dupWarnings = 0;
  const sampleE: string[] = [], sampleP: string[] = [];

  // set di email già "buone" esistenti, per segnalare duplicati creati dal ripristino
  const existingEmails = new Set(
    records.filter((r) => r.email && validEmail(r.email)).map((r) => (r.email as string).toLowerCase()),
  );

  for (const r of records) {
    const data: { email?: string; phone?: string; phone2?: string } = {};

    if (r.email) {
      const fx = fixEmail(r.email);
      if (fx) {
        emailByPattern[fx.pattern] = (emailByPattern[fx.pattern] ?? 0) + 1;
        if (existingEmails.has(fx.value.toLowerCase())) dupWarnings++;
        data.email = fx.value;
        emailChanged++;
        if (sampleE.length < 8) sampleE.push(`  «${r.email}» -> «${fx.value}» [${fx.pattern}]`);
      }
    }
    // telefono: solo se phone2 è vuoto (non sovrascrivo un secondo numero già presente)
    if (r.phone && !r.phone2) {
      const fp = fixPhone(r.phone);
      if (fp) {
        phoneByPattern[fp.pattern] = (phoneByPattern[fp.pattern] ?? 0) + 1;
        data.phone = fp.phone;
        data.phone2 = fp.phone2;
        phoneChanged++;
        if (sampleP.length < 8) sampleP.push(`  «${r.phone}» -> «${fp.phone}» + «${fp.phone2}»`);
      }
    }

    if (APPLY && Object.keys(data).length > 0) {
      await prisma.crmRecord.update({ where: { id: r.id }, data });
    }
  }

  console.log(`\nEMAIL da correggere: ${emailChanged}`, emailByPattern);
  sampleE.forEach((s) => console.log(s));
  if (dupWarnings > 0) console.log(`  ⚠ ${dupWarnings} email ripristinate coincidono con un contatto già esistente (possibile doppione — controllabile a mano).`);
  console.log(`\nTELEFONI da dividere in due numeri: ${phoneChanged}`, phoneByPattern);
  sampleP.forEach((s) => console.log(s));

  console.log(APPLY
    ? `\n✔ APPLICATO: ${emailChanged} email + ${phoneChanged} telefoni aggiornati.`
    : `\n(nessuna scrittura). Per applicare: npm run bonifica:crm -- --apply`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
