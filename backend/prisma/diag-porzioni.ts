/**
 * DIAGNOSTICA: **le giornate già erogate, misurate contro il fabbisogno di oggi** — sola lettura.
 *
 * `npm run diag:kcal` legge gli eventi che l'erogazione scrive **quando eroga**: risponde solo per
 * chi ha aperto l'app dopo il 17/8. Questa invece guarda i **giorni già in banca dati**, quindi
 * risponde subito — ed è il numero che serve per rispondere alle due domande cliniche del foglio
 * delle porzioni (`progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`): che **tetto** dare al
 * moltiplicatore, e **cosa fare quando il tetto non basta**.
 *
 * ⚠️ Il giudizio NON è riscritto qui: si chiama `giornateSottoTarget` (`src/menu/giornata-sotto-target`),
 * la stessa funzione che usa il motore, e il target lo calcola `KcalNeedService`, la stessa classe che
 * usa l'erogazione. Se le risposte divergessero sarebbe un difetto, non una differenza di metodo — è
 * la lezione del 17/8, quando il motore e `diag:digiuni` si sono contraddetti in un pomeriggio.
 *
 * ⚠️ IL LIMITE, detto qui e ristampato in fondo: si confrontano giornate **già erogate** con il
 * fabbisogno di **oggi**. Se nel frattempo il peso, l'obiettivo o la correzione kcal sono cambiati, il
 * numero di ieri è misurato con il metro di adesso. Va bene per decidere un tetto, non per dire a una
 * cliente cosa ha mangiato.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:porzioni                → ultimi 14 giorni, tetto 1,8
 *   TETTO=1.6 npm run diag:porzioni      → prova un tetto diverso
 *   GIORNI=30 npm run diag:porzioni      → finestra più lunga
 *   SOLO=a@b.it npm run diag:porzioni    → una cliente sola
 */
import { PrismaClient } from '@prisma/client';
import { KcalNeedService } from '../src/menu/kcal-need.service';
import { giornateSottoTarget, type PastoConKcal } from '../src/menu/giornata-sotto-target';

const prisma = new PrismaClient();

const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/**
 * I parametri di configurazione letti dalla tabella, con il default del codice.
 * ⚠️ Non è una copia della logica: `KcalNeedService` resta quello vero, gli si passa solo la porta
 * per leggere i numeri — che in produzione è `ConfigParamsService`.
 */
function configDaTabella() {
  const cache = new Map<string, string>();
  const carica = async () => {
    if (cache.size) return;
    const righe = (await prisma.configParam.findMany({ select: { key: true, value: true } })) as {
      key: string;
      value: string;
    }[];
    for (const r of righe) cache.set(r.key, r.value);
  };
  return {
    async getNumber(key: string, fallback?: number): Promise<number> {
      await carica();
      const n = Number(cache.get(key));
      return Number.isFinite(n) ? n : (fallback ?? 0);
    },
  };
}

