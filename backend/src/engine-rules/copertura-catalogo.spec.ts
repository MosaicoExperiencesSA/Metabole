import { coperturaCatalogo, slotAttesi, statoCopertura, type CoperturaVariante } from './copertura-catalogo';

/**
 * LA TABELLA CHE DISTINGUE LE IPOTESI (11/8).
 *
 * Segnalazione: «dice settimana creata e validata, poi ci torno sopra ed è vuota». Le cause possibili
 * sono tre, e portano a tre correzioni diverse: mai generata, generata e non validata, oppure generata
 * e con i piatti **cancellati sotto** (le giornate restano, i pasti diventano buchi).
 *
 * Questi test fissano la distinzione. Se un domani `statoCopertura` confondesse «da validare» con
 * «magra», la tabella tornerebbe a dire «guarda meglio» invece di dire cosa è successo.
 */
const variante = (over: Partial<CoperturaVariante> & { perSlot?: Record<string, { piatti: number; attivi: number; rotti: number }> }): CoperturaVariante => ({
  dietId: 'd1',
  giorni: 7,
  ultimoGiorno: 7,
  settimane: 1,
  perSlot: {},
  ...over,
});

const pieno = (piatti: number, attivi = piatti, rotti = 0) => ({ piatti, attivi, rotti });

describe('statoCopertura — la diagnosi in una parola', () => {
  const tre = slotAttesi(3, false);

  it('nessuna giornata: vuota', () => {
    expect(statoCopertura(variante({ giorni: 0, settimane: 0 }), tre).stato).toBe('vuota');
    expect(statoCopertura(undefined, tre).stato).toBe('vuota');
  });

  it('sette piatti per pasto su una settimana: completa', () => {
    const c = variante({ perSlot: { breakfast: pieno(7), lunch: pieno(7), dinner: pieno(7) } });
    expect(statoCopertura(c, tre)).toEqual({ stato: 'completa', dettaglio: '1 settimane piene' });
  });

  it('i piatti ci sono ma NESSUNO è attivo: da validare — è il caso che sembra «vuota» da fuori', () => {
    const c = variante({ perSlot: { breakfast: pieno(7, 0), lunch: pieno(7, 0), dinner: pieno(7, 0) } });
    const esito = statoCopertura(c, tre);
    expect(esito.stato).toBe('da_validare');
    expect(esito.dettaglio).toContain('manca la validazione');
  });

  it('meno piatti del necessario: magra, e dice su quali pasti', () => {
    const c = variante({ perSlot: { breakfast: pieno(7), lunch: pieno(3), dinner: pieno(7) } });
    const esito = statoCopertura(c, tre);
    expect(esito.stato).toBe('magra');
    expect(esito.dettaglio).toContain('lunch');
    expect(esito.dettaglio).not.toContain('dinner');
  });

  it('riferimenti ROTTI: vince su tutto il resto, perché è il difetto peggiore', () => {
    // Piatti a sufficienza, tutti attivi, ma tre giornate nominano ricette cancellate.
    const c = variante({ perSlot: { breakfast: pieno(7), lunch: { piatti: 7, attivi: 7, rotti: 3 }, dinner: pieno(7) } });
    const esito = statoCopertura(c, tre);
    expect(esito.stato).toBe('rotta');
    expect(esito.dettaglio).toContain('non esistono più');
  });

  it('validata a metà è «magra» o «completa», non «da validare»: da validare vale solo se non è attivo NIENTE', () => {
    const c = variante({ perSlot: { breakfast: pieno(7), lunch: pieno(7, 3), dinner: pieno(7) } });
    expect(statoCopertura(c, tre).stato).toBe('completa');
  });

  it('su 12 settimane l\'atteso è 84 piatti per pasto', () => {
    const c = variante({ settimane: 12, giorni: 84, ultimoGiorno: 84, perSlot: { breakfast: pieno(84), lunch: pieno(84), dinner: pieno(80) } });
    const esito = statoCopertura(c, tre);
    expect(esito.stato).toBe('magra');
    expect(esito.dettaglio).toContain('84');
  });
});

describe('slotAttesi — i pasti che una struttura prevede', () => {
  it('5 pasti: tutti e cinque', () => {
    expect(slotAttesi(5, false)).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('3 pasti: colazione, pranzo, cena', () => {
    expect(slotAttesi(3, false)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('digiuno 16:8: NIENTE colazione, e non è un buco', () => {
    // Il difetto che questo previene: contare la colazione mancante come pasto vuoto e mostrare in
    // rosso tutte le varianti a digiuno intermittente.
    expect(slotAttesi(3, true)).toEqual(['lunch', 'afternoon_snack', 'dinner']);
    expect(slotAttesi(3, true)).not.toContain('breakfast');
  });
});

describe('coperturaCatalogo — i conteggi li fa il database', () => {
  const finto = (giornate: unknown[], pasti: unknown[]) => {
    const sql: string[] = [];
    let i = 0;
    return {
      sql,
      prisma: {
        $queryRaw: (strings: TemplateStringsArray) => {
          sql.push(strings.join('?'));
          return Promise.resolve(i++ === 0 ? giornate : pasti);
        },
      },
    };
  };

  it('apre il JSON dei pasti in SQL e usa un LEFT JOIN per vedere i riferimenti rotti', async () => {
    const { prisma, sql } = finto([], []);
    await coperturaCatalogo(prisma);
    const query = sql.join(' ');
    expect(query).toContain('jsonb_array_elements');
    // LEFT e non INNER: con un join interno i riferimenti rotti sparirebbero invece di contarsi,
    // e la tabella direbbe «tutto a posto» proprio nel caso che stiamo cercando.
    expect(query).toContain('LEFT JOIN recipe');
    expect(query).toContain('COUNT(DISTINCT');
  });

  it('mette insieme giornate e pasti per variante, e calcola le settimane', async () => {
    const { prisma } = finto(
      [{ dietId: 'd1', giorni: 84, ultimoGiorno: 84 }],
      [{ dietId: 'd1', slot: 'lunch', piatti: 84, attivi: 84, rotti: 0 }],
    );
    const out = await coperturaCatalogo(prisma);
    expect(out.get('d1')!.settimane).toBe(12);
    expect(out.get('d1')!.perSlot.lunch).toEqual({ piatti: 84, attivi: 84, rotti: 0 });
  });

  it('una variante con pasti ma senza giornate contate compare comunque: una riga in più si nota, una mancante no', async () => {
    const { prisma } = finto([], [{ dietId: 'd9', slot: 'lunch', piatti: 3, attivi: 0, rotti: 1 }]);
    const out = await coperturaCatalogo(prisma);
    expect(out.get('d9')).toBeDefined();
    expect(out.get('d9')!.settimane).toBe(0);
  });
});
