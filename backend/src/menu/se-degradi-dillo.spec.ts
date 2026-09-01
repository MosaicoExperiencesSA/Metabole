import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * «SE DEGRADI, DILLO» — la regola di casa, applicata alla composizione della giornata.
 *
 * ⚠️ Decisione di Simone dell'1/9 (Fase 3 del piano panieri): quando nessuna combinazione entra
 * nella banda kcal, la giornata si compone allargando la banda a passi. Il conto sta in
 * `day-combo.service.ts` ed è provato lì. Questa sentinella guarda le tre cose che rendono la
 * decisione **vera in produzione**, e che un conto giusto da solo non garantisce:
 *
 *   1. che chi compone chieda davvero l'allargamento;
 *   2. che il tetto arrivi da `config_param` e non sia scritto nel codice;
 *   3. che quando si degrada **si scriva**, sulla riga e nel log.
 *
 * ⛔ La ragione per cui è una sentinella e non una prova di comportamento: tutte e tre sono una
 * riga sola dentro `deliverIfEligible`, che per girare vuole mezza applicazione. Una riga tolta per
 * sbaglio non farebbe cadere nessuna prova — la giornata continuerebbe a uscire, semplicemente
 * senza dire più niente. È il genere di silenzio che si scopre mesi dopo.
 */
