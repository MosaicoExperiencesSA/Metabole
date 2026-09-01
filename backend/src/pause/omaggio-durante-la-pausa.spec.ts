import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **L'ECCEZIONE AL «PIANO FERMO» HA UNA PORTA SUA — guardia (a), decisa il 27/8.**
 *
 * Tutto il motore si ferma quando il piano è sospeso, e quella regola ha una ragione: la cliente ha
 * chiesto di non ricevere menu. L'omaggio di rientro è l'unica eccezione.
 *
 * ⚠️ **La tentazione era metterla dentro il controllo «piano fermo»**, con un `if` in più. Sarebbe
 * l'errore: da quel momento la condizione «si eroga a piano sospeso» vivrebbe **dentro il
 * cancello**, e il prossimo pezzo di codice che passa di lì la erediterebbe senza saperlo. Un
 * cancello con un buco dentro non è più un cancello.
 *
 * Questa sentinella tiene ferme le due metà: l'eccezione sta in un file suo, e i cancelli non la
 * conoscono.
 */
const BACKEND = join(__dirname, '..', '..');
const leggi = (rel: string) => readFileSync(join(BACKEND, 'src', rel), 'utf8');

describe('⛔ l\'omaggio a piano sospeso passa da una porta dichiarata', () => {
  it('la porta esiste e ha un nome', () => {
    expect(() => leggi('pause/omaggio-di-rientro.ts')).not.toThrow();
    expect(leggi('pause/omaggio-di-rientro.ts')).toMatch(/export function spettaLOmaggio/);
  });

  it('⛔ e la sorveglianza della pausa la chiama, invece di decidere da sé', () => {
    const tick = leggi('pause/pause.service.ts');
    expect(tick).toMatch(/const esito = spettaLOmaggio\(/);
    // la regola del mese NON si riscrive qui: sta nella porta
    expect(tick).not.toMatch(/getUTCMonth\(\)/);
  });

  /**
   * ⛔ **I CANCELLI NON SANNO NIENTE DELL'OMAGGIO.** Se `deliverIfEligible` o la porta di «perché
   * non ricompone» nominassero l'omaggio, vorrebbe dire che l'eccezione è rientrata dentro il
   * cancello — e da lì la eredita chiunque.
   */
  it('⛔ e i cancelli del motore non lo nominano: l\'eccezione non è rientrata dentro', () => {
    for (const f of ['menu/menu.service.ts', 'menu/perche-non-ricompone.ts']) {
      expect(leggi(f)).not.toMatch(/spettaLOmaggio|omaggioRientroIl/);
    }
  });

  /**
   * ⛔ **GUARDIA (b): il segno si scrive PRIMA di erogare.** Se si scrivesse dopo, un errore in
   * mezzo — o due giri del cron nella stessa notte — regalerebbe l'omaggio due volte. Meglio un
   * omaggio mancato che due: il primo si recupera il mese dopo, il secondo è una cliente che
   * riceve menu mentre ha chiesto di non riceverne.
   */
  it('⛔ il segno si scrive prima di erogare, non dopo', () => {
    const tick = leggi('pause/pause.service.ts');
    const dopoIlSi = tick.slice(tick.indexOf('if (esito.spetta) {'));
    const scrittura = dopoIlSi.indexOf('omaggioRientroIl: new Date()');
    const erogazione = dopoIlSi.indexOf('generateRientroMenus(p.clientId, giorniOmaggio)');
    expect(scrittura).toBeGreaterThan(-1);
    expect(erogazione).toBeGreaterThan(-1);
    expect(scrittura).toBeLessThan(erogazione);
  });

  /**
   * ⚠️ **Quattro giornate, e un parametro SUO.** `monitoring_rientro_days` è il kit di fine
   * monitoraggio, un prodotto comprato a €19: accorciare l'omaggio non deve accorciare quello.
   */
  it('⚠️ le giornate dell\'omaggio hanno un parametro loro', () => {
    expect(leggi('pause/pause.service.ts')).toMatch(/getNumber\('pause_omaggio_giorni', 4\)/);
    expect(leggi('monitoring/monitoring.service.ts')).toMatch(/quantiGiorni \?\? await this\.configParams\.getNumber\('monitoring_rientro_days', 7\)/);
  });

  /** ⛔ E la colonna nuova non è quella vecchia: `rientroMenusAt` dice un'altra cosa. */
  it('⛔ il segno dell\'omaggio è una colonna sua, non `rientroMenusAt`', () => {
    const schema = readFileSync(join(BACKEND, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/omaggioRientroIl DateTime\? @map\("omaggio_rientro_il"\)/);
    expect(schema).toMatch(/rientroMenusAt   DateTime\? @map\("rientro_menus_at"\)/);
    const mig = readFileSync(
      join(BACKEND, 'prisma', 'migrations', '20260901120000_omaggio_di_rientro_durante_la_pausa', 'migration.sql'),
      'utf8',
    );
    expect(mig).toMatch(/ALTER TABLE "pause_request" ADD COLUMN "omaggio_rientro_il"/);
  });
});
