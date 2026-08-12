/**
 * La settimana tipo del nutrizionista, srotolata in orari veri.
 *
 * I due gruppi che contano di più sono il cambio dell'ora — due domeniche l'anno in cui una
 * cliente si presenterebbe a un'ora che nessuno le ha detto — e le sovrapposizioni, che è dove
 * Simone ha chiesto di fermare il problema: «collisioni impossibili, non consentiamo
 * sovrapposizioni alla creazione».
 */
import {
  erroreDelloSlot,
  istanteRomano,
  minutiDaOra,
  occorrenze,
  offsetRomaMinuti,
  oraDaMinuti,
  siAccavallano,
  slotInConflitto,
  type SlotDefinito,
} from './settimana-tipo';

const slot = (p: Partial<SlotDefinito> & { id: string }): SlotDefinito => ({
  weekday: null,
  data: null,
  inizioMin: 9 * 60,
  fineMin: 10 * 60,
  ripete: false,
  ...p,
});

// Lunedì = 1. Il 2026-08-17 è un lunedì, il 2026-08-18 un martedì.
const LUNEDI = 1;

describe('settimana tipo', () => {
  describe('gli orari', () => {
    it('si leggono e si riscrivono uguali', () => {
      expect(minutiDaOra('09:05')).toBe(545);
      expect(minutiDaOra('00:00')).toBe(0);
      expect(minutiDaOra('23:59')).toBe(1439);
      expect(oraDaMinuti(545)).toBe('09:05');
      expect(oraDaMinuti(0)).toBe('00:00');
    });

    it('un orario che non esiste non diventa un numero a caso', () => {
      expect(minutiDaOra('25:00')).toBeNull();
      expect(minutiDaOra('10:75')).toBeNull();
      expect(minutiDaOra('mattina')).toBeNull();
      expect(minutiDaOra('')).toBeNull();
    });
  });

  describe('⚠️ il cambio dell\'ora', () => {
    it('d\'inverno Roma è un\'ora avanti, d\'estate due', () => {
      expect(offsetRomaMinuti(new Date('2026-01-15T12:00:00Z'))).toBe(60);
      expect(offsetRomaMinuti(new Date('2026-07-15T12:00:00Z'))).toBe(120);
    });

    it('«le 10 del mattino» è un istante diverso a gennaio e a luglio', () => {
      expect(istanteRomano('2026-01-15', 10 * 60).toISOString()).toBe('2026-01-15T09:00:00.000Z');
      expect(istanteRomano('2026-07-15', 10 * 60).toISOString()).toBe('2026-07-15T08:00:00.000Z');
    });

    it('il giorno in cui le lancette vanno avanti (ultima domenica di marzo)', () => {
      // 2026-03-29: alle 02:00 romane si passa alle 03:00. Uno slot delle 10 quel giorno è già
      // ora legale, quindi le 08:00 UTC. È il caso che la seconda passata di `istanteRomano`
      // esiste per non sbagliare.
      expect(istanteRomano('2026-03-29', 10 * 60).toISOString()).toBe('2026-03-29T08:00:00.000Z');
      // Alle 01:00, invece, l'ora legale non è ancora entrata: +1.
      expect(istanteRomano('2026-03-29', 60).toISOString()).toBe('2026-03-29T00:00:00.000Z');
    });

    it('il giorno in cui vanno indietro (ultima domenica di ottobre)', () => {
      expect(istanteRomano('2026-10-25', 10 * 60).toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });

    it('il giorno prima e il giorno dopo il cambio restano coerenti', () => {
      expect(istanteRomano('2026-03-28', 10 * 60).toISOString()).toBe('2026-03-28T09:00:00.000Z');
      expect(istanteRomano('2026-03-30', 10 * 60).toISOString()).toBe('2026-03-30T08:00:00.000Z');
    });
  });

  describe('⚠️ le sovrapposizioni si fermano alla creazione', () => {
    it('due slot attaccati NON si accavallano: 9-10 e 10-11 è la giornata più normale che esista', () => {
      expect(siAccavallano({ inizioMin: 540, fineMin: 600 }, { inizioMin: 600, fineMin: 660 })).toBe(false);
    });

    it('un minuto in comune basta', () => {
      expect(siAccavallano({ inizioMin: 540, fineMin: 600 }, { inizioMin: 599, fineMin: 660 })).toBe(true);
    });

    it('uno dentro l\'altro si accavalla', () => {
      expect(siAccavallano({ inizioMin: 540, fineMin: 660 }, { inizioMin: 570, fineMin: 600 })).toBe(true);
    });

    it('due ricorrenti dello stesso giorno che si toccano: conflitto', () => {
      const esistente = slot({ id: 'a', ripete: true, weekday: LUNEDI, inizioMin: 540, fineMin: 600 });
      const nuovo = slot({ id: 'b', ripete: true, weekday: LUNEDI, inizioMin: 570, fineMin: 630 });
      expect(slotInConflitto(nuovo, [esistente])?.id).toBe('a');
    });

    it('due ricorrenti di giorni DIVERSI non si toccano mai', () => {
      const esistente = slot({ id: 'a', ripete: true, weekday: LUNEDI, inizioMin: 540, fineMin: 600 });
      const nuovo = slot({ id: 'b', ripete: true, weekday: 2, inizioMin: 540, fineMin: 600 });
      expect(slotInConflitto(nuovo, [esistente])).toBeNull();
    });

    it('⚠️ un ricorrente del lunedì blocca anche uno una tantum di UN lunedì', () => {
      // È il caso che si dimentica: il ricorrente tocca tutti i lunedì, quindi anche quello lì.
      const ricorrente = slot({ id: 'a', ripete: true, weekday: LUNEDI, inizioMin: 540, fineMin: 600 });
      const unaTantum = slot({ id: 'b', ripete: false, data: '2026-08-17', inizioMin: 570, fineMin: 630 });
      expect(slotInConflitto(unaTantum, [ricorrente])?.id).toBe('a');
      // E vale anche al contrario.
      expect(slotInConflitto(ricorrente, [unaTantum])?.id).toBe('b');
    });

    it('due una tantum in GIORNI diversi non si toccano, anche alla stessa ora', () => {
      const a = slot({ id: 'a', data: '2026-08-17', inizioMin: 540, fineMin: 600 });
      const b = slot({ id: 'b', data: '2026-08-18', inizioMin: 540, fineMin: 600 });
      expect(slotInConflitto(b, [a])).toBeNull();
    });

    it('uno slot non è mai in conflitto con se stesso (modifica)', () => {
      const a = slot({ id: 'a', ripete: true, weekday: LUNEDI });
      expect(slotInConflitto(a, [a])).toBeNull();
    });
  });

  describe('uno slot scritto male non nasce', () => {
    it('la fine deve venire dopo l\'inizio', () => {
      expect(erroreDelloSlot({ inizioMin: 600, fineMin: 540, ripete: true, weekday: 1, data: null })).toMatch(/dopo/);
      expect(erroreDelloSlot({ inizioMin: 600, fineMin: 600, ripete: true, weekday: 1, data: null })).toMatch(/dopo/);
    });

    it('durate assurde: cinque minuti è un refuso, otto ore non è uno slot', () => {
      expect(erroreDelloSlot({ inizioMin: 540, fineMin: 545, ripete: true, weekday: 1, data: null })).toMatch(/10 minuti/);
      expect(erroreDelloSlot({ inizioMin: 0, fineMin: 600, ripete: true, weekday: 1, data: null })).toMatch(/8 ore/);
    });

    it('«si ripete» senza giorno, o una tantum senza data, non si salvano', () => {
      expect(erroreDelloSlot({ inizioMin: 540, fineMin: 600, ripete: true, weekday: null, data: null })).toMatch(/giorno della settimana/);
      expect(erroreDelloSlot({ inizioMin: 540, fineMin: 600, ripete: false, weekday: null, data: null })).toMatch(/data/);
    });

    it('uno slot giusto non ha errori', () => {
      expect(erroreDelloSlot({ inizioMin: 540, fineMin: 600, ripete: true, weekday: 1, data: null })).toBeNull();
      expect(erroreDelloSlot({ inizioMin: 605, fineMin: 670, ripete: false, weekday: null, data: '2026-08-17' })).toBeNull();
    });
  });

  describe('la settimana tipo srotolata', () => {
    const settimana: SlotDefinito[] = [
      slot({ id: 's1', ripete: true, weekday: LUNEDI, inizioMin: 540, fineMin: 600 }), // 9:00-10:00
      slot({ id: 's2', ripete: true, weekday: LUNEDI, inizioMin: 605, fineMin: 670 }), // 10:05-11:10
    ];

    it('due slot del lunedì diventano due orari per ogni lunedì dell\'intervallo', () => {
      // 2026-08-17 e 2026-08-24 sono due lunedì.
      const o = occorrenze(settimana, [], '2026-08-15', '2026-08-25');
      expect(o).toHaveLength(4);
      expect(o.map((x) => `${x.data} ${x.inizioMin}`)).toEqual([
        '2026-08-17 540', '2026-08-17 605', '2026-08-24 540', '2026-08-24 605',
      ]);
    });

    it('le FERIE tolgono le occorrenze, e la settimana tipo resta scritta', () => {
      const o = occorrenze(settimana, [{ dal: '2026-08-17', al: '2026-08-17' }], '2026-08-15', '2026-08-25');
      expect(o.map((x) => x.data)).toEqual(['2026-08-24', '2026-08-24']);
    });

    it('un periodo di ferie chiude tutti i giorni che contiene, estremi compresi', () => {
      const o = occorrenze(settimana, [{ dal: '2026-08-16', al: '2026-08-24' }], '2026-08-15', '2026-08-25');
      expect(o).toHaveLength(0);
    });

    it('⚠️ i FESTIVI si chiudono da soli: nessuno deve ricordarsene', () => {
      // Lunedì 2026-12-07 è normale, ma l'8 dicembre (Immacolata) cade di martedì; prendiamo un
      // festivo che cade di lunedì: il 2026-04-06 è il lunedì dell'Angelo.
      const o = occorrenze(settimana, [], '2026-04-05', '2026-04-07');
      expect(o).toHaveLength(0);
    });

    it('uno slot una tantum vale solo quel giorno', () => {
      const straordinario = [slot({ id: 'x', data: '2026-08-19', inizioMin: 900, fineMin: 960 })];
      expect(occorrenze(straordinario, [], '2026-08-15', '2026-08-25').map((x) => x.data)).toEqual(['2026-08-19']);
    });

    it('gli orari escono in ordine di giorno e poi di ora', () => {
      const disordinati = [
        slot({ id: 'tardi', ripete: true, weekday: LUNEDI, inizioMin: 605, fineMin: 670 }),
        slot({ id: 'presto', ripete: true, weekday: LUNEDI, inizioMin: 540, fineMin: 600 }),
      ];
      const o = occorrenze(disordinati, [], '2026-08-17', '2026-08-17');
      expect(o.map((x) => x.slotId)).toEqual(['presto', 'tardi']);
    });

    it('senza slot, o con un intervallo al contrario, non torna niente e non cade nulla', () => {
      expect(occorrenze([], [], '2026-08-15', '2026-08-25')).toEqual([]);
      expect(occorrenze(settimana, [], '2026-08-25', '2026-08-15')).toEqual([]);
    });
  });
});
