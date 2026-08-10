/**
 * «QUESTO RUOLO PUÒ?» — la stessa risposta del PageGuard, ma dentro un servizio.
 *
 * Il PageGuard risponde a questa domanda per le rotte, e lo fa bene: riga della matrice
 * `role_page_permission` se esiste, altrimenti il default del ruolo, admin sempre sì. Ma un servizio
 * a volte deve rifarsi la stessa domanda, perché il permesso della rotta e quello dell'azione non
 * sempre coincidono: chi può **aprire** le conversazioni di una cliente non è per forza chi può
 * **correggere i grammi** di un cambio concordato in chat.
 *
 * Finché quella seconda domanda si risolveva con un elenco di ruoli scritto nel codice
 * (`['nutritionist', 'head_nutritionist', 'admin']`) il permesso in pagina Permessi era una
 * decorazione: si poteva spegnerlo e l'azione restava possibile, o accenderlo e restava impossibile.
 * L'11/8 Simone ha chiesto l'opposto — «la visibilità e la scrittura di questa parte devo poterla
 * abilitare dai permessi» — e questo file è il posto unico da cui si legge la risposta.
 *
 * ## Perché NON fallisce in apertura
 *
 * Il PageGuard, se il database non risponde, lascia passare: dietro di lui c'è ancora `@Roles`, che
 * è già un cancello. Qui dietro non c'è niente, quindi su errore si ricade sui **default del ruolo**
 * (deterministici, scritti in `pages.ts`) e non su «sì». Un servizio che apre le porte quando il
 * database ha un singhiozzo è un difetto che si vede solo il giorno in cui è troppo tardi.
 */
import type { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PERMISSIONS, PageKey } from './pages';
import { Role } from '../common/roles';

/**
 * Prende `PrismaService` intero, come fa `avvisa-coach.ts`, e non un'interfaccia con la sola tabella
 * `rolePagePermission`: quella firma ricopiata a mano smette di combaciare al primo cambio dello
 * schema, e in sandbox (dove il client Prisma è uno stub) non combacia già adesso. Nei test si passa
 * un finto con `as unknown as PrismaService`, che è la convenzione del resto del progetto.
 */
type LettoreMatrice = PrismaService;

export async function ruoloPuo(
  prisma: LettoreMatrice,
  role: string,
  pageKey: string,
  livello: 'view' | 'manage' = 'manage',
): Promise<boolean> {
  if (role === 'admin') return true; // superutente, come nel PageGuard
  let riga: { canView: boolean; canManage: boolean } | null = null;
  try {
    riga = (await prisma.rolePagePermission.findUnique({
      where: { role_pageKey: { role, pageKey } },
      select: { canView: true, canManage: true },
    })) as { canView: boolean; canManage: boolean } | null;
  } catch {
    // Database muto (o un finto nei test senza quella tabella): si ricade sui default, mai su «sì».
    riga = null;
  }
  if (riga) return livello === 'view' ? !!riga.canView : !!riga.canManage;
  const def = DEFAULT_PERMISSIONS[role as Role]?.[pageKey as PageKey];
  return livello === 'view' ? !!def?.view : !!def?.manage;
}
