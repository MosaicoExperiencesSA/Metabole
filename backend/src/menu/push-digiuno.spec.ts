/**
 * LE PUSH DEL DIGIUNO — i test.
 *
 * Qui la cosa che conta non è quello che si manda: è **quello che non si manda**. Sei tipi accesi
 * di default diventano un motivo per disattivare tutto, se anche solo una di quelle notifiche
 * arriva mentre la cliente dorme, mentre sta pranzando, o due minuti dopo un'altra.
 *
 * ⚠️ E ogni push tolta deve uscire col **motivo scritto**: un silenzio senza spiegazione è
 * indistinguibile da un guasto, e la prima persona a chiederselo è chi non l'ha ricevuta.
 */
import {
  FUSIONE_MIN,
  PREAVVISO_MIN,
  PUSH_METABOLICHE,
  SONNO_PREDEFINITO,
  TUTTI_I_TIPI_PUSH,
  dentroIntervallo,
  pushDelGiorno,
} from './push-digiuno';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PROTOCOLLI_DIGIUNO } from './orologio-digiuno';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;
/** Nessuno dorme: serve a provare le regole una per volta, senza il sonno di mezzo. */
const SEMPRE_SVEGLIA = { inizioMin: 0, fineMin: 0 };
const tipi = (g: { programmate: { tipo: string }[] }) => g.programmate.map((p) => p.tipo);
const orari = (g: { programmate: { tipo: string; ora: string }[] }) =>
  Object.fromEntries(g.programmate.map((p) => [p.tipo, p.ora]));

describe('la giornata di una 18:6 — il caso con tutte e sei', () => {
  const g = pushDelGiorno(H(13), '18:6', SEMPRE_SVEGLIA);

  it('sono sei, e in ordine di orologio', () => {
    expect(g.programmate).toHaveLength(6);
    const ore = g.programmate.map((p) => p.oraMin);
    expect([...ore].sort((a, b) => a - b)).toEqual(ore);
  });

  it('gli orari vengono dalla finestra, non da una tabella scritta a mano', () => {
    // Finestra 13:00 → 19:00. Digiuno 18 ore da 19:00: dodici ore alle 07:00, sedici alle 11:00.
    expect(orari(g)).toEqual({
      digiuno_12_ore: '07:00',
      digiuno_16_ore: '11:00',
      digiuno_manca_unora: '12:00',
      digiuno_puoi_mangiare: '13:00',
      digiuno_chiude_fra_unora: '18:00',
      digiuno_inizia: '19:00',
    });
  });

  it('niente di quello che dice è un codice, e ogni messaggio ha un corpo vero', () => {
    for (const p of g.programmate) {
      expect(p.titolo.length).toBeGreaterThan(5);
      expect(p.corpo.length).toBeGreaterThan(30);
      expect(`${p.titolo} ${p.corpo}`).not.toMatch(/digiuno_|skip_|undefined|NaN|\d{3,}/);
    }
  });

  it('il preavviso è un\'ora prima, di qua e di là', () => {
    expect(PREAVVISO_MIN).toBe(60);
    const m = new Map(g.programmate.map((p) => [p.tipo, p.oraMin]));
    expect(m.get('digiuno_puoi_mangiare')! - m.get('digiuno_manca_unora')!).toBe(60);
    expect(m.get('digiuno_inizia')! - m.get('digiuno_chiude_fra_unora')!).toBe(60);
  });
});

