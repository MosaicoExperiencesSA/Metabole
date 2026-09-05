/**
 * L'OROLOGIO DEL DIGIUNO — i test.
 *
 * Il primo blocco è quello che conta: **traslare la finestra non cambia cosa mangi**. È la regola su
 * cui il primo modello (pasti ancorati a ore fisse) sbagliava, e qui viene provata su **ogni
 * posizione della giornata**, non su tre casi scelti bene.
 */
import { FINESTRE_DIGIUNO, VALORI_FINESTRA_DIGIUNO } from './finestre-digiuno';
import {
  MARGINI_PREDEFINITI,
  PROTOCOLLI_DIGIUNO,
  SOGLIE_PASTI_PREDEFINITE,
  chiusuraFinestra,
  dentroLaGiornata,
  derivaDaOrologio,
  etichettaPasto,
  finestraPerPasti,
  oraDelGiorno,
  orariDeiPasti,
  finestreRaggiungibili,
  oreDigiunoNelSonno,
  pastiDellaFinestra,
  protocolloDigiuno,
} from './orologio-digiuno';

/** Tutte le aperture possibili a passi di 15 minuti: 96 posizioni. */
const TUTTE_LE_POSIZIONI = Array.from({ length: 96 }, (_, i) => i * 15);

describe('la regola: la durata dice quanti pasti, la posizione non dice niente', () => {
  it.each(PROTOCOLLI_DIGIUNO.map((p) => [p.valore, p] as const))(
    '«%s»: gli stessi pasti in tutte e 96 le posizioni della giornata',
    (_v, p) => {
      const atteso = pastiDellaFinestra(p.oreFinestra).join('+');
      expect(atteso.length).toBeGreaterThan(0);
      for (const inizio of TUTTE_LE_POSIZIONI) {
        const pasti = orariDeiPasti(inizio, p.oreFinestra).map((x) => x.slot).join('+');
        expect(`${oraDelGiorno(inizio)} → ${pasti}`).toBe(`${oraDelGiorno(inizio)} → ${atteso}`);
      }
    },
  );

  it('⚠️ e nemmeno il `fastingWindow` derivato cambia spostando la finestra', () => {
    for (const p of PROTOCOLLI_DIGIUNO) {
      const valori = new Set(TUTTE_LE_POSIZIONI.map((i) => derivaDaOrologio(i, p.valore)?.fastingWindow));
      expect([...valori]).toHaveLength(1);
      expect([...valori][0]).toBeDefined();
    }
  });

  it('a cambiare i pasti è SOLO la durata', () => {
    const per = (prot: string) => derivaDaOrologio(12 * 60, prot)?.pasti.length;
    expect(per('14:10')).toBe(4);
    expect(per('16:8')).toBe(3);
    expect(per('18:6')).toBe(2);
    expect(per('20:4')).toBe(2);
    expect(per('23:1')).toBe(1);
  });
});

describe('la prova del manuale', () => {
  /**
   * Il piano del manuale (pag. 3) per la 16:8 su finestra 12:00-20:00 mette i pasti alle
   * **12:00 · 16:00 · 19:30**. Nessuno di questi numeri è stato messo a mano nel modulo: escono
   * dai margini (15 minuti dopo l'apertura, 30 prima della chiusura) e dalla spalmatura.
   */
  it('16:8 alle 12:00 → 12:15 · 15:55 · 19:30, cioè il piano del manuale', () => {
    const d = derivaDaOrologio(12 * 60, '16:8');
    expect(d?.pasti.map((x) => oraDelGiorno(x.oraMin))).toEqual(['12:15', '15:55', '19:30']);
  });

  it('⚠️ e quella finestra è ESATTAMENTE il catalogo digiuno di oggi: chi è sul 16:8 non si muove', () => {
    const d = derivaDaOrologio(12 * 60, '16:8');
    expect(d?.pasti.map((x) => x.slot)).toEqual(['lunch', 'afternoon_snack', 'dinner']);
    expect(d?.fastingWindow).toBe('skip_breakfast');
  });
});

