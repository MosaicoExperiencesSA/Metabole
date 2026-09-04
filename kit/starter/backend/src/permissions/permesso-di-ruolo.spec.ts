/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — test dei permessi. Manuale: kit/manuale/03-permessi.md
 * Cosa impedisce: tiene ferma la lettura del permesso di un ruolo.
 * ⚠️ Va ADATTATO alle chiavi del tuo progetto, non tolto: e' uno dei quattro modi
 *    in cui un sistema di permessi mente, e ognuno qui ha trovato un difetto vero.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ruoloPuo } from './permesso-di-ruolo';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * IL CANCELLO CHE SI PUÒ SPOSTARE DALLA PAGINA PERMESSI.
 *
 * Questi test dicono una cosa sola, ma è quella che Simone ha chiesto l'11/8: se in pagina Permessi
 * si accende «Conversazioni della cliente» per un ruolo, quel ruolo può; se si spegne, non può. Prima
 * la risposta era un elenco di ruoli scritto nel codice, e la riga nel database non contava niente:
 * un interruttore che non accende nulla è peggio di un interruttore assente.
 */
const finto = (riga: { canView: boolean; canManage: boolean } | null) =>
  ({
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue(riga) },
  }) as unknown as PrismaService;

/** Un Prisma che non risponde: succede, e la risposta non deve essere «sì». */
const rotto = () =>
  ({
    rolePagePermission: { findUnique: jest.fn().mockRejectedValue(new Error('database muto')) },
  }) as unknown as PrismaService;

describe('ruoloPuo', () => {
  it('la riga in Permessi vince sul default: coach ACCESA può gestire', async () => {
    expect(await ruoloPuo(finto({ canView: true, canManage: true }), 'coach', 'client_conversations', 'manage')).toBe(true);
  });

  it('la riga in Permessi vince sul default: nutrizionista SPENTA non può gestire', async () => {
    expect(await ruoloPuo(finto({ canView: true, canManage: false }), 'nutritionist', 'client_conversations', 'manage')).toBe(false);
  });

  it('senza riga si usano i default del ruolo: coach legge ma non verifica', async () => {
    const p = finto(null);
    expect(await ruoloPuo(p, 'coach', 'client_conversations', 'view')).toBe(true);
    expect(await ruoloPuo(p, 'coach', 'client_conversations', 'manage')).toBe(false);
  });

  it('senza riga si usano i default del ruolo: la nutrizionista verifica', async () => {
    expect(await ruoloPuo(finto(null), 'nutritionist', 'client_conversations', 'manage')).toBe(true);
  });

  it('un ruolo che non c\'entra non entra: marketing non legge le conversazioni di una cliente', async () => {
    const p = finto(null);
    expect(await ruoloPuo(p, 'marketing', 'client_conversations', 'view')).toBe(false);
    expect(await ruoloPuo(p, 'sales', 'client_conversations', 'view')).toBe(false);
  });

  it('admin sempre sì, senza nemmeno interrogare la matrice', async () => {
    const p = finto(null);
    expect(await ruoloPuo(p, 'admin', 'client_conversations', 'manage')).toBe(true);
    expect(p.rolePagePermission.findUnique).not.toHaveBeenCalled();
  });

  it('se il database non risponde NON si apre: si ricade sui default', async () => {
    expect(await ruoloPuo(rotto(), 'coach', 'client_conversations', 'manage')).toBe(false);
    expect(await ruoloPuo(rotto(), 'nutritionist', 'client_conversations', 'manage')).toBe(true);
  });

  it('«manage» è il livello di default: chiederlo senza specificarlo non deve diventare «view»', async () => {
    // Il difetto che questo test previene: `ruoloPuo(p, 'coach', 'client_conversations')` che
    // risponde «sì» perché la coach ha il permesso di LEGGERE.
    expect(await ruoloPuo(finto({ canView: true, canManage: false }), 'coach', 'client_conversations')).toBe(false);
  });
});

/**
 * ⛔ **ANCHE QUI LA RIGA MANCANTE VALE QUANTO QUELLA DEL GENITORE** (2/9).
 *
 * `ruoloPuo` è uno dei tre punti che risolvono un permesso, e la prima correzione ne copriva uno
 * solo: `syncDefaults`. Questo e il `PageGuard` ripiegavano sui `DEFAULT_PERMISSIONS` arricchiti,
 * cioè sul meccanismo dichiarato rotto — e lo fanno **a tempo di richiesta**, quando la riga manca
 * davvero perché `syncDefaults` è fallito all'avvio e l'errore è stato assorbito con un `warn`.
 */
describe('ruoloPuo — la riga mancante eredita dal genitore', () => {
  const prismaCon = (righe: Record<string, { canView: boolean; canManage: boolean }>) => ({
    rolePagePermission: {
      findUnique: jest.fn(({ where }: { where: { role_pageKey: { role: string; pageKey: string } } }) =>
        Promise.resolve(righe[`${where.role_pageKey.role}:${where.role_pageKey.pageKey}`] ?? null)),
    },
  }) as never;

  it('⛔ genitore SPENTO a mano: la figlia senza riga dice no', async () => {
    const p = prismaCon({ 'head_nutritionist:diets_catalog': { canView: false, canManage: false } });
    await expect(ruoloPuo(p, 'head_nutritionist', 'equivalence_groups', 'view')).resolves.toBe(false);
  });

  it('⛔ genitore ACCESO a mano: la figlia senza riga dice sì', async () => {
    const p = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: true } });
    await expect(ruoloPuo(p, 'coach', 'equivalence_groups', 'view')).resolves.toBe(true);
  });

  it('⚠️ e il livello resta separato: sola vista non dà la gestione', async () => {
    const p = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: false } });
    await expect(ruoloPuo(p, 'coach', 'equivalence_groups', 'view')).resolves.toBe(true);
    await expect(ruoloPuo(p, 'coach', 'equivalence_groups', 'manage')).resolves.toBe(false);
  });

  it('la riga PROPRIA comanda su quella del genitore', async () => {
    const p = prismaCon({
      'coach:diets_catalog': { canView: true, canManage: true },
      'coach:equivalence_groups': { canView: false, canManage: false },
    });
    await expect(ruoloPuo(p, 'coach', 'equivalence_groups', 'view')).resolves.toBe(false);
  });

  it('⛔ una pagina «hub» non eredita: resta sul suo default', async () => {
    const p = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: true } });
    await expect(ruoloPuo(p, 'coach', 'diet_workspace', 'view')).resolves.toBe(false);
  });
});