describe('⛔ quello che NON si manda, e perché', () => {
  /**
   * ⛔ Con la 14:10 il digiuno dura quattordici ore: **le sedici non le raggiunge mai**. Mandare
   * «sedici ore di digiuno» a chi ne ha fatte quattordici sarebbe dirle una cosa falsa su una
   * cosa che sta facendo per la salute.
   */
  it('⛔ 14:10: le sedici ore non esistono, e si dice perché', () => {
    const g = pushDelGiorno(H(10), '14:10', SEMPRE_SVEGLIA);
    expect(tipi(g)).not.toContain('digiuno_16_ore');
    expect(g.programmate).toHaveLength(5);
    const saltata = g.saltate.find((s) => s.tipo === 'digiuno_16_ore');
    expect(saltata!.motivo).toContain('14 ore');
  });

  /**
   * ⛔ Con la 16:8 le sedici ore cadono **esattamente all'apertura**: due notifiche nello stesso
   * minuto si leggono come un difetto dell'app. Si fondono in una, che dice tutte e due le cose.
   */
  it('⛔ 16:8: le sedici ore si fondono con «puoi mangiare», e il messaggio le nomina', () => {
    const g = pushDelGiorno(H(12), '16:8', SEMPRE_SVEGLIA);
    expect(g.programmate).toHaveLength(5);
    expect(tipi(g)).not.toContain('digiuno_16_ore');
    const apertura = g.programmate.find((p) => p.tipo === 'digiuno_puoi_mangiare')!;
    expect(apertura.titolo).toContain('Sedici ore');
    expect(apertura.corpo).toContain('autofagia');
    expect(g.saltate.find((s) => s.tipo === 'digiuno_16_ore')!.motivo).toContain('apertura');
  });

  it('⚠️ ma se sono lontane più di mezz\'ora restano due messaggi', () => {
    // 18:6: le sedici ore cadono due ore prima dell'apertura.
    const g = pushDelGiorno(H(13), '18:6', SEMPRE_SVEGLIA);
    expect(tipi(g)).toContain('digiuno_16_ore');
    expect(g.programmate.find((p) => p.tipo === 'digiuno_puoi_mangiare')!.titolo)
      .not.toContain('Sedici');
    expect(FUSIONE_MIN).toBe(30);
  });

  /**
   * ⛔ **Quello che cade nel sonno si salta, non si accumula.** Tre notifiche insieme al risveglio
   * sono il modo più rapido per farsele disattivare tutte — e il countdown in home resta la fonte
   * di verità, quindi chi dorme non perde niente.
   */
  it('⛔ quello che cade nel sonno si salta, col motivo scritto', () => {
    // 18:6 dalle 13:00: le dodici ore cadono alle 07:00. Con sonno 23:00-08:00 ci finiscono dentro.
    const g = pushDelGiorno(H(13), '18:6', { inizioMin: H(23), fineMin: H(8) });
    expect(tipi(g)).not.toContain('digiuno_12_ore');
    expect(g.saltate.find((s) => s.tipo === 'digiuno_12_ore')!.motivo).toMatch(/dormi/);
  });

  it('⚠️ e il sonno che scavalca la mezzanotte è un intervallo, non due', () => {
    expect(dentroIntervallo(H(23, 30), H(23), H(7))).toBe(true);
    expect(dentroIntervallo(H(2), H(23), H(7))).toBe(true);
    expect(dentroIntervallo(H(7), H(23), H(7))).toBe(false); // il confine di uscita è fuori
    expect(dentroIntervallo(H(12), H(23), H(7))).toBe(false);
  });

  it('il ripiego del sonno è dichiarato, e vale 23:00-07:00', () => {
    expect(SONNO_PREDEFINITO).toEqual({ inizioMin: H(23), fineMin: H(7) });
  });

  /**
   * ⚠️ Chi spegne le metaboliche tiene le quattro utili. E la fusione si disfa: se la 16 ore è
   * spenta, «puoi mangiare» torna il messaggio normale invece di nominare una cosa che ha detto
   * di non voler sentire.
   */
  /**
   * ⛔ **SPEGNERE «PUOI MANGIARE» NON DEVE FAR SPARIRE ANCHE LE SEDICI ORE** (revisione, 21/8).
   *
   * La fusione mette le sedici ore *dentro* il messaggio dell'apertura. Se quel messaggio non parte
   * — spento, o caduto nel sonno — fondere fa sparire tutte e due, e la diagnostica scriveva pure
   * «te l'ho detto in quel messaggio»: una bugia su un silenzio.
   */
  it('⛔ spegnere «puoi mangiare» lascia le sedici ore come messaggio suo', () => {
    const g = pushDelGiorno(H(12), '16:8', SEMPRE_SVEGLIA, ['digiuno_puoi_mangiare']);
    expect(tipi(g)).toContain('digiuno_16_ore');
    expect(g.saltate.find((s) => s.tipo === 'digiuno_16_ore')).toBeUndefined();
  });

  /**
   * ⛔ **QUELLO CHE UN TEST NON PUÒ DIRE, DETTO QUI INVECE CHE FINTO.**
   *
   * La fusione scatta quando le sedici ore cadono a meno di trenta minuti dall'apertura. Con i
   * **cinque protocolli di oggi** quello scarto vale **zero oppure ore**: `chiusura + 16h` dista
   * dall'apertura di `(oreFinestra + 16) mod 24`, che fa zero solo per la 16:8. Quindi:
   *
   * - la soglia dei trenta minuti **non è distinguibile** da `=== 0` con nessun caso reale, e un
   *   test che dicesse di provarla starebbe mentendo (ci avevo provato: il caso non esiste);
   * - per lo stesso motivo non esiste un caso in cui «puoi mangiare» cade nel sonno **e** le sedici
   *   ore no: coincidono, quindi ci cadono insieme.
   *
   * ⚠️ Diventeranno distinguibili con la **rampa d'ingresso** già prevista (12h → 13 → 14 → 15 →
   * 16), che aggiunge protocolli con altre durate. La riga resta scritta com'è perché quel giorno
   * sia già giusta — ma senza far credere che oggi qualcuno la guardi.
   */
  it('⚠️ la soglia è trenta minuti, e oggi nessun caso reale la distingue da zero', () => {
    expect(FUSIONE_MIN).toBe(30);
    const scarti = PROTOCOLLI_DIGIUNO.map((p) => (p.oreFinestra + 16) % 24);
    // Zero (16:8) oppure ore intere: niente che cada fra 1 e 29 minuti.
    expect(scarti.filter((s) => s !== 0 && s * 60 < 60)).toEqual([]);
    // E il caso zero si fonde davvero, mentre uno lontano no: questo sì che si prova.
    expect(pushDelGiorno(H(12), '16:8', SEMPRE_SVEGLIA).programmate
      .find((p) => p.tipo === 'digiuno_puoi_mangiare')!.titolo).toContain('Sedici');
    expect(pushDelGiorno(H(13), '18:6', SEMPRE_SVEGLIA).programmate
      .find((p) => p.tipo === 'digiuno_puoi_mangiare')!.titolo).not.toContain('Sedici');
  });

  /**
   * ⛔ Il sonno che comincia a **mezzanotte** (`0`): un controllo scritto con `!!p.fastingSleepStart`
   * lo tratterebbe come «non impostato» e le manderebbe le push mentre dorme. Qui si prova che zero
   * è un orario come gli altri.
   */
  it('⛔ un sonno che comincia a mezzanotte vale come tutti gli altri', () => {
    const g = pushDelGiorno(H(13), '18:6', { inizioMin: 0, fineMin: H(8) });
    // Le dodici ore cadono alle 07:00, cioè dentro 00:00-08:00.
    expect(tipi(g)).not.toContain('digiuno_12_ore');
    expect(g.saltate.find((s) => s.tipo === 'digiuno_12_ore')!.motivo).toMatch(/dormi/);
  });

  it('⚠️ spegnere le metaboliche lascia le quattro, e disfa la fusione', () => {
    const g = pushDelGiorno(H(12), '16:8', SEMPRE_SVEGLIA, PUSH_METABOLICHE);
    expect(tipi(g).sort()).toEqual([
      'digiuno_chiude_fra_unora', 'digiuno_inizia', 'digiuno_manca_unora', 'digiuno_puoi_mangiare',
    ]);
    expect(g.programmate.find((p) => p.tipo === 'digiuno_puoi_mangiare')!.titolo).not.toContain('Sedici');
    expect(g.saltate.find((s) => s.tipo === 'digiuno_12_ore')!.motivo).toContain('disattivata');
  });

  it('⛔ un protocollo fuori tabella non produce niente, e non inventa un motivo', () => {
    const g = pushDelGiorno(H(12), '30:1', SEMPRE_SVEGLIA);
    expect(g.programmate).toHaveLength(0);
    expect(g.saltate).toHaveLength(0);
  });
});

