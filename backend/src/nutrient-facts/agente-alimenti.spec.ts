import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHIAVE_ACCESO, CHIAVE_MAX, SYSTEM, contaTag, fonteDellaRiga, kcalTornano, prompt, tagDallaTabella, vaglia, type RispostaGrezza,
} from './agente-alimenti';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';

/**
 * ⛔ **IL VAGLIO È LA PARTE CHE CONTA**: l'AI risponde, qui si decide se entra. Ogni prova che boccia
 * è un modo in cui una risposta plausibile a vista sarebbe finita in tabella — e da lì nel conto di
 * una ricetta e nei tag di chi ha un'allergia.
 */

const buona = (extra: Partial<RispostaGrezza> = {}): RispostaGrezza => ({
  e_un_alimento: true,
  nome: 'taleggio',
  categoria: 'formaggi',
  stato: 'crudo',
  kcal: 315, proteine: 19, carboidrati: 0.9, zuccheri: 0.9, grassi: 26, fibre: 0, alcol: 0,
  allergeni: ['latte'],
  fonte: { nome: 'CREA – Tabelle di composizione', url: 'https://www.crea.gov.it/alimenti/taleggio' },
  affidabilita: 'solida',
  ...extra,
});

describe('vaglia — cosa entra in tabella', () => {
  it('✅ una risposta completa e coerente entra, normalizzata, con gli allergeni e la fonte', () => {
    const v = vaglia('Taleggio', buona(), []);
    expect(v.esito).toBe('ok');
    if (v.esito !== 'ok') return;
    expect(v.riga.name).toBe('taleggio');
    expect(v.riga.allergens).toEqual(['latte']);
    expect(v.riga.risolve).toBe(true);
    expect(v.riga.sourceRef).toBe('https://www.crea.gov.it/alimenti/taleggio');
    expect(v.riga.source).toBe('CREA – Tabelle di composizione');
    expect(v.riga.state).toBe('crudo');
    expect(v.riga.affidabilita).toBe('solida');
  });

  it('⚠️ «non è un alimento» è un esito suo, non uno scarto', () => {
    expect(vaglia('q.b.', buona({ e_un_alimento: false }), [])).toEqual({ esito: 'non_alimento' });
  });

  it('⛔ senza fonte con un indirizzo non entra: un numero senza fonte è un numero a memoria (11/8)', () => {
    expect(vaglia('x', buona({ fonte: { nome: 'CREA' } }), [])).toMatchObject({ esito: 'scartata', motivo: 'senza_fonte' });
    expect(vaglia('x', buona({ fonte: { nome: 'CREA', url: 'crea.gov.it' } }), [])).toMatchObject({ esito: 'scartata', motivo: 'senza_fonte' });
  });

  it('⛔ senza kcal non entra: senza kcal il conto della ricetta lo salta e il buco sparisce dalla lista', () => {
    expect(vaglia('x', buona({ kcal: null }), [])).toMatchObject({ esito: 'scartata', motivo: 'senza_kcal' });
    expect(vaglia('x', buona({ kcal: 'n.d.' }), [])).toMatchObject({ esito: 'scartata', motivo: 'numero_illeggibile' });
  });

  it('⛔ un numero fuori scala o negativo boccia la riga (kcal -500 sottrae dal totale); uno illeggibile ha il suo motivo', () => {
    expect(vaglia('x', buona({ grassi: -3 }), [])).toMatchObject({ esito: 'scartata', motivo: 'numero_fuori_scala' });
    expect(vaglia('x', buona({ kcal: 1200 }), [])).toMatchObject({ esito: 'scartata', motivo: 'numero_fuori_scala' });
    expect(vaglia('x', buona({ fibre: 'tante' }), [])).toMatchObject({ esito: 'scartata', motivo: 'numero_illeggibile', dettaglio: 'fibre = tante' });
    // ⚠️ Lo strutto ha 902 kcal: 900 non era «fuori scala».
    expect(vaglia('strutto', buona({ kcal: 902, proteine: 0, carboidrati: 0, zuccheri: 0, grassi: 99.5, allergeni: [] }), [])).toMatchObject({ esito: 'ok' });
  });

  it('⛔ lo STATO è obbligatorio: senza, la riga chiude il termine e lascia il conto della ricetta dov\'era', () => {
    expect(vaglia('x', buona({ stato: null }), [])).toMatchObject({ esito: 'scartata', motivo: 'senza_stato' });
    // «tostato» è una lavorazione che nessuno sa leggere («altro» in `stato-alimento.ts`): non entra.
    expect(vaglia('x', buona({ stato: 'tostato' }), [])).toMatchObject({ esito: 'scartata', motivo: 'senza_stato' });
  });

  it('⚠️ «cotto» entra ma NON risolve: il termine resta nella lista di lavoro come «solo da cotto»', () => {
    const v = vaglia('ceci lessati', buona({ stato: 'lessati' }), []);
    expect(v).toMatchObject({ esito: 'ok' });
    if (v.esito === 'ok') expect([v.riga.state, v.riga.risolve]).toEqual(['bollito', false]);
    const na = vaglia('olio evo', buona({ stato: 'non si applica', kcal: 884, proteine: 0, carboidrati: 0, zuccheri: 0, grassi: 100, allergeni: [] }), []);
    if (na.esito === 'ok') expect([na.riga.state, na.riga.risolve]).toEqual(['non_applicabile', true]);
  });

  it('✅ il vino torna coi conti grazie all\'alcol (7 kcal/g)', () => {
    expect(vaglia('vino bianco', buona({ kcal: 82, proteine: 0.1, carboidrati: 2.6, zuccheri: 1, grassi: 0, alcol: 10.5, allergeni: ['solfiti'] }), [])).toMatchObject({ esito: 'ok' });
    expect(vaglia('vino bianco', buona({ kcal: 82, proteine: 0.1, carboidrati: 2.6, zuccheri: 1, grassi: 0, alcol: 0, allergeni: ['solfiti'] }), [])).toMatchObject({ esito: 'scartata', motivo: 'kcal_incoerenti' });
  });

  it('⛔ le kcal che non tornano coi macro bocciano (315 kcal con 2 g di tutto)', () => {
    expect(vaglia('x', buona({ proteine: 2, carboidrati: 2, grassi: 2 }), [])).toMatchObject({ esito: 'scartata', motivo: 'kcal_incoerenti' });
  });

  it('⛔ zuccheri oltre i carboidrati bocciano', () => {
    expect(vaglia('x', buona({ carboidrati: 5, zuccheri: 12 }), [])).toMatchObject({ esito: 'scartata', motivo: 'zuccheri_oltre_carboidrati' });
  });

  it('⛔ un allergene che non è uno dei quattordici codici boccia TUTTA la riga, non cade in silenzio', () => {
    expect(vaglia('x', buona({ allergeni: ['latte', 'lattosio'] }), [])).toMatchObject({ esito: 'scartata', motivo: 'allergene_sconosciuto', dettaglio: 'lattosio' });
  });

  it('✅ «frutta a guscio» scritto con gli spazi si legge come il codice', () => {
    const v = vaglia('pesto', buona({ allergeni: ['Frutta-a-guscio', 'latte'] }), []);
    expect(v).toMatchObject({ esito: 'ok' });
    if (v.esito === 'ok') expect(v.riga.allergens).toEqual(['frutta_a_guscio', 'latte']);
  });

  it('⛔ la GEMELLA: stessi valori di due alimenti che non c\'entrano niente → è una copia (lezione del 20/8)', () => {
    const esistenti = [
      { name: 'tahina', kcal: 315, protein: 19, carbs: 0.9, sugars: 0.9, fat: 26, fiber: 0 },
      { name: 'peperone rosso', kcal: 315, protein: 19, carbs: 0.9, sugars: 0.9, fat: 26, fiber: 0 },
    ];
    expect(vaglia('taleggio', buona(), esistenti)).toMatchObject({ esito: 'scartata', motivo: 'gemella' });
  });

  it('✅ ma «taleggio dop» con gli stessi valori di «taleggio» e «taleggio fresco» passa: è lo stesso alimento', () => {
    const esistenti = [
      { name: 'taleggio', kcal: 315, protein: 19, carbs: 0.9, sugars: 0.9, fat: 26, fiber: 0 },
      { name: 'taleggio fresco', kcal: 315, protein: 19, carbs: 0.9, sugars: 0.9, fat: 26, fiber: 0 },
    ];
    expect(vaglia('taleggio dop', buona(), esistenti)).toMatchObject({ esito: 'ok' });
  });

  it('⚠️ affidabilità fuori elenco non boccia: diventa «debole», e la fonte lo dice', () => {
    const v = vaglia('x', buona({ affidabilita: 'altissima' }), []);
    expect(v).toMatchObject({ esito: 'ok' });
    if (v.esito === 'ok') {
      expect(v.riga.affidabilita).toBe('debole');
      expect(fonteDellaRiga(v.riga)).toBe('CREA – Tabelle di composizione (affidabilità debole)');
    }
  });

  it('⚠️ risposta nulla → risposta_vuota', () => {
    expect(vaglia('x', null, [])).toMatchObject({ esito: 'scartata', motivo: 'risposta_vuota' });
  });
});

