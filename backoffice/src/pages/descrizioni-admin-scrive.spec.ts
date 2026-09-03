/**
 * ⛔ **L'ADMIN SCRIVE LE DESCRIZIONI — e il pulsante e la rotta si muovono insieme.**
 *
 * Simone, 3/9: *«qui dovrei poter modificare le descrizioni che poi le clienti leggono sull'app»*, e
 * vedeva «sola lettura» su tutte le righe. Il 22/8 era una scelta: `PATCH famiglia/product`
 * ereditava `@Roles('nutritionist', 'head_nutritionist')` dal controller, e un pulsante che si vede
 * e risponde 403 è peggio di un pulsante che non c'è.
 *
 * ⛔ Le strade erano due — togliere il pulsante o aprire la rotta — e aprirne **una sola** rifà
 * esattamente il difetto che quella nota descriveva. Questa prova tiene ferme tutte e due.
 */
import { describe, expect, it } from 'vitest';

const pagina = Object.values(
  import.meta.glob('./DescrizioniDiete.tsx', { query: '?raw', import: 'default', eager: true }),
)[0] as string;
const controller = Object.values(
  import.meta.glob('../../../backend/src/catalog/catalog.controller.ts', { query: '?raw', import: 'default', eager: true }),
)[0] as string | undefined;

describe('chi può scrivere le descrizioni delle diete', () => {
  it('⛔ il pulsante si mostra anche all\'admin', () => {
    expect(pagina).toMatch(/eNutrizionista\(user\?\.role\) \|\| user\?\.role === 'admin'/);
  });

  /**
   * ⚠️ La prova guarda il **backend** da qui, ed è voluto: è l'unico punto in cui le due metà si
   * possono confrontare. Se un giorno il file non fosse raggiungibile, la prova lo dice invece di
   * passare in silenzio.
   */
  it('⛔ e la rotta che salva ammette l\'admin: senza, il pulsante risponderebbe 403', () => {
    expect(controller).toBeDefined();
    const rotta = (controller ?? '').slice(0, (controller ?? '').indexOf("@Patch('famiglia/product')"));
    expect(rotta.slice(-400)).toMatch(/@Roles\('nutritionist', 'head_nutritionist', 'admin'\)/);
  });

  /**
   * ⛔ **E la visibilità alle clienti resta al capo nutrizionista.** Da questa rotta si scrivono i
   * tre campi del testo: aprirla all'admin non gli dà di accendere una dieta alle clienti.
   */
  it('⛔ dalla rotta dei testi non passa la visibilità', () => {
    const dto = Object.values(
      import.meta.glob('../../../backend/src/catalog/dto/catalog.dto.ts', { query: '?raw', import: 'default', eager: true }),
    )[0] as string | undefined;
    expect(dto).toBeDefined();
    const blocco = (dto ?? '').slice((dto ?? '').indexOf('class UpdateFamilyProductDto'));
    const corpo = blocco.slice(0, blocco.indexOf('\n}'));
    expect(corpo).toMatch(/clientDescription/);
    // ⛔ I tre campi del testo, e nient'altro: la vetrina resta al capo nutrizionista.
    expect(corpo).not.toMatch(/clientVisible/);
    expect(corpo).not.toMatch(/status/);
  });
});
