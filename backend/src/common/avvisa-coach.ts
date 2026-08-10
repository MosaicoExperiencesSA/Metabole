/**
 * AVVISARE LA COACH DI UNA SUA CLIENTE — in un posto solo.
 *
 * Il pezzo esisteva già come metodo privato di `CommerceService` (`notifyCoachOfClient`) e lo usavano
 * il rinnovo, la prova attivata, il pagamento fallito. L'11/8 Simone ha chiesto un avviso anche per
 * lo spostamento automatico in «Percorso concluso», che vive in `CrmService`: copiarlo lì avrebbe
 * significato due funzioni che cercano la coach in due modi, e il giorno in cui la ricerca cambia
 * (una coach senza scheda staff, una cliente riassegnata) una delle due smette di avvisare in
 * silenzio — che è il difetto peggiore per una notifica, perché l'assenza non si nota.
 *
 * Le due regole dentro:
 *  - **niente coach assegnata, niente avviso.** Non si manda a nessun altro: un avviso che arriva a
 *    chi non segue quella cliente è rumore, e insegna a ignorare le notifiche;
 *  - **non fallisce mai.** Chi chiama sta facendo qualcos'altro (un rinnovo, la chiusura di un
 *    percorso): un avviso che non parte non deve far tornare indietro il lavoro vero.
 */
import type { PrismaService } from '../prisma/prisma.service';

export interface AvvisoCoach {
  /** Tipo tecnico della notifica (serve al deep link e alle preferenze per tipo). */
  type: string;
  title: string;
  /** Il testo, che riceve il nome con cui la cliente vuole essere chiamata. */
  body: (nome: string) => string;
}

/** Minimo che serve a questa funzione: così la si può usare da qualunque servizio. */
interface Notificatore {
  notify(input: { userId: string; type: string; title: string; body: string; payload?: unknown }): Promise<unknown>;
}

export async function avvisaCoachDellaCliente(
  prisma: PrismaService,
  notifications: Notificatore,
  clientId: string,
  avviso: AvvisoCoach,
): Promise<boolean> {
  try {
    const profile = (await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { name: true, assignedCoachId: true },
    })) as { name: string | null; assignedCoachId: string | null } | null;
    if (!profile?.assignedCoachId) return false;

    const coach = (await prisma.staff.findUnique({
      where: { id: profile.assignedCoachId },
      select: { userId: true },
    })) as { userId: string } | null;
    if (!coach) return false;

    await notifications.notify({
      userId: coach.userId,
      type: avviso.type,
      title: avviso.title,
      body: avviso.body(profile.name ?? 'Una tua cliente'),
      payload: { clientId },
    });
    return true;
  } catch {
    // Vedi il commento in testa: un avviso che non parte non fa fallire il lavoro di chi chiama.
    return false;
  }
}
