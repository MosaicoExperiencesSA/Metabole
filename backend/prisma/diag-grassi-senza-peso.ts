/**
 * ⛔ **QUALI GRASSI DEL CATALOGO NON HANNO ANCORA UN PESO** — la lista da dare a Nocanty.
 *
 * Il 24/8 lui ha firmato la tabella dei grammi equivalenti (fonte CREA / USDA, riferimento olio EVO
 * = 100) e da lì Gaia converte le quantità invece di cambiarle a pari grammatura. La tabella però
 * ha **dieci righe**, e il ricettario ne nomina di più: ogni alimento che sembra un grasso e non ha
 * un peso è un cambio che Gaia **non fa** e che finisce sul tavolo della nutrizionista.
 *
 * ⚠️ **È la parte giusta in cui sbagliare, ma va misurata**: senza questo conto nessuno sa se le
 * righe mancanti sono tre o trecento, e «passa la mano» diventa «passa sempre la mano», cioè il
 * lavoro non fatto. Qui si contano le ricette, così si sa **quali righe valgono la pena** — non si
 * chiede a un capo nutrizionista di scrivere sessanta numeri quando ne servono cinque.
 *
 * ⛔ **Questo file NON inventa numeri.** Dice solo quali nomi restano fuori e quanto pesano nel
 * catalogo; il grammo lo scrive lui dal back office, sul gruppo «Oli e grassi da condimento».
 *
 * ⚠️ Sola lettura, non tocca niente. `npm run diag:grassi`.
 */
import { PrismaClient } from '@prisma/client';
import { GRUPPO_GRASSI, leggiFattori, pesoDi, sembraUnGrasso } from '../src/menu/grassi-equivalenti';

type Riga = { nome: string; ricette: number; esempi: string[] };

async function main() {
  const prisma = new PrismaClient();
  try {
    const gruppo = (await prisma.equivalenceGroup.findFirst({
      where: { name: GRUPPO_GRASSI, status: 'approved' } as never,
      orderBy: { createdAt: 'asc' },
      select: { members: true },
    })) as { members: unknown } | null;
    const fattori = gruppo ? leggiFattori(gruppo.members) : null;

    if (!fattori) {
      console.log(
        `\n⛔ Il gruppo «${GRUPPO_GRASSI}» approvato non c'è, o non porta pesi.\n` +
          '   Finché è così Gaia NON converte niente e passa la mano su ogni grasso.\n' +
          '   Gira il seed (`npm run seed`) o riapprova il gruppo dal back office.\n',
      );
    } else {
      console.log(`\nTabella: ${Object.keys(fattori.pesi).length} pesi, riferimento «${fattori.riferimento}»${fattori.fonte ? ` (${fattori.fonte})` : ''}.`);
    }

    const ricette = (await prisma.recipe.findMany({
      select: { name: true, ingredients: true },
    })) as { name: string; ingredients: unknown }[];

    const conosciuti = new Map<string, Riga>();
    const senzaPeso = new Map<string, Riga>();

    for (const r of ricette) {
      const ingredienti = ((r.ingredients as { name?: string }[]) ?? []).filter(Boolean);
      // Un nome può comparire due volte nella stessa ricetta: la ricetta si conta una volta sola.
      const visti = new Set<string>();
      for (const i of ingredienti) {
        const nome = (i?.name ?? '').trim();
        if (!nome || visti.has(nome.toLowerCase())) continue;
        if (!sembraUnGrasso(nome)) continue;
        visti.add(nome.toLowerCase());
        const haPeso = !!fattori && pesoDi(fattori, nome) !== null;
        const dove = haPeso ? conosciuti : senzaPeso;
        const riga = dove.get(nome.toLowerCase()) ?? { nome, ricette: 0, esempi: [] };
        riga.ricette += 1;
        if (riga.esempi.length < 3) riga.esempi.push(r.name);
        dove.set(nome.toLowerCase(), riga);
      }
    }

    const ordina = (m: Map<string, Riga>) => [...m.values()].sort((a, b) => b.ricette - a.ricette);
    const fuori = ordina(senzaPeso);
    const dentro = ordina(conosciuti);

    const ricetteCoperte = dentro.reduce((s, r) => s + r.ricette, 0);
    const ricetteScoperte = fuori.reduce((s, r) => s + r.ricette, 0);

    console.log(`\nRicette lette: ${ricette.length}.`);
    console.log(`Nomi che sembrano un grasso: ${dentro.length + fuori.length} (${dentro.length} con peso, ${fuori.length} senza).`);
    console.log(`Comparse in ricetta: ${ricetteCoperte} coperte, ${ricetteScoperte} scoperte.\n`);

    if (!fuori.length) {
      console.log('✅ Nessun grasso del catalogo resta senza peso.\n');
      return;
    }

    console.log('⛔ DA DARE A NOCANTY — grammi equivalenti a 100 g di olio EVO, per questi nomi:\n');
    for (const r of fuori) {
      console.log(`  ${String(r.ricette).padStart(5)} ricette · «${r.nome}»   es.: ${r.esempi.join(' / ')}`);
    }
    console.log(
      '\n⚠️ Ogni riga qui sopra è un cambio che oggi Gaia non fa da sola.\n' +
        `   I pesi si aggiungono dal back office, sul gruppo «${GRUPPO_GRASSI}», nella forma «nome = grammi».\n` +
        '   ⛔ I nomi ambigui (panna da cucina, panna leggera, panna vegetale) sono PRODOTTI DIVERSI:\n' +
        '      o hanno un numero loro, o restano fuori. Non si ereditano dalla panna fresca.\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