describe('gli orari stanno dentro la finestra', () => {
  it.each(PROTOCOLLI_DIGIUNO.map((p) => [p.valore, p] as const))('«%s», in ogni posizione', (_v, p) => {
    for (const inizio of TUTTE_LE_POSIZIONI) {
      const durata = p.oreFinestra * 60;
      const pasti = orariDeiPasti(inizio, p.oreFinestra);
      // Distanza dall'apertura, srotolata: così una finestra che scavalca la mezzanotte non mente.
      const scarti = pasti.map((x) => dentroLaGiornata(x.oraMin - inizio));
      for (const s of scarti) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(durata);
      }
      // In ordine, e mai due pasti alla stessa ora.
      expect([...scarti].sort((a, b) => a - b)).toEqual(scarti);
      expect(new Set(scarti).size).toBe(scarti.length);
    }
  });

  it('⚠️ la finestra che scavalca la mezzanotte non rompe niente (apertura 20:00, 16:8)', () => {
    const d = derivaDaOrologio(20 * 60, '16:8');
    expect(d?.fineMin).toBe(4 * 60);
    expect(d?.pasti.map((x) => oraDelGiorno(x.oraMin))).toEqual(['20:15', '23:55', '03:30']);
  });

  it('⚠️ OMAD: il pasto sta in fondo alla finestra, non all\'inizio', () => {
    const d = derivaDaOrologio(19 * 60, '23:1');
    expect(d?.pasti).toHaveLength(1);
    expect(oraDelGiorno(d!.pasti[0].oraMin)).toBe('19:30');
  });

  /**
   * ⚠️ **Questo test prima non mordeva, e l'ha trovato la revisione.** Usava `oreFinestra: 1`, che
   * dà **un pasto solo**: quel ramo non usa né `primo` né `passo`, quindi la protezione sui margini
   * poteva sparire e i 39 test restavano verdi. Serve una finestra con **almeno due** pasti, dove
   * l'ultimo può davvero finire prima del primo.
   */
  it('⚠️ margini più larghi della finestra: si stringono, e l\'ultimo non finisce prima del primo', () => {
    const larghi = { primoDopoApertura: 150, ultimoPrimaChiusura: 150, arrotondaA: 5 };
    const pasti = orariDeiPasti(12 * 60, 4, SOGLIE_PASTI_PREDEFINITE, larghi);
    expect(pasti).toHaveLength(2);
    const scarti = pasti.map((x) => dentroLaGiornata(x.oraMin - 12 * 60));
    expect(scarti[1]).toBeGreaterThan(scarti[0]);
    for (const s of scarti) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(4 * 60);
    }
  });
});

describe('la finestra del motore si CERCA nella tabella, non si mappa qui', () => {
  it('ogni protocollo trova la sua riga in FINESTRE_DIGIUNO', () => {
    for (const p of PROTOCOLLI_DIGIUNO) {
      const d = derivaDaOrologio(12 * 60, p.valore);
      expect(d?.finestra).toBeDefined();
      expect(VALORI_FINESTRA_DIGIUNO).toContain(d!.fastingWindow);
    }
  });

  it('ogni riga delle soglie corrisponde a una riga vera della tabella', () => {
    for (const s of SOGLIE_PASTI_PREDEFINITE) {
      expect(finestraPerPasti(s.slots)?.valore).toBeDefined();
    }
  });

  /**
   * ⚠️ Il test che serve a non ripetere il difetto di Sonia dal davanti: un gruppo di pasti che in
   * tabella non c'è **non si ripiega** su una finestra vicina. Meglio «non lo so» che tre pasti a
   * chi ne aspetta due.
   */
  it('un gruppo di pasti che non esiste torna undefined, e non ripiega su una finestra vicina', () => {
    expect(finestraPerPasti(['breakfast'])).toBeUndefined();
    expect(finestraPerPasti(['morning_snack', 'afternoon_snack'])).toBeUndefined();
    expect(finestraPerPasti([])).toBeUndefined();
  });

  it('la riga trovata salta ESATTAMENTE i pasti che non ci sono', () => {
    for (const p of PROTOCOLLI_DIGIUNO) {
      const d = derivaDaOrologio(12 * 60, p.valore)!;
      const restano = new Set(d.pasti.map((x) => x.slot));
      for (const s of d.finestra!.salta) expect(restano.has(s)).toBe(false);
      expect(d.finestra!.salta).toHaveLength(5 - restano.size);
    }
  });
});