async function main(): Promise<void> {
  const giorniFinestra = num(process.env.GIORNI, 14);
  const tetto = num(process.env.TETTO, 1.8);
  const solo = new Set(
    (process.env.SOLO ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
  );
  const oggi = new Date();
  oggi.setUTCHours(0, 0, 0, 0);
  const da = new Date(oggi.getTime() - giorniFinestra * 86_400_000);

  const config = configDaTabella();
  const kcalNeed = new KcalNeedService(prisma as never, config as never);
  const tolleranzaPct = await config.getNumber('menu_kcal_balance_tolerance_pct', 15);

  const giorni = (await prisma.menuDay.findMany({
    where: { date: { gte: da, lte: oggi } },
    select: { clientId: true, date: true, meals: true, dietId: true, level: true },
    orderBy: { date: 'asc' },
  })) as { clientId: string; date: Date; meals: unknown; dietId: string | null; level: number | null }[];

  if (giorni.length === 0) {
    console.log(`Nessuna giornata erogata negli ultimi ${giorniFinestra} giorni: non c'è niente da misurare.`);
    return;
  }

  const perCliente = new Map<string, { date: Date; meals: PastoConKcal[] }[]>();
  /** La dieta (e il livello) dell'ULTIMA giornata erogata: è il catalogo che quella cliente riceve. */
  const dietaDi = new Map<string, { dietId: string | null; level: number | null }>();
  for (const g of giorni) {
    const meals = (Array.isArray(g.meals) ? g.meals : []) as PastoConKcal[];
    if (!meals.length) continue;
    (perCliente.get(g.clientId) ?? perCliente.set(g.clientId, []).get(g.clientId)!).push({ date: g.date, meals });
    dietaDi.set(g.clientId, { dietId: g.dietId, level: g.level }); // i giorni arrivano in ordine: vince l'ultimo
  }

  const utenti = (await prisma.user.findMany({
    where: { id: { in: [...perCliente.keys()] } },
    select: {
      id: true,
      email: true,
      clientProfile: {
        select: { name: true, fastingWindow: true, pastiEsclusi: true, pathType: true, sex: true },
      },
    },
  })) as unknown as {
    id: string;
    email: string;
    clientProfile: {
      name: string | null;
      fastingWindow: string | null;
      pastiEsclusi: string[];
      pathType: string | null;
      sex: string | null;
    } | null;
  }[];
  const perId = new Map(utenti.map((u) => [u.id, u]));

  type Riga = {
    cliente: string;
    email: string;
    sesso: string;
    perche: string;
    target: number;
    'giornata più corta': number;
    'quota peggiore': string;
    'fattore necessario': string;
    'col tetto': string;
    'giornate sotto': string;
  };
  const righe: Riga[] = [];
  /** Il fabbisogno di ogni cliente in esame: serve anche al blocco delle taglie qui sotto. */
  const fabbisogni = new Map<string, number>();
  let senzaTarget = 0;
  let coperte = 0;
  let inBanda = 0;
  let scoperte = 0;

  for (const [clientId, gg] of perCliente) {
    const u = perId.get(clientId);
    const email = u?.email ?? '(utente sparito)';
    if (solo.size && !solo.has(email.toLowerCase())) continue;

    const target = await kcalNeed.computeTargetKcal(clientId);
    if (target) fabbisogni.set(clientId, target);
    if (!target) {
      // ⚠️ «Non lo so» non è «va bene»: senza sesso/età/altezza/peso il fabbisogno non si calcola, e
      // all'erogazione il motore usa le kcal del LIVELLO della dieta. Si conta a parte e si dice.
      senzaTarget++;
      continue;
    }

    const fuori = giornateSottoTarget(gg, target, tolleranzaPct);
    if (!fuori.length) continue;
    const peggiore = fuori.reduce((p, g) => (g.quotaDelTarget < p.quotaDelTarget ? g : p));
    const fattore = peggiore.quotaDelTarget > 0 ? 1 / peggiore.quotaDelTarget : Infinity;
    /**
     * ⚠️ IL TETTO SI GIUDICA CONTRO LA BANDA, NON CONTRO IL 100% — corretto dopo la prima lettura
     * in produzione (18/8): con `TETTO=1.6` una cliente al 60% arrivava al **96%** e la colonna
     * scriveva «NON basta», facendo sembrare quel tetto peggiore di quanto sia. Il motore considera
     * giusta una giornata dentro la tolleranza (default ±15%): fermarsi al 96% non è un difetto.
     */
    const dopoIlTetto = peggiore.quotaDelTarget * tetto;
    const soglia = 1 - tolleranzaPct / 100;
    const esito = dopoIlTetto >= 1 ? 'pieno' : dopoIlTetto >= soglia ? 'banda' : 'corta';
    if (esito === 'pieno') coperte++;
    else if (esito === 'banda') inBanda++;
    else scoperte++;

    const p = u?.clientProfile;
    const motivi: string[] = [];
    if (p?.pathType === 'intermittent_fasting') motivi.push(`digiuno: ${p.fastingWindow || 'finestra non impostata'}`);
    if (p?.pastiEsclusi?.length) motivi.push(`spuntini tolti: ${p.pastiEsclusi.join(', ')}`);
    if (!motivi.length) motivi.push('nessuna esclusione: è il catalogo');

    righe.push({
      cliente: p?.name ?? '(senza nome)',
      email,
      sesso: p?.sex === 'male' ? 'uomo' : p?.sex === 'female' ? 'donna' : '?',
      perche: motivi.join(' · '),
      target: Math.round(target),
      'giornata più corta': peggiore.kcal,
      'quota peggiore': `${Math.round(peggiore.quotaDelTarget * 100)}%`,
      'fattore necessario': Number.isFinite(fattore) ? `×${fattore.toFixed(2)}` : '—',
      'col tetto':
        esito === 'pieno'
          ? `arriva al 100%`
          : esito === 'banda'
            ? `dentro la banda (${Math.round(dopoIlTetto * 100)}%)`
            : `RESTA CORTA: ${Math.round(dopoIlTetto * 100)}%`,
      'giornate sotto': `${fuori.length} su ${gg.length}`,
    });
  }

  righe.sort((a, b) => parseInt(a['quota peggiore']) - parseInt(b['quota peggiore']));

  console.log(
    `Ultimi ${giorniFinestra} giorni · ${giorni.length} giornate erogate · ${perCliente.size} clienti ` +
      `· tolleranza ${tolleranzaPct}%\n`,
  );
  if (!righe.length) {
    console.log('Nessuna cliente con giornate sotto la banda del fabbisogno in questa finestra ✓');
  } else {
    console.table(righe);
    console.log(
      `\nCol tetto ×${tetto}: **${coperte} arrivano al 100%**, **${inBanda} dentro la banda ` +
        `(≥${Math.round((1 - tolleranzaPct / 100) * 100)}%)**, **${scoperte} restano corte**.\n` +
        '⚠️ «dentro la banda» conta come risolto: è la stessa tolleranza con cui il motore compone le\n' +
        '   giornate. Il tetto va scelto sulla terza colonna, non sulla prima.',
    );
  }
  if (senzaTarget) {
    console.log(
      `\n⚠️ ${senzaTarget} client${senzaTarget === 1 ? 'e' : 'i'} SENZA fabbisogno calcolabile (mancano ` +
        'sesso, età, altezza o peso): per loro il motore usa le kcal del livello della dieta, e da qui\n' +
        '   non si può dire se la giornata è corta. Non è un ✓: è un «non lo so».',
    );
  }
  /**
   * ⚠️ LE TAGLIE — il numero che serve alla decisione della voce 273.
   *
   * Le ricette del catalogo sono dimensionate su UNA giornata (`menu_daycombo_kcal_target`, default
   * 1500), e la dieta se la porta scritta in `levels[0].kcal` da quando il generatore l'ha creata.
   * Chi ha un fabbisogno sopra quella taglia riceve giornate corte **per costruzione**, e la domanda
   * che decide se serve una seconda taglia di catalogo è una sola: **quante sono**.
   */
  const diete = (await prisma.diet.findMany({
    where: { id: { in: [...new Set([...dietaDi.values()].map((d) => d.dietId).filter(Boolean))] as string[] } },
    select: { id: true, name: true, levels: true },
  })) as { id: string; name: string; levels: unknown }[];
  const tagliaDi = new Map(
    diete.map((d) => {
      const arr = (Array.isArray(d.levels) ? d.levels : []) as { level?: number; kcal?: number }[];
      return [d.id, { nome: d.name, kcal: arr[0]?.kcal ?? null }];
    }),
  );

  type RigaTaglia = { cliente: string; email: string; fabbisogno: number; 'taglia catalogo': string; rapporto: string };
  const sopra: RigaTaglia[] = [];
  let sottoOInPari = 0;
  let senzaTaglia = 0;
  for (const [clientId, fabbisogno] of fabbisogni) {
    const u = perId.get(clientId);
    if (solo.size && !solo.has((u?.email ?? '').toLowerCase())) continue;
    const t = tagliaDi.get(dietaDi.get(clientId)?.dietId ?? '');
    if (!t?.kcal) { senzaTaglia++; continue; }
    const rapporto = fabbisogno / t.kcal;
    // Il bordo della banda: sopra questo il catalogo non può comporre una giornata giusta.
    if (rapporto <= 1 / (1 - tolleranzaPct / 100)) { sottoOInPari++; continue; }
    sopra.push({
      cliente: u?.clientProfile?.name ?? '(senza nome)',
      email: u?.email ?? '—',
      fabbisogno: Math.round(fabbisogno),
      'taglia catalogo': `${t.kcal} (${t.nome})`,
      rapporto: `×${rapporto.toFixed(2)}`,
    });
  }
  sopra.sort((a, b) => parseFloat(b.rapporto.slice(1)) - parseFloat(a.rapporto.slice(1)));

  console.log(`\n── LE TAGLIE ──  chi ha un fabbisogno più grande del catalogo che riceve (voce 273)\n`);
  if (!sopra.length) {
    console.log(`Nessuna: tutte e ${sottoOInPari} le clienti misurabili stanno dentro la taglia del loro catalogo ✓`);
  } else {
    console.table(sopra);
    console.log(
      `**${sopra.length} clienti su ${sopra.length + sottoOInPari}** hanno un fabbisogno oltre il bordo\n` +
        `della banda della loro taglia: per loro il catalogo non può comporre una giornata giusta,\n` +
        'e nessun moltiplicatore di porzione cambia il fatto che le ricette sono scritte più piccole.',
    );
  }
  if (senzaTaglia) {
    console.log(`⚠️ ${senzaTaglia} senza taglia dichiarata in \`Diet.levels\`: da lì non si può dire niente.`);
  }

  console.log(
    '\n⚠️ Si confrontano giornate GIÀ EROGATE con il fabbisogno di OGGI: se peso, obiettivo o\n' +
      '   correzione kcal sono cambiati nel frattempo, il numero di ieri è misurato col metro di adesso.\n' +
      '   Va bene per scegliere un tetto, non per dire a una cliente cosa ha mangiato.\n' +
      '⚠️ «quota peggiore» è la giornata più corta della finestra, non la media.\n' +
      '\nFine. Questo script non ha scritto niente.\n',
  );
}

main()
  .catch((e) => {
    console.error('\n❌ Errore:', (e as Error)?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