describe('⛔ nessuna metabolica dentro la finestra di pasto, su nessuna posizione', () => {
  /**
   * ⛔ «Autofagia al picco» mentre la cliente sta pranzando dice una cosa falsa. La regola vale per
   * **tutti e cinque i protocolli** e per **tutte le posizioni** della giornata: qui si prova su
   * tutte e 96 le mezz'ore, perché è il tipo di difetto che si presenta solo a un certo orario.
   */
  it.each(PROTOCOLLI_DIGIUNO.map((p) => p.valore))('%s: mai una metabolica dentro la finestra', (protocollo) => {
    const dentro: string[] = [];
    for (let inizio = 0; inizio < 24 * 60; inizio += 15) {
      const g = pushDelGiorno(inizio, protocollo, SEMPRE_SVEGLIA);
      const p = PROTOCOLLI_DIGIUNO.find((x) => x.valore === protocollo)!;
      const chiusura = (inizio + p.oreFinestra * 60) % (24 * 60);
      for (const push of g.programmate) {
        if (!PUSH_METABOLICHE.includes(push.tipo)) continue;
        if (dentroIntervallo(push.oraMin, inizio, chiusura)) {
          dentro.push(`${protocollo}@${inizio}: ${push.tipo} alle ${push.ora}`);
        }
      }
    }
    expect(dentro).toEqual([]);
  });

  /**
   * ⚠️ E il conto del §12.2, provato invece che ricopiato: cinque push per 14:10 e 16:8, sei per
   * le altre tre. Se un giorno una regola cambia, questo numero lo dice.
   */
  it.each([
    ['14:10', 5],
    ['16:8', 5],
    ['18:6', 6],
    ['20:4', 6],
    // ⛔ **CINQUE, non sei** (corretto in revisione, 21/8): con una finestra di un'ora «fra un'ora si
    // chiude» cadrebbe nello stesso minuto di «ora puoi mangiare» — e il testo «se ti manca un
    // pasto, è adesso» arriverebbe prima che lei abbia mangiato qualsiasi cosa.
    ['23:1', 5],
  ])('⚠️ %s manda %s push al giorno', (protocollo, attese) => {
    // Una posizione che non fa cadere niente nel sonno predefinito, per contare i tipi e basta.
    expect(pushDelGiorno(H(12), protocollo as string, SEMPRE_SVEGLIA).programmate).toHaveLength(attese as number);
  });

  /**
   * ⛔ **Nessuna coppia di push nello stesso minuto, su nessun protocollo e nessuna posizione.**
   * È la regola che vale per la fusione delle sedici ore, e che alla 23:1 non veniva applicata: due
   * notifiche insieme si leggono come un difetto dell'app, non come due informazioni.
   */
  it.each(PROTOCOLLI_DIGIUNO.map((p) => p.valore))('⛔ %s: mai due push nello stesso minuto', (protocollo) => {
    const collisioni: string[] = [];
    for (let inizio = 0; inizio < 24 * 60; inizio += 5) {
      const g = pushDelGiorno(inizio, protocollo, SEMPRE_SVEGLIA);
      const visti = new Map<number, string>();
      for (const push of g.programmate) {
        const gia = visti.get(push.oraMin);
        if (gia) collisioni.push(`${protocollo}@${inizio}: ${gia} + ${push.tipo} alle ${push.ora}`);
        visti.set(push.oraMin, push.tipo);
      }
    }
    expect(collisioni).toEqual([]);
  });
});

