/**
 * RIFÀ LA BASE PERSONALE DI CHI NON CE L'HA O CE L'HA VECCHIA.
 *
 * ⛔ **Nasce da un difetto mio, del 2/9.** La ricostruzione automatica dalla scheda guarda i campi
 * **davvero cambiati** — giustamente, perché il form rimanda tutto a ogni Salva e altrimenti si
 * ricostruirebbe a ogni click. Ma le diciannove persone della Fase 9 **erano già state spostate**:
 * risalvare la loro scheda non cambia niente, quindi non ricostruisce niente. Una regola giusta che
 * rende impossibile la cosa che serve fare oggi.
 *
 * ⚠️ La porta per farlo a mano esiste (`POST /clients/:id/personal-base/rebuild`) ma il backoffice
 * non la chiama da nessuna parte: nessun pulsante, in nessuna schermata. Questo script è il
 * rimedio per **oggi**, su diciannove persone; il pulsante è il rimedio per domani.
 *
 * ## ⛔ COSA PUÒ SUCCEDERE, e va saputo prima
 *
 * `buildPersonalBase` non sempre riesce: se fra le ricette sicure non ce ne sono abbastanza per un
 * pasto, o se ci sono allergeni non revisionati, **blocca il piano** e apre una segnalazione al
 * nutrizionista. È il suo mestiere, ed è giusto — ma vuol dire che questo script può aprire fino a
 * una segnalazione per persona. ⚠️ Meglio saperlo prima di lanciarlo su diciannove clienti che
 * oggi ricevono i menu.
 *
 * ⚠️ E una base **bloccata** non è un fallimento dello script: è la risposta vera. La cliente stava
 * già ricevendo menu con una base vecchia, e il blocco dice che con i suoi dati di oggi quella base
 * non si può certificare. Quello che cambia è che adesso qualcuno lo sa.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run rifai:basi                → prova a vuoto: dice CHI e PERCHÉ, non scrive niente
 *   APPLICA=1 npm run rifai:basi      → rifà
 *   SOLO=fa15497b,88577c61 npm run rifai:basi   → solo queste (id anche accorciati)
 *   GIORNI=7 npm run rifai:basi       → «vecchia» = più vecchia del profilo di N giorni (default: 0,
 *                                        cioè basta che il profilo sia stato toccato dopo)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLICA = process.env.APPLICA === '1';
const SOLO = (process.env.SOLO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const GIORNI = Math.max(0, Number(process.env.GIORNI ?? 0) || 0);
const riga = (s = '') => console.log(s);
const titolo = (s: string) => {
  riga('');
  riga('──────────────────────────────────────────────────────────────────');
  riga(`  ${s}`);
  riga('──────────────────────────────────────────────────────────────────');
};

async function main() {
  titolo('RIFÀ LE BASI PERSONALI — chi non ce l\'ha, o ce l\'ha più vecchia del profilo');
  riga('');
  riga(APPLICA ? '  ⚠️  APPLICA=1: SCRIVO.' : '  Prova a vuoto: non scrivo niente.');

  const [profili, certificati] = await Promise.all([
    prisma.clientProfile.findMany({
      select: { userId: true, name: true, dietFamily: true, regime: true, updatedAt: true },
    }) as unknown as Promise<{ userId: string; name: string | null; dietFamily: string | null; regime: string | null; updatedAt: Date }[]>,
    prisma.personalizationCertificate.findMany({ select: { clientId: true, createdAt: true } }) as unknown as
      Promise<{ clientId: string; createdAt: Date }[]>,
  ]);

  /** ⚠️ L'ULTIMO certificato per cliente: quello vecchio non dice niente su oggi. */
  const ultimo = new Map<string, Date>();
  for (const c of certificati) {
    const gia = ultimo.get(c.clientId);
    if (!gia || c.createdAt > gia) ultimo.set(c.clientId, c.createdAt);
  }

  const scelte = profili.filter((p) => {
    if (SOLO.length && !SOLO.some((s) => p.userId.startsWith(s))) return false;
    const cert = ultimo.get(p.userId);
    if (!cert) return true; // mai costruita
    return cert.getTime() + GIORNI * 86_400_000 < p.updatedAt.getTime();
  });

  riga('');
  riga(`  Profili guardati                      ${String(profili.length).padStart(5)}`);
  riga(`  Da rifare (mai costruita o vecchia)   ${String(scelte.length).padStart(5)}`);

  if (!scelte.length) {
    riga('');
    riga('  ✅ Nessuna base da rifare.');
    return;
  }

  titolo('CHI');
  riga('');
  for (const p of scelte) {
    const cert = ultimo.get(p.userId);
    const stato = cert
      ? `base del ${cert.toISOString().slice(0, 10)}, profilo del ${p.updatedAt.toISOString().slice(0, 10)}`
      : 'MAI COSTRUITA';
    riga(`  · ${p.userId.slice(0, 8)}  ${(p.name ?? '—').padEnd(18)} «${p.dietFamily ?? '(vuota)'}» — ${stato}`);
  }

  if (!APPLICA) {
    riga('');
    riga('  ⛔ Prima di lanciare con APPLICA=1, una cosa da sapere: se per qualcuna le ricette');
    riga('     sicure non bastano, `buildPersonalBase` BLOCCA il piano e apre una segnalazione al');
    riga('     nutrizionista. Su queste persone può voler dire fino a una segnalazione ciascuna.');
    riga('     ⚠️ Non è un guasto: è la risposta vera, e finora nessuno la stava facendo.');
    riga('');
    riga('  Prova a vuoto: non ho scritto niente. Poi: APPLICA=1 npm run rifai:basi');
    riga('');
    return;
  }

  /**
   * ⛔ **UNA PER VOLTA, e non in transazione.** Ogni ricostruzione è indipendente: se la quinta
   * blocca, le prime quattro devono restare fatte. Metterle in una transazione vorrebbe dire che
   * un blocco — che è una risposta legittima — annulla il lavoro riuscito sulle altre.
   */
  titolo('RICOSTRUZIONE');
  riga('');
  const { PersonalBaseService } = await import('../src/personal-base/personal-base.service');
  const { ConfigParamsService } = await import('../src/config-params/config-params.service');
  const { AuditService } = await import('../src/audit/audit.service');
  const audit = new AuditService(prisma as never);
  const config = new ConfigParamsService(prisma as never, audit as never);
  const servizio = new PersonalBaseService(prisma as never, config as never, audit as never);

  let pronte = 0;
  let bloccate = 0;
  let esplose = 0;
  for (const p of scelte) {
    const chi = `${p.userId.slice(0, 8)}  ${(p.name ?? '—').padEnd(18)}`;
    try {
      const esito = await servizio.buildPersonalBase(p.userId);
      if (esito.status === 'ready') {
        pronte += 1;
        riga(`  ✅ ${chi} ${esito.totalSafe ?? '?'} ricette sicure`);
      } else {
        bloccate += 1;
        riga(`  ⛔ ${chi} BLOCCATA — ${(esito.reasons ?? []).slice(0, 2).join('; ') || esito.message}`);
      }
    } catch (e) {
      esplose += 1;
      riga(`  ⛔ ${chi} ERRORE — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  titolo('IL CONTO');
  riga('');
  riga(`  Rifatte e pronte   ${String(pronte).padStart(4)}`);
  riga(`  Bloccate           ${String(bloccate).padStart(4)}   ⚠️ segnalazione aperta al nutrizionista`);
  riga(`  Errori             ${String(esplose).padStart(4)}`);
  riga('');
  riga('  ⚠️ Rilancia `npm run diag:fase9`: le righe «BASE PERSONALE VECCHIA / MAI COSTRUITA»');
  riga('     devono essere sparite.');
  riga('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