describe('kcalTornano', () => {
  it('sotto le 50 kcal non si guarda; sopra, tolleranza del 35% o 40 kcal', () => {
    expect(kcalTornano(20, 1, 4, 0.2)).toBe(true);
    expect(kcalTornano(100, 5, 10, 4)).toBe(true); // 96
    expect(kcalTornano(300, 5, 10, 4)).toBe(false);
    expect(kcalTornano(300, null, null, null)).toBe(true);
  });
});

describe('il prompt', () => {
  it('⛔ il sistema elenca i quattordici codici, così l\'AI non ne inventa', () => {
    for (const c of EU_ALLERGEN_CODES) expect(SYSTEM).toContain(c);
    expect(SYSTEM).toMatch(/senza lattosio/);
    expect(SYSTEM).toMatch(/A CRUDO/);
    expect(SYSTEM).toMatch(/non_applicabile/);
  });
  it('mette il nome e al massimo tre ricette di esempio', () => {
    const p = prompt('taleggio', ['A', 'B', 'C', 'D']);
    expect(p).toContain('«taleggio»');
    expect(p).toContain('«C»');
    expect(p).not.toContain('«D»');
  });
});

describe('tagDallaTabella — dalla riga alimento alla ricetta', () => {
  const righe = [
    { name: 'pesto pronto', synonyms: ['pesto alla genovese pronto'], allergens: ['latte', 'frutta_a_guscio'] },
    { name: 'latte', synonyms: [], allergens: ['latte'] },
    { name: 'riso basmati', synonyms: [], allergens: [] },
  ];

  it('✅ aggiunge i tag che mancano, una volta per allergene, dicendo da quale ingrediente', () => {
    const tag = tagDallaTabella([
      { id: 'r1', name: 'Pasta al pesto', ingredients: [{ name: 'Pesto pronto' }, { name: 'pasta' }], allergens: ['glutine'] },
    ], righe);
    expect(tag).toEqual([
      { recipeId: 'r1', ricetta: 'Pasta al pesto', allergen: 'latte', ingrediente: 'Pesto pronto', alimento: 'pesto pronto' },
      { recipeId: 'r1', ricetta: 'Pasta al pesto', allergen: 'frutta_a_guscio', ingrediente: 'Pesto pronto', alimento: 'pesto pronto' },
    ]);
  });

  it('✅ il sinonimo vale come il nome', () => {
    const tag = tagDallaTabella([{ id: 'r1', name: 'x', ingredients: [{ name: 'pesto alla genovese pronto' }], allergens: [] }], righe);
    expect(tag.map((t) => t.allergen)).toEqual(['latte', 'frutta_a_guscio']);
  });

  it('⛔ UGUALE, non «contiene»: «latte di mandorla» non prende il latte dalla riga «latte»', () => {
    expect(tagDallaTabella([{ id: 'r1', name: 'x', ingredients: [{ name: 'latte di mandorla' }], allergens: [] }], righe)).toEqual([]);
  });

  it('⚠️ mai toglie: un tag già scritto resta e non si ripete; una riga senza allergeni non dice niente', () => {
    expect(tagDallaTabella([{ id: 'r1', name: 'x', ingredients: [{ name: 'latte' }, { name: 'riso basmati' }], allergens: ['latte', 'uova'] }], righe)).toEqual([]);
  });

  it('⛔ la ricetta toccata a mano non si tocca', () => {
    expect(tagDallaTabella([{ id: 'r1', name: 'x', ingredients: [{ name: 'latte' }], allergens: [], toccataAMano: true }], righe)).toEqual([]);
  });

  it('contaTag: ricette distinte e per allergene', () => {
    const tag = tagDallaTabella([
      { id: 'r1', name: 'A', ingredients: [{ name: 'pesto pronto' }], allergens: [] },
      { id: 'r2', name: 'B', ingredients: [{ name: 'latte' }], allergens: [] },
    ], righe);
    const c = contaTag(tag);
    expect(c.ricette).toBe(2);
    expect(c.perAllergene[0]).toMatchObject({ allergen: 'latte', label: 'Latte e derivati', ricette: 2 });
  });
});