describe('⛔ i sei tipi si possono spegnere DALL\'APP, non solo dal codice', () => {
  /**
   * ⛔ Trovato in revisione (21/8). Il parametro `spente` c'era, la funzione lo rispettava, e
   * `app/src/components/NotificationPrefs.tsx` — l'unico posto da cui una cliente può spegnere una
   * notifica — aveva un elenco scritto a mano in cui **nessuno dei sei compariva**. La regola «chi
   * si stufa spegne le metaboliche e tiene le quattro utili» viveva solo nel backend: una
   * preferenza che nessuno può esprimere non è una preferenza.
   *
   * ⚠️ Il test guarda il **sorgente dell'app**, come `menu/finestre-nelle-tendine.spec.ts`: il
   * difetto vive in un file che il backend non importa, e le mutazioni non ci arrivano.
   */
  it('⛔ tutti e sei sono nell\'elenco delle preferenze dell\'app', () => {
    const file = join(__dirname, '..', '..', '..', 'app', 'src', 'components', 'NotificationPrefs.tsx');
    expect(existsSync(file)).toBe(true);
    const sorgente = readFileSync(file, 'utf8');
    const mancanti = TUTTI_I_TIPI_PUSH.filter((t) => !sorgente.includes(`'${t}'`));
    expect(mancanti).toEqual([]);
  });
});

describe('⚠️ niente sparisce senza motivo', () => {
  it('⚠️ ogni tipo o è programmato o è saltato con una frase, mai né l\'uno né l\'altro', () => {
    for (const protocollo of PROTOCOLLI_DIGIUNO.map((p) => p.valore)) {
      for (const inizio of [H(6), H(12), H(19), H(23)]) {
        const g = pushDelGiorno(inizio, protocollo);
        const visti = new Set([...g.programmate.map((p) => p.tipo), ...g.saltate.map((s) => s.tipo)]);
        const mancanti = TUTTI_I_TIPI_PUSH.filter((t) => !visti.has(t));
        expect({ protocollo, inizio, mancanti }).toEqual({ protocollo, inizio, mancanti: [] });
      }
    }
  });

  it('⚠️ e il motivo è una frase per una persona, non un codice', () => {
    const g = pushDelGiorno(H(10), '14:10', { inizioMin: H(23), fineMin: H(7) });
    expect(g.saltate.length).toBeGreaterThan(0);
    for (const s of g.saltate) {
      expect(s.motivo.length).toBeGreaterThan(10);
      expect(s.motivo).not.toMatch(/digiuno_|null|undefined/);
    }
  });
});