describe('quello che non si sa, si dice', () => {
  it('protocollo sconosciuto: undefined, non un ripiego sul 16:8', () => {
    expect(derivaDaOrologio(12 * 60, 'inventato')).toBeUndefined();
    expect(derivaDaOrologio(12 * 60, null)).toBeUndefined();
    expect(derivaDaOrologio(12 * 60, undefined)).toBeUndefined();
    expect(protocolloDigiuno('5:2')).toBeUndefined();
  });

  it('tabella delle soglie scritta male (nessuna riga da zero): niente pasti, niente invenzioni', () => {
    const monca = [{ oreMin: 20, slots: ['dinner' as const] }];
    expect(pastiDellaFinestra(8, monca)).toEqual([]);
    expect(orariDeiPasti(12 * 60, 8, monca)).toEqual([]);
  });
});

describe('i conti dell\'orologio', () => {
  it('la chiusura si calcola e gira attorno alla mezzanotte', () => {
    expect(chiusuraFinestra(12 * 60, 8)).toBe(20 * 60);
    expect(chiusuraFinestra(20 * 60, 8)).toBe(4 * 60);
    expect(chiusuraFinestra(0, 24)).toBe(0);
  });

  it('dentroLaGiornata regge anche i minuti negativi', () => {
    expect(dentroLaGiornata(-60)).toBe(23 * 60);
    expect(dentroLaGiornata(1500)).toBe(60);
  });

  it('oraDelGiorno scrive sempre due cifre', () => {
    expect(oraDelGiorno(0)).toBe('00:00');
    expect(oraDelGiorno(9 * 60 + 5)).toBe('09:05');
    expect(oraDelGiorno(23 * 60 + 59)).toBe('23:59');
  });
});

describe('il nome che legge la cliente non è il nome dello slot', () => {
  /**
   * ⚠️ È il caso che ha fatto nascere questa funzione: con la finestra al mattino il motore chiama
   * `lunch` il pasto delle 08:15, e scriverle «Pranzo alle 08:15» sarebbe dirle una cosa falsa.
   */
  it('finestra 08:00-16:00: «Primo pasto», non «Pranzo»', () => {
    const d = derivaDaOrologio(8 * 60, '16:8')!;
    const righe = d.pasti.map((p, i) => `${etichettaPasto(i, d.pasti.length, p.slot)} ${oraDelGiorno(p.oraMin)}`);
    expect(righe).toEqual(['Primo pasto 08:15', 'Spuntino 11:55', 'Ultimo pasto 15:30']);
  });

  it('con un pasto solo non esiste un «primo»', () => {
    expect(etichettaPasto(0, 1, 'dinner')).toBe('Il tuo pasto');
  });

  it('gli spuntini si chiamano spuntini ovunque stiano', () => {
    expect(etichettaPasto(1, 4, 'afternoon_snack')).toBe('Spuntino');
    expect(etichettaPasto(0, 3, 'morning_snack')).toBe('Spuntino');
  });

  it('nel mezzo di quattro pasti c\'è un «Pasto» senza aggettivi', () => {
    expect(etichettaPasto(1, 4, 'lunch')).toBe('Pasto');
  });

  /**
   * ⚠️ Oggi non è raggiungibile — l'unico pasto è sempre la cena — ma la funzione è pubblica e si
   * dichiara «il punto unico dei nomi»: se un giorno l'unica occasione fosse uno spuntino, chiamarla
   * «Spuntino» è comunque vero, e va scritto che è voluto e non un caso non gestito.
   */
  it('e se l\'unico pasto fosse uno spuntino, resta «Spuntino»: è vero lo stesso', () => {
    expect(etichettaPasto(0, 1, 'afternoon_snack')).toBe('Spuntino');
  });
});