describe('⛔ le porte, lette nei sorgenti', () => {
  const radice = join(__dirname, '..', '..');
  const leggi = (p: string) => readFileSync(join(radice, p), 'utf8');

  it('⛔ il cron ha il passo, DOPO gli alimenti da correggere (che riempiono la sua coda)', () => {
    const src = leggi('src/cron/cron.controller.ts');
    const coda = src.indexOf("step('alimentiDaCorreggere'");
    const agente = src.indexOf("step('agenteAlimenti'");
    expect(coda).toBeGreaterThan(-1);
    expect(agente).toBeGreaterThan(coda);
  });

  it('⚠️ il seed porta le due righe, spento e col tetto: le caselle compaiono nei Parametri senza doverle creare', () => {
    const seed = leggi('prisma/seed.ts');
    expect(seed).toMatch(new RegExp(`key: '${CHIAVE_ACCESO}',\\s*value: 'false'`));
    expect(seed).toMatch(new RegExp(`key: '${CHIAVE_MAX}',\\s*value: '20'`));
  });

  it('⚠️ la migrazione della colonna esiste e dice che vuoto vuol dire «non si sa»', () => {
    const sql = leggi('prisma/migrations/20260905120000_allergeni_sull_alimento/migration.sql');
    expect(sql).toContain('ADD COLUMN "allergens"');
    expect(sql).toMatch(/NON SI SA/);
  });
});