describe('la composizione dice quando degrada', () => {
  const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');

  it('⛔ chi compone chiede l\'allargamento, e usa `componi` per sapere di quanto', () => {
    expect(src).toMatch(/const esito = this\.dayCombo\.componi\(\{/);
    /**
     * ⚠️ Si cerca dentro la CHIAMATA, non a una riga fissa: la prima stesura pretendeva
     * `allargamento,` subito prima della parentesi di chiusura, e la Fase 4 — che ha aggiunto
     * `coppieGiaViste` in coda — l'ha fatta cadere su codice giusto. Una sentinella che si rompe
     * quando si aggiunge un argomento è una sentinella che si impara a rilassare.
     */
    const chiamata = src.slice(src.indexOf('this.dayCombo.componi({'));
    expect(chiamata.slice(0, chiamata.indexOf('});'))).toMatch(/\ballargamento,/);
    expect(src).toMatch(/allargataDi = esito\?\.allargataDi \?\? 0;/);
  });

  it('⛔ il passo e il tetto vengono da `config_param`, coi default dichiarati', () => {
    expect(src).toMatch(/getNumber\('menu_daycombo_allargamento_passo_pct', 5\)/);
    expect(src).toMatch(/getNumber\('menu_daycombo_allargamento_tetto_pct', 20\)/);
  });

  it('⛔ quando si degrada si scrive: sulla giornata e nel log', () => {
    expect(src).toMatch(/allargamentoBandaPct: day\.allargataDi \?\? null,/);
    expect(src).toMatch(/if \(giornateAllargate > 0\) \{[\s\S]{0,400}?this\.logger\.warn\(/);
  });

  /**
   * ⚠️ Il log si scrive **una volta per giro**, non una per giornata: un ciclo di sette giorni con
   * la banda stretta scriverebbe sette righe identiche, e un log che si ripete è un log che si
   * smette di leggere. La riga sta FUORI dal ciclo delle giornate.
   */
  it('⚠️ e il log sta fuori dal ciclo, una riga per giro', () => {
    const dentroIlCiclo = src.slice(
      src.indexOf('for (const istante of daComporre)'),
      src.indexOf('daySnapshots.push('),
    );
    expect(dentroIlCiclo).not.toMatch(/logger\.warn\([^)]{0,80}allargando/);
  });

  /** ⚠️ Il messaggio manda a un tabulato: se il comando non esiste, la riga non serve a niente. */
  it('⚠️ il comando che il log nomina esiste davvero', () => {
    expect(src).toMatch(/npm run diag:allargamenti/);
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['diag:allargamenti']).toBeTruthy();
    expect(pkg.scripts['diag:struttura']).toBeTruthy();
    expect(pkg.scripts['diag:spuntini']).toBeTruthy();
  });

  /**
   * ⛔ **La colonna deve esistere prima che qualcuno ci scriva.** Il campo si scrive in `create`, e
   * se la migrazione non fosse nel repo il primo menu composto dopo il rilascio esploderebbe —
   * per tutte le clienti insieme, che è il modo peggiore di scoprirlo.
   */
  it('⛔ la colonna è nello schema e ha la sua migrazione', () => {
    const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/allargamentoBandaPct Int\? @map\("allargamento_banda_pct"\)/);
    const mig = readFileSync(
      join(__dirname, '..', '..', 'prisma', 'migrations', '20260901090000_giornata_dice_di_quanto_si_e_allargata', 'migration.sql'),
      'utf8',
    );
    expect(mig).toMatch(/ALTER TABLE "menu_day" ADD COLUMN "allargamento_banda_pct" INTEGER;/);
  });
});

/**
 * LA COPPIA PRANZO/CENA (richiesta di Simone, 26/8) — stesse tre domande: che si chieda, che il
 * numero di giorni venga da `config_param`, e che una coppia ripetuta si scriva invece di passare
 * in silenzio.
 */
describe('la coppia pranzo/cena non si ripete, e quando si ripete lo dice', () => {
  const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');

  it('⛔ lo storico delle coppie si legge e si passa a chi compone', () => {
    expect(src).toMatch(/await this\.coppieRecenti\(clientId, firstNewDate, coppiaGiorni\)/);
    const chiamata = src.slice(src.indexOf('this.dayCombo.componi({'));
    expect(chiamata.slice(0, chiamata.indexOf('});'))).toMatch(/\bcoppieGiaViste,/);
  });

  it('⛔ i giorni vengono da `config_param`, e lo zero spegne la regola', () => {
    expect(src).toMatch(/getNumber\('menu_coppia_pranzo_cena_giorni', 30\)/);
    expect(src).toMatch(/const coppiaGiorni = Math\.max\(0, pickNumOverride\(/);
    expect(src).toMatch(/coppiaGiorni > 0\s*\n?\s*\?/);
  });

  /**
   * ⛔ **La coppia si ricorda DOPO la guardia di varietà**, che può cambiare il pranzo o la cena.
   * Ricordare quella scelta prima vorrebbe dire tenere uno storico di giornate che nessuno ha
   * mangiato, e lasciar tornare quella vera.
   */
  it('⛔ si ricorda la coppia servita, non quella scelta', () => {
    const dopo = src.slice(src.indexOf('this.pushSlotHistory(slotHistory, chosen, varietyGap);'));
    expect(dopo.slice(0, 600)).toMatch(/coppieGiaViste\.add\(coppia\)/);
  });

  it('⛔ e una coppia ripetuta finisce nel log, col comando per guardarla', () => {
    expect(src).toMatch(/if \(coppieRipetute > 0\) \{[\s\S]{0,400}?this\.logger\.warn\(/);
    expect(src).toMatch(/npm run diag:coppie/);
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['diag:coppie']).toBeTruthy();
  });
});

/**
 * LA REGOLA FLEXITARIANA (decisione di Simone, 1/9: carne due volte a settimana) — stesse tre
 * domande: che si chieda, che il numero venga da `config_param`, e che uno sforamento si scriva.
 */
describe('la carne è limitata, e quando si sfora lo dice', () => {
  const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');

  it('⛔ il tetto si calcola e si passa a chi compone', () => {
    const chiamata = src.slice(src.indexOf('this.dayCombo.componi({'));
    expect(chiamata.slice(0, chiamata.indexOf('});'))).toMatch(/\bcarneRestante:/);
    expect(src).toMatch(/await this\.giornateConCarneRecenti\(clientId, firstNewDate\)/);
  });

  it('⛔ il numero viene da `config_param`, e ZERO è nessun limite', () => {
    expect(src).toMatch(/getNumber\('menu_carne_max_a_settimana', 0\)/);
    expect(src).toMatch(/const carneMax = Math\.max\(0, pickNumOverride\(/);
  });

  /**
   * ⛔ **La carne servita si ricorda DOPO la guardia di varietà**, che può cambiare un piatto: se
   * si contasse quella scelta, il conteggio direbbe una cosa e il piatto un'altra.
   */
  it('⛔ si conta la carne servita, non quella scelta', () => {
    const dopo = src.slice(src.indexOf('this.pushSlotHistory(slotHistory, chosen, varietyGap);'));
    expect(dopo.slice(0, 1200)).toMatch(/giornateConCarne\.push\(/);
  });

  /**
   * ⛔ **«Non lo sappiamo» conta come carne**: il verso opposto renderebbe il tetto aggirabile da
   * qualunque ricetta con gli ingredienti scritti male, o cancellata dal catalogo.
   */
  it('⛔ un piatto ignoto conta come carne, non come «senza»', () => {
    expect(src).toMatch(/ctxGiorno\.carne\.get\(m\.recipeId\) !== false/);
    expect(src).toMatch(/eCarneQuesta\.get\(m\.recipeId as string\) !== false/);
  });

  it('⛔ e uno sforamento finisce nel log', () => {
    expect(src).toMatch(/if \(giornateOltreIlTetto > 0\) \{[\s\S]{0,400}?this\.logger\.warn\(/);
  });
});
