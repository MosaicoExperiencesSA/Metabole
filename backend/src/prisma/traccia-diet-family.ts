import { Logger } from '@nestjs/common';

/**
 * CHI SCRIVE `dietFamily`? — la trappola che lo fa dire al codice.
 *
 * ## Perché esiste
 *
 * L'11/8 la dieta di una cliente è stata spostata da «Pescetariana» a «Mediterranea» **cinque
 * volte**, da tre persone diverse, e ogni volta è tornata indietro. Nell'audit si vedono i cinque
 * cambi e **nessun ritorno**: quindi qualcuno riscrive quel campo senza passare da `updateClient`.
 * Ho controllato a mano tutti i punti che scrivono su `ClientProfile` e nessuno spiegava il fatto:
 * a quel punto continuare a leggere codice è un modo lento di indovinare.
 *
 * Questa funzione intercetta **ogni** `update`/`upsert`/`updateMany` su `clientProfile` in cui
 * compaia `dietFamily`, e scrive nei log del server il valore e — la parte che conta — lo **stack**
 * di chi ha chiamato. Il colpevole si nomina da solo alla prima riscrittura.
 *
 * ## Perché così e non con un middleware
 *
 * `$use` non esiste più (Prisma 6) e `$extends` restituisce un client NUOVO, che non si incastra
 * con l'iniezione di dipendenze di Nest — `PrismaService` *è* il client. Qui si definisce una
 * proprietà sull'istanza che ombreggia il delegato e lo avvolge in un `Proxy`: stesso oggetto,
 * stesse firme, in mezzo una riga di log.
 *
 * ## Costo, e quando toglierla
 *
 * Zero letture in più e nessuna scrittura in più: solo un `console` quando qualcuno tocca quel
 * campo, che succede poche volte al giorno. Si spegne con `TRACCIA_DIET_FAMILY=0`. Va tolta quando
 * il colpevole è stato trovato e corretto — e la voce di registro di quel giorno deve dire *chi
 * era*, altrimenti fra un mese ricominciamo da qui.
 */
const AZIONI = ['update', 'upsert', 'updateMany'] as const;

export function tracciaDietFamily(prisma: Record<string, unknown>, logger = new Logger('dietFamily')): void {
  if (process.env.TRACCIA_DIET_FAMILY === '0') return;
  const delegato = prisma.clientProfile as Record<string, unknown> | undefined;
  if (!delegato) return;

  const avvolto = new Proxy(delegato, {
    get(target, prop, receiver) {
      const originale = Reflect.get(target, prop, receiver);
      if (typeof originale !== 'function' || !AZIONI.includes(prop as never)) return originale;
      return (...args: unknown[]) => {
        try {
          const arg = (args[0] ?? {}) as { data?: Record<string, unknown>; update?: Record<string, unknown>; where?: unknown };
          // `upsert` ha due rami: si guardano tutti e due, perché il difetto dell'8/8 e quello
          // dell'11/8 stavano tutte e due nel ramo che nessuno rilegge.
          const scritture = [arg.data, arg.update].filter(Boolean) as Record<string, unknown>[];
          const tocca = scritture.find((d) => d.dietFamily !== undefined);
          if (tocca) {
            logger.warn(
              `[traccia] ${String(prop)} scrive dietFamily=${JSON.stringify(tocca.dietFamily)} ` +
                `(dietStyle=${JSON.stringify(tocca.dietStyle)}) where=${JSON.stringify(arg.where)}\n` +
                (new Error('da qui').stack ?? '').split('\n').slice(1, 9).join('\n'),
            );
          }
        } catch {
          /* la traccia non deve MAI far fallire la scrittura che sta osservando */
        }
        return (originale as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });

  Object.defineProperty(prisma, 'clientProfile', {
    get: () => avvolto,
    configurable: true,
  });
}