describe('quante ore di digiuno passano dormendo (l\'indicatore del manuale)', () => {
  it('16:8 dalle 12 alle 20, sonno 23-07: otto ore su sedici', () => {
    expect(oreDigiunoNelSonno(12 * 60, 8, 23 * 60, 7 * 60)).toBeCloseTo(8, 1);
  });

  it('⚠️ finestra al mattino (08-16): del sonno si sovrappone tutto, ma il digiuno è lo stesso 16', () => {
    const ore = oreDigiunoNelSonno(8 * 60, 8, 23 * 60, 7 * 60);
    expect(ore).toBeCloseTo(8, 1);
  });

  /**
   * ⚠️ Il commento di `oreDigiunoNelSonno` dice che il caso in cui **entrambi** gli intervalli
   * scavalcano la mezzanotte «è quello che nessuno prova». Adesso qualcuno lo prova.
   */
  it('⚠️ finestra E sonno scavalcano tutti e due la mezzanotte', () => {
    // Finestra 20:00-04:00, sonno 23:00-07:00: sveglia 04-07 = 3 ore di digiuno dormendo.
    expect(oreDigiunoNelSonno(20 * 60, 8, 23 * 60, 7 * 60)).toBeCloseTo(3, 1);
  });

  it('⚠️ finestra di 24 ore: non si digiuna mai, quindi zero (e non una giornata intera)', () => {
    expect(oreDigiunoNelSonno(0, 24, 23 * 60, 7 * 60)).toBe(0);
  });

  it('chi dorme dentro la finestra di pasto non conta quelle ore', () => {
    // Sonno 13-15, dentro la finestra 12-20: nessuna di quelle ore è digiuno.
    expect(oreDigiunoNelSonno(12 * 60, 8, 13 * 60, 15 * 60)).toBe(0);
  });
});

describe('coerenza fra le due tabelle', () => {
  it('i cinque protocolli sono quelli del manuale, e il 5:2 non c\'è', () => {
    expect(PROTOCOLLI_DIGIUNO.map((p) => p.valore)).toEqual(['14:10', '16:8', '18:6', '20:4', '23:1']);
    // Il nome del protocollo dice le ore di digiuno: devono tornare con la finestra.
    for (const p of PROTOCOLLI_DIGIUNO) {
      const digiunoDichiarato = Number(p.valore.split(':')[0]);
      expect(digiunoDichiarato + p.oreFinestra).toBe(24);
    }
  });

  it('le soglie sono in ordine decrescente e coprono lo zero', () => {
    const ore = SOGLIE_PASTI_PREDEFINITE.map((s) => s.oreMin);
    expect([...ore].sort((a, b) => b - a)).toEqual(ore);
    expect(ore[ore.length - 1]).toBe(0);
  });

  it('più la finestra è lunga, più pasti ci stanno — mai il contrario', () => {
    let precedente = 0;
    for (const ore of [1, 3, 5, 7, 9, 12]) {
      const n = pastiDellaFinestra(ore).length;
      expect(n).toBeGreaterThanOrEqual(precedente);
      precedente = n;
    }
  });

  it('l\'ultimo pasto è sempre la cena: è quello che tiene vero `pastoPrincipale`', () => {
    for (const s of SOGLIE_PASTI_PREDEFINITE) {
      expect(s.slots[s.slots.length - 1]).toBe('dinner');
      expect(finestraPerPasti(s.slots)?.pastoPrincipale).toBe('cena');
    }
  });

  /**
   * ⚠️ Fissare una costante al suo stesso letterale non prova niente — me l'ha fatto notare la
   * revisione. Quello che serve sapere di questi due numeri è che **stiano dentro la finestra più
   * corta che il prodotto offre** (l'OMAD, un'ora): se qualcuno li alza da `config_param` senza
   * pensarci, l'unico pasto della giornata finisce fuori dalla finestra.
   */
  it('i margini stanno dentro la finestra più corta che offriamo (OMAD, un\'ora)', () => {
    const piuCorta = Math.min(...PROTOCOLLI_DIGIUNO.map((p) => p.oreFinestra)) * 60;
    expect(MARGINI_PREDEFINITI.primoDopoApertura + MARGINI_PREDEFINITI.ultimoPrimaChiusura).toBeLessThan(piuCorta);
    expect(MARGINI_PREDEFINITI.arrotondaA).toBeGreaterThan(0);
  });

  /**
   * ⛔ **Il taglio, dichiarato.** L'orologio produce quattro finestre su otto: le altre quattro
   * restano fuori, e chi le ha oggi non si migra senza guardarla una per una. Il test non giudica
   * se sia giusto — dice **quante** e **quali**, così il giorno che una soglia cambia qualcuno se
   * ne accorge invece di scoprirlo da una cliente che cambia menu.
   */
  it('⛔ l\'orologio raggiunge QUATTRO finestre su otto, e le altre quattro restano fuori', () => {
    expect(finestreRaggiungibili().sort()).toEqual(
      ['skip_all_but_dinner', 'skip_breakfast', 'skip_breakfast_and_snacks', 'skip_morning_snack'],
    );
    const fuori = VALORI_FINESTRA_DIGIUNO.filter((v) => !finestreRaggiungibili().includes(v));
    expect(fuori.sort()).toEqual(
      ['skip_breakfast_lunch', 'skip_dinner', 'skip_dinner_breakfast', 'skip_lunch'],
    );
  });

  it('le tre righe nuove della tabella sono raggiungibili dall\'orologio', () => {
    const raggiunti = new Set(
      PROTOCOLLI_DIGIUNO.map((p) => derivaDaOrologio(12 * 60, p.valore)?.fastingWindow),
    );
    for (const v of ['skip_morning_snack', 'skip_breakfast_and_snacks', 'skip_all_but_dinner']) {
      expect(raggiunti).toContain(v);
      expect(FINESTRE_DIGIUNO.some((f) => f.valore === v)).toBe(true);
    }
  });
});

describe('etichettaPasto con le fasce orarie — Lucia, 5/9', () => {
  /**
   * ⛔ **LA FASCIA VALE SOLO SE LO SLOT COINCIDE** (revisione, 5/9). Alle 08:15 con la finestra
   * 08:00–16:00 il motore serve uno slot `lunch`, cioè un pranzo: chiamarlo «Colazione» sarebbe la
   * frase falsa specchiata — promettere un pasto diverso da quello nel piatto.
   */
  it('⛔ il pasto delle 08:15 NON si chiama Colazione se quello che servi è un pranzo', () => {
    expect(etichettaPasto(0, 3, 'lunch', 8 * 60 + 15)).toBe('Primo pasto');
    // …ma una colazione vera alle 08:15 sì.
    expect(etichettaPasto(0, 3, 'breakfast', 8 * 60 + 15)).toBe('Colazione');
  });

  it('✅ con la finestra classica i nomi sono quelli veri: 12:15 Pranzo, 19:30 Cena', () => {
    expect(etichettaPasto(0, 3, 'lunch', 12 * 60 + 15)).toBe('Pranzo');
    expect(etichettaPasto(2, 3, 'dinner', 19 * 60 + 30)).toBe('Cena');
  });

  it('⚠️ fuori dalle fasce si torna alla posizione: un pasto alle 11 non è né colazione né pranzo', () => {
    expect(etichettaPasto(0, 3, 'lunch', 11 * 60)).toBe('Primo pasto');
    expect(etichettaPasto(0, 1, 'dinner', 17 * 60)).toBe('Il tuo pasto');
  });

  it('⚠️ senza l\'ora si comporta come prima: nessuna regressione per chi non la passa', () => {
    expect(etichettaPasto(0, 3, 'lunch')).toBe('Primo pasto');
    expect(etichettaPasto(2, 3, 'dinner')).toBe('Ultimo pasto');
  });

  it('⚠️ uno spuntino resta Spuntino a qualunque ora', () => {
    expect(etichettaPasto(1, 4, 'afternoon_snack', 12 * 60 + 30)).toBe('Spuntino');
  });
});
