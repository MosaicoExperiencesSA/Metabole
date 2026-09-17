import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { agganciaAssegnazioneAlProfilo } from '../../common/assegnazione-profilo';
import { prefsToken, verifyPrefsToken } from '../../common/funnel-segment';
import { urlApiPubblica } from '../../common/url-api-pubblica';
import { STAGE_DA_CLIENTE } from '../../commerce/sospensione-in-pipeline';
import { ConfigParamsService } from '../../config-params/config-params.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketingService } from '../marketing.service';
import { GAIA_INVITO, GAIA_PROMEMORIA } from './email-gaia';
import { PER_PAGINA, cercaValida, motivoLeggibile, nomeECognome, paginaValida, type RigaElenco, type TipoElenco } from './elenco';
import { inizioDiOggi } from '../../common/date-only';
import {
  emailMascherata,
  escHtml,
  motivoScarto,
  nellaFinestra,
  nomeCortese,
  tettoGiornaliero,
  tokenInvito,
  verificaTokenInvito,
} from './regole';
import { paginaCancellami, paginaCancellata, paginaInizio, paginaLinkNonValido } from './pagine';

/**
 * INVITO A GAIA — il motore (16/9, richiesta di Simone).
 *
 * Ogni quarto d'ora (cron esterno `internal/cron/invito-gaia`, dichiarato in `render.yaml`), se acceso e
 * dentro la finestra oraria:
 *  1. manda l'invito a quanti mancano per arrivare a `gaia_invito_al_giorno` oggi, pescando i lead in
 *     «Nuovo contatto» senza account, dal più recente;
 *  2. manda il promemoria a chi ha ricevuto l'invito da `gaia_invito_promemoria_giorni` giorni e non
 *     è ancora entrato.
 *
 * ⛔ **Chi riceve** (decisione di Simone del 16/9): tutti i «Nuovo contatto» tranne chi ha detto no —
 * disiscritti, consenso negato, preferenze spente — con gli stessi filtri delle campagne
 * (`MarketingService.filtraConsensi`). Se l'admin accende `marketing_require_consent`, i lead senza
 * consenso esplicito restano fuori anche qui: l'interruttore di sicurezza vale per tutti.
 * ⛔ **I consensi si ricontrollano al momento dell'invio**, non quando la persona entra in coda: chi
 * si disiscrive oggi non riceve il promemoria fra due settimane.
 *
 * ⛔ **Niente timer nel processo**: su Render girano DUE istanze (`numInstances: 2`), e due timer
 * farebbero due giri. Il giro lo chiama il cron, una volta. Se due giri si sovrappongono comunque
 * (il cron e il pulsante «giro» del pannello), reggono: il tetto del giorno si riconta prima di ogni
 * invio, e l'indirizzo è unico in `gaia_invite`.
 *
 * ⛔ **Le schede scartate escono dalla coda** con una riga `saltato:<motivo>`: se restassero, i giri
 * rileggerebbero sempre le stesse in testa e prima o poi non arriverebbero più a nessuno.
 *
 * Il link dell'email non crea niente da solo (vedi `pagine.ts`): apre una pagina, e il pulsante crea
 * l'account (se non c'è) e porta alla scelta della password — lo stesso token del «password
 * dimenticata». Funziona solo finché la persona una password non se l'è scelta: dopo porta
 * all'accesso. Un link inoltrato non apre l'account di nessuno che lo stia già usando.
 */
export interface ImpostazioniInvito {
  attivo: boolean;
  alGiorno: number;
  promemoriaGiorni: number;
  oraDa: number;
  oraA: number;
  linkOre: number;
}

type Utente = { id: string; role: string; mustChangePassword: boolean; status: string; deletedAt: Date | null };

type Scheda = {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  clientId: string | null;
};

const CHIAVI = {
  attivo: 'gaia_invito_attivo',
  alGiorno: 'gaia_invito_al_giorno',
  promemoriaGiorni: 'gaia_invito_promemoria_giorni',
  oraDa: 'gaia_invito_ora_da',
  oraA: 'gaia_invito_ora_a',
  linkOre: 'gaia_invito_link_ore',
} as const;

/** Dopo tanti invii falliti di fila si smette per questo giro: Brevo è giù, non la persona. */
const FALLIMENTI_DI_FILA = 3;
/** Lotti letti al massimo per giro (le schede scartate escono dalla coda, quindi basta ripescare). */
const LOTTI_MAX = 20;
const LOTTO = 300;
/** Un invio fallito si riprova al massimo tre volte in tutto, a sei ore di distanza. */
const TENTATIVI_MAX = 3;
const PAUSA_TENTATIVI_MS = 6 * 3600_000;

function eDoppione(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'P2002';
}

@Injectable()
export class InvitoGaiaService {
  private readonly logger = new Logger(InvitoGaiaService.name);
  private inCorso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly params: ConfigParamsService,
    private readonly marketing: MarketingService,
  ) {}

  // ---------- Indirizzi e segreti ----------

  private segreto(): string {
    const s = this.config.get<string>('PREFS_TOKEN_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET');
    if (!s) throw new Error('PREFS_TOKEN_SECRET/JWT_ACCESS_SECRET mancante: configurare un secret.');
    return s;
  }

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'https://app.metabole.eu').replace(/\/+$/, '');
  }

  private api(): string {
    return urlApiPubblica(this.config.get<string>('PUBLIC_API_URL'));
  }

  linkPer(recordId: string) {
    const prefs = prefsToken(recordId, this.segreto());
    return {
      prova: `${this.api()}/public/gaia/inizia?t=${tokenInvito(recordId, this.segreto())}`,
      disiscrizione: `${this.api()}/public/gaia/cancellami?t=${prefs}`,
      unClic: `${this.api()}/public/marketing/unsubscribe?t=${prefs}`,
      preferenze: this.marketing.prefsLink(recordId),
    };
  }

  // ---------- Impostazioni ----------

  async impostazioni(): Promise<ImpostazioniInvito> {
    const [attivo, alGiorno, promemoriaGiorni, oraDa, oraA, linkOre] = await Promise.all([
      this.params.getBool(CHIAVI.attivo, false),
      this.params.getNumber(CHIAVI.alGiorno, 100),
      this.params.getNumber(CHIAVI.promemoriaGiorni, 15),
      this.params.getNumber(CHIAVI.oraDa, 9),
      this.params.getNumber(CHIAVI.oraA, 20),
      this.params.getNumber(CHIAVI.linkOre, 48),
    ]);
    return { attivo, alGiorno, promemoriaGiorni, oraDa, oraA, linkOre };
  }

  async aggiorna(input: Partial<Pick<ImpostazioniInvito, 'attivo' | 'alGiorno' | 'promemoriaGiorni' | 'oraDa' | 'oraA'>>, actorId: string) {
    const intero = (v: number, min: number, max: number, cosa: string) => {
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${cosa}: scrivi un numero intero fra ${min} e ${max}.`);
      return String(v);
    };
    const attuali = await this.impostazioni();
    const oraDa = input.oraDa ?? attuali.oraDa;
    const oraA = input.oraA ?? attuali.oraA;
    if (oraDa >= oraA) throw new BadRequestException('L’ora di inizio deve venire prima dell’ora di fine.');
    const scritture: [string, string][] = [];
    if (input.attivo !== undefined) scritture.push([CHIAVI.attivo, input.attivo ? 'true' : 'false']);
    if (input.alGiorno !== undefined) scritture.push([CHIAVI.alGiorno, intero(input.alGiorno, 0, 1000, 'Email al giorno')]);
    if (input.promemoriaGiorni !== undefined) scritture.push([CHIAVI.promemoriaGiorni, intero(input.promemoriaGiorni, 1, 90, 'Giorni del promemoria')]);
    if (input.oraDa !== undefined) scritture.push([CHIAVI.oraDa, intero(input.oraDa, 0, 23, 'Ora di inizio')]);
    if (input.oraA !== undefined) scritture.push([CHIAVI.oraA, intero(input.oraA, 1, 24, 'Ora di fine')]);
    for (const [k, v] of scritture) await this.params.update(k, v, actorId);
    await this.audit.log({ action: 'marketing.invito_gaia.impostazioni', actorId, entityType: 'config_param', entityId: 'gaia_invito', metadata: input as Record<string, unknown> });
    return this.impostazioni();
  }

  // ---------- Il giro ----------

  async giro(adesso: Date = new Date()): Promise<{ inviti: number; promemoria: number; nota: string | null }> {
    if (this.inCorso) return { inviti: 0, promemoria: 0, nota: 'giro già in corso' };
    this.inCorso = true;
    try {
      const s = await this.impostazioni();
      if (!s.attivo) return { inviti: 0, promemoria: 0, nota: 'spento' };
      if (!nellaFinestra(adesso, s.oraDa, s.oraA)) return { inviti: 0, promemoria: 0, nota: 'fuori dalla finestra oraria' };
      const inviti = await this.mandaInviti(s, adesso);
      const promemoria = await this.mandaPromemoria(s, adesso);
      if (inviti || promemoria) this.logger.log(`[invito-gaia] inviti ${inviti}, promemoria ${promemoria}`);
      return { inviti, promemoria, nota: null };
    } finally {
      this.inCorso = false;
    }
  }

  private async coda(): Promise<object> {
    // Con `marketing_require_consent` acceso si pescano SOLO i consensi espliciti: se lo facesse il
    // filtro in memoria, tutte le altre schede verrebbero segnate «saltate» e uscirebbero dalla coda
    // per sempre, anche dopo che l'interruttore torna spento.
    const obbligo = await this.params.getBool('marketing_require_consent', false);
    return {
      stage: 'lead_in',
      clientId: null,
      gaiaInvite: { is: null },
      email: { contains: '@' },
      ...(obbligo ? { marketingConsent: true } : { OR: [{ marketingConsent: null }, { marketingConsent: true }] }),
    };
  }

  /**
   * Invii tentati oggi (giorno di Roma), nuovi e riprovati: è questo il tetto. Si conta sull'ultimo
   * tentativo e non sulla nascita della riga, così un invito di ieri riprovato oggi pesa su oggi.
   */
  private contatiOggi(adesso: Date): Promise<number> {
    return this.prisma.gaiaInvite.count({
      where: { ultimoTentativoAt: { gte: inizioDiOggi(adesso) }, NOT: { esito: { startsWith: 'saltato' } } },
    });
  }

  async mandaInviti(s: ImpostazioniInvito, adesso: Date): Promise<number> {
    const tetto = tettoGiornaliero(s.alGiorno);
    if (tetto <= 0 || (await this.contatiOggi(adesso)) >= tetto) return 0;
    const modello = await this.modello(GAIA_INVITO);
    if (!modello) return 0;

    let inviati = await this.riprovaFalliti(modello, adesso, tetto);
    let falliti = 0;
    for (let giro = 0; giro < LOTTI_MAX; giro++) {
      const lotto = (await this.prisma.crmRecord.findMany({
        where: (await this.coda()) as never,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: LOTTO,
        select: { id: true, email: true, name: true, firstName: true, clientId: true, consentChannels: true },
      })) as (Scheda & { consentChannels: string[] })[];
      if (!lotto.length) return inviati;
      const consentite = new Set((await this.marketing.filtraConsensi(lotto)).map((c) => c.id));
      const { giaVisti, conAccount } = await this.indirizziDaEscludere(lotto.map((c) => c.email ?? ''));
      let righeNuove = 0;
      for (const r of lotto) {
        if ((await this.contatiOggi(new Date())) >= tetto) return inviati;
        const motivo = motivoScarto(r.email, giaVisti, conAccount, consentite.has(r.id), r.consentChannels);
        const email = motivo ? null : (r.email as string).trim().toLowerCase();
        let riga: { id: string } | null = null;
        try {
          riga = await this.prisma.gaiaInvite.create({
            data: { crmRecordId: r.id, email, esito: motivo ?? 'invio', ultimoTentativoAt: motivo ? null : new Date() },
            select: { id: true },
          });
        } catch (e) {
          if (!eDoppione(e)) throw e;
          // Presa da un altro giro, o un'altra scheda ha già questo indirizzo: la si scarta.
          if (email) {
            const scartata = await this.prisma.gaiaInvite
              .create({ data: { crmRecordId: r.id, email: null, esito: 'saltato:doppione' }, select: { id: true } })
              .catch((e2) => { if (!eDoppione(e2)) throw e2; return null; });
            if (scartata) righeNuove += 1;
          }
          continue;
        }
        righeNuove += 1;
        if (motivo || !email) continue;
        giaVisti.add(email);
        const ok = await this.invia(modello, r, email);
        if (ok) {
          await this.prisma.gaiaInvite.update({ where: { id: riga.id }, data: { esito: 'inviato', sentAt: new Date(), tentativi: 1 } });
          inviati += 1;
          falliti = 0;
        } else {
          // Resta sua: si riprova più tardi (al massimo tre volte), e un indirizzo che Brevo rifiuta
          // non blocca più la testa della coda. Tre errori di fila: Brevo è giù, ci si ferma.
          await this.prisma.gaiaInvite.update({ where: { id: riga.id }, data: { esito: 'fallito', tentativi: 1 } });
          falliti += 1;
          if (falliti >= FALLIMENTI_DI_FILA) {
            this.logger.warn('[invito-gaia] tre invii falliti di fila: mi fermo fino al prossimo giro.');
            return inviati;
          }
        }
      }
      if (righeNuove === 0) return inviati; // niente è uscito dalla coda: rileggere darebbe lo stesso lotto
    }
    return inviati;
  }

  /** Gli inviti falliti, riprovati dopo sei ore, al massimo tre volte in tutto. */
  private async riprovaFalliti(modello: { key: string; subject: string; bodyHtml: string }, adesso: Date, tetto: number): Promise<number> {
    const righe = (await this.prisma.gaiaInvite.findMany({
      where: {
        esito: 'fallito',
        tentativi: { lt: TENTATIVI_MAX },
        ultimoTentativoAt: { lte: new Date(adesso.getTime() - PAUSA_TENTATIVI_MS) },
      },
      orderBy: { ultimoTentativoAt: 'asc' },
      take: 50,
      select: {
        id: true, email: true, tentativi: true,
        crmRecord: { select: { id: true, email: true, name: true, firstName: true, clientId: true, stage: true, consentChannels: true } },
      },
    })) as unknown as {
      id: string;
      email: string | null;
      tentativi: number;
      crmRecord: (Scheda & { stage: string; consentChannels: string[] }) | null;
    }[];
    if (!righe.length) return 0;
    const schede = righe.map((r) => r.crmRecord).filter((c): c is NonNullable<typeof c> => !!c);
    const consentite = new Set((await this.marketing.filtraConsensi(schede)).map((c) => c.id));
    const { conAccount } = await this.indirizziDaEscludere(righe.map((r) => r.email ?? ''));
    let inviati = 0;
    let falliti = 0;
    for (const r of righe) {
      if ((await this.contatiOggi(new Date())) >= tetto) break;
      const c = r.crmRecord;
      const stessa = !!c && !!r.email && (c.email ?? '').trim().toLowerCase() === r.email && c.stage === 'lead_in' && !c.clientId;
      if (!stessa) {
        // La scheda è cambiata (indirizzo corretto, cliente, account): la riga si toglie e la scheda
        // torna in coda, dove il giro la rivaluta da capo con i dati di adesso. Tenerla bloccherebbe
        // per sempre sia la scheda sia l'indirizzo vecchio, a cui non è mai arrivato niente.
        await this.prisma.gaiaInvite.deleteMany({ where: { id: r.id, esito: 'fallito', tentativi: r.tentativi } });
        continue;
      }
      const motivo = motivoScarto(r.email, new Set(), conAccount, consentite.has(c!.id), c!.consentChannels);
      if (motivo) {
        await this.prisma.gaiaInvite.updateMany({ where: { id: r.id, esito: 'fallito' }, data: { esito: motivo, email: null } });
        continue;
      }
      const presa = await this.prisma.gaiaInvite.updateMany({
        where: { id: r.id, esito: 'fallito', tentativi: r.tentativi },
        data: { esito: 'invio', tentativi: r.tentativi + 1, ultimoTentativoAt: new Date() },
      });
      if (presa.count === 0) continue;
      const ok = await this.invia(modello, c!, r.email!);
      await this.prisma.gaiaInvite.update({
        where: { id: r.id },
        data: ok ? { esito: 'inviato', sentAt: new Date() } : { esito: 'fallito' },
      });
      if (ok) {
        inviati += 1;
        falliti = 0;
      } else if (++falliti >= FALLIMENTI_DI_FILA) {
        break;
      }
    }
    return inviati;
  }

  /** Indirizzi già invitati e indirizzi che hanno già un account (anche su una scheda non collegata). */
  private async indirizziDaEscludere(emails: string[]): Promise<{ giaVisti: Set<string>; conAccount: Set<string> }> {
    const lista = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const giaVisti = new Set<string>();
    const conAccount = new Set<string>();
    if (!lista.length) return { giaVisti, conAccount };
    const [inviti, utenti] = await Promise.all([
      this.prisma.gaiaInvite.findMany({ where: { email: { in: lista } }, select: { email: true } }) as Promise<{ email: string | null }[]>,
      this.prisma.user.findMany({
        where: { OR: [{ email: { in: lista } }, { secondaryEmail: { in: lista } }] },
        select: { email: true, secondaryEmail: true },
      }) as Promise<{ email: string; secondaryEmail: string | null }[]>,
    ]);
    for (const i of inviti) if (i.email) giaVisti.add(i.email.toLowerCase());
    for (const u of utenti) {
      conAccount.add(u.email.toLowerCase());
      if (u.secondaryEmail) conAccount.add(u.secondaryEmail.toLowerCase());
    }
    return { giaVisti, conAccount };
  }

  async mandaPromemoria(s: ImpostazioniInvito, adesso: Date): Promise<number> {
    const giorni = Number.isFinite(s.promemoriaGiorni) && s.promemoriaGiorni >= 1 ? s.promemoriaGiorni : 15;
    const soglia = new Date(adesso.getTime() - giorni * 86_400_000);
    const righe = (await this.prisma.gaiaInvite.findMany({
      where: {
        esito: 'inviato',
        sentAt: { lte: soglia },
        enteredAt: null,
        OR: [
          { reminderEsito: null },
          // Un tentativo fallito si riprova una volta, sei ore dopo.
          { reminderEsito: 'fallito:1', reminderSentAt: { lte: new Date(adesso.getTime() - PAUSA_TENTATIVI_MS) } },
        ],
      },
      orderBy: { sentAt: 'asc' },
      take: 300,
      select: {
        id: true,
        email: true,
        reminderEsito: true,
        crmRecord: {
          select: {
            id: true, email: true, name: true, firstName: true, clientId: true, stage: true, consentChannels: true,
            client: { select: { mustChangePassword: true } },
          },
        },
      },
    })) as unknown as {
      id: string;
      email: string | null;
      reminderEsito: string | null;
      crmRecord: (Scheda & { stage: string; consentChannels: string[]; client: { mustChangePassword: boolean } | null }) | null;
    }[];
    if (!righe.length) return 0;
    const modello = await this.modello(GAIA_PROMEMORIA);
    if (!modello) return 0;

    const schede = righe.map((r) => r.crmRecord).filter((c): c is NonNullable<typeof c> => !!c);
    const consentite = new Set((await this.marketing.filtraConsensi(schede)).map((c) => c.id));
    // Chi si è registrata dall'app (magari su un'altra scheda con lo stesso indirizzo) è già entrata.
    const { conAccount } = await this.indirizziDaEscludere(righe.map((r) => r.email ?? ''));

    let inviati = 0;
    let falliti = 0;
    for (const r of righe) {
      const c = r.crmRecord;
      const email = r.email ?? '';
      const motivo = !c || !email
        ? 'saltato:scheda'
        : (c.email ?? '').trim().toLowerCase() !== email
          ? 'saltato:cambiata'
          : (c.client && !c.client.mustChangePassword) || (!c.client && conAccount.has(email))
            ? 'saltato:entrata'
            : (STAGE_DA_CLIENTE as readonly string[]).includes(c.stage)
              ? 'saltato:cliente'
              : !consentite.has(c.id)
                ? 'saltato:consenso'
                : c.consentChannels?.length && !c.consentChannels.includes('email')
                  ? 'saltato:canale'
                  : null;
      if (motivo) {
        await this.prisma.gaiaInvite.updateMany({ where: { id: r.id, reminderEsito: r.reminderEsito }, data: { reminderEsito: motivo } });
        continue;
      }
      const presa = await this.prisma.gaiaInvite.updateMany({
        where: { id: r.id, reminderEsito: r.reminderEsito },
        data: { reminderEsito: 'invio', reminderSentAt: new Date() },
      });
      if (presa.count === 0) continue;
      // ⛔ All'indirizzo dell'invito, mai a uno nuovo: lo si è appena verificato uguale a quello della scheda.
      const ok = await this.invia(modello, c as Scheda, email);
      await this.prisma.gaiaInvite.update({
        where: { id: r.id },
        data: { reminderEsito: ok ? 'inviato' : r.reminderEsito === 'fallito:1' ? 'fallito' : 'fallito:1' },
      });
      if (ok) {
        inviati += 1;
        falliti = 0;
      } else {
        falliti += 1;
        if (falliti >= FALLIMENTI_DI_FILA) break;
      }
    }
    return inviati;
  }

  /**
   * Il modello da usare: quello del backoffice se c'è e attivo, il predefinito se la riga non esiste
   * ancora. ⛔ Se l'admin l'ha DISATTIVATO non parte niente: è il modo più semplice di fermare tutto.
   */
  private async modello(predefinito: { key: string; subject: string; bodyHtml: string }): Promise<{ key: string; subject: string; bodyHtml: string } | null> {
    const riga = (await this.prisma.emailTemplate.findUnique({ where: { key: predefinito.key } }).catch(() => null)) as
      | { key: string; subject: string; bodyHtml: string; active: boolean }
      | null;
    if (!riga) return predefinito;
    return riga.active ? riga : null;
  }

  private riempi(testo: string, vars: Record<string, string>): string {
    return testo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');
  }

  /**
   * Manda una email. ⛔ Non lancia: un errore (un segreto mancante, un modello rotto) vale come invio
   * fallito, così la riga diventa «fallito» e non resta bloccata su «invio» per sempre.
   * ⚠️ Resta scoperto solo lo spegnimento del processo fra la presa e l'esito: quella riga resta
   * «invio» e non si riprova, perché non si sa se l'email è partita — meglio un invito perso che due.
   */
  private async invia(modello: { key: string; subject: string; bodyHtml: string }, r: Scheda, email: string): Promise<boolean> {
    try {
      return await this.inviaDavvero(modello, r, email);
    } catch (e) {
      this.logger.error(`[invito-gaia] invio a ${r.id} non riuscito: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  private async inviaDavvero(modello: { key: string; subject: string; bodyHtml: string }, r: Scheda, email: string): Promise<boolean> {
    const link = this.linkPer(r.id);
    const vars = {
      nome: nomeCortese(r.firstName, r.name),
      email,
      link_prova: link.prova,
      link_disiscrizione: link.disiscrizione,
      link_preferenze: link.preferenze,
      app_url: this.appUrl(),
    };
    // Nell'HTML i valori vanno protetti: nome e indirizzo vengono da liste importate.
    const varsHtml = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escHtml(v)]));
    return this.mail.send({
      to: email,
      subject: this.riempi(modello.subject, vars),
      html: this.riempi(modello.bodyHtml, varsHtml),
      templateKey: `gaia:${modello.key}`,
      tags: [`gaia:${modello.key}`],
      listUnsubscribeUrl: link.unClic,
    });
  }

  // ---------- Pannello ----------

  async panoramica() {
    const adesso = new Date();
    const [s, inviati, oggi, falliti, scartati, promemoria, cliccati, entrati, inCoda, obbligoConsenso, modelli, ultimo] = await Promise.all([
      this.impostazioni(),
      this.prisma.gaiaInvite.count({ where: { esito: 'inviato' } }),
      this.contatiOggi(adesso),
      this.prisma.gaiaInvite.count({ where: { esito: 'fallito' } }),
      this.prisma.gaiaInvite.count({ where: { esito: { startsWith: 'saltato' } } }),
      this.prisma.gaiaInvite.count({ where: { reminderEsito: 'inviato' } }),
      this.prisma.gaiaInvite.count({ where: { clickedAt: { not: null } } }),
      this.prisma.gaiaInvite.count({ where: { enteredAt: { not: null } } }),
      this.coda().then((w) => this.prisma.crmRecord.count({ where: w as never })),
      this.params.getBool('marketing_require_consent', false),
      this.prisma.emailTemplate.findMany({ where: { key: { in: [GAIA_INVITO.key, GAIA_PROMEMORIA.key] } }, select: { key: true, active: true } }),
      this.prisma.gaiaInvite.findFirst({ where: { sentAt: { not: null } }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    ]);
    const attivi = new Map((modelli as { key: string; active: boolean }[]).map((m) => [m.key, m.active]));
    return {
      impostazioni: s,
      conteggi: { inviati, oggi, falliti, scartati, promemoria, cliccati, entrati, inCoda },
      obbligoConsenso,
      modelliSpenti: [GAIA_INVITO.key, GAIA_PROMEMORIA.key].filter((k) => attivi.get(k) === false),
      ultimoInvio: (ultimo as { sentAt: Date | null } | null)?.sentAt ?? null,
      nellaFinestraOra: nellaFinestra(adesso, s.oraDa, s.oraA),
    };
  }

  /**
   * L'elenco dietro una casella del pannello, a pagine da 50, con la ricerca per nome o email.
   * Le date sono quelle che quella casella conta: invio, clic, entrata, promemoria, ultimo tentativo
   * per gli scartati, nascita della scheda per la coda.
   */
  async elenco(tipo: TipoElenco, paginaGrezza?: unknown, cercaGrezza?: unknown): Promise<{ tipo: TipoElenco; pagina: number; perPagina: number; totale: number; righe: RigaElenco[] }> {
    const pagina = paginaValida(paginaGrezza);
    const cerca = cercaValida(cercaGrezza);
    const skip = (pagina - 1) * PER_PAGINA;
    const campiScheda = { id: true, email: true, name: true, firstName: true, lastName: true, clientId: true, createdAt: true } as const;
    type Scheda2 = { id: string; email: string | null; name: string | null; firstName: string | null; lastName: string | null; clientId: string | null; createdAt: Date };
    const filtroScheda = cerca
      ? {
          OR: [
            { name: { contains: cerca, mode: 'insensitive' } },
            { firstName: { contains: cerca, mode: 'insensitive' } },
            { lastName: { contains: cerca, mode: 'insensitive' } },
            { email: { contains: cerca, mode: 'insensitive' } },
          ],
        }
      : null;
    const riga = (c: Scheda2, email: string | null, quando: Date | null, motivo: string | null): RigaElenco => ({
      recordId: c.id,
      clientId: c.clientId,
      ...nomeECognome(c),
      email: email ?? c.email ?? '',
      quando: quando ? quando.toISOString() : null,
      motivo,
    });

    if (tipo === 'coda') {
      const where = { AND: [await this.coda(), ...(filtroScheda ? [filtroScheda] : [])] } as never;
      const [totale, schede] = await Promise.all([
        this.prisma.crmRecord.count({ where }),
        this.prisma.crmRecord.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take: PER_PAGINA, select: campiScheda }),
      ]);
      return { tipo, pagina, perPagina: PER_PAGINA, totale, righe: (schede as Scheda2[]).map((c) => riga(c, null, c.createdAt, null)) };
    }

    const oggi = inizioDiOggi(new Date());
    const casi: Record<Exclude<TipoElenco, 'coda'>, { where: object; data: 'sentAt' | 'clickedAt' | 'enteredAt' | 'reminderSentAt' | 'ultimoTentativoAt' }> = {
      inviati: { where: { esito: 'inviato' }, data: 'sentAt' },
      oggi: { where: { ultimoTentativoAt: { gte: oggi }, NOT: { esito: { startsWith: 'saltato' } } }, data: 'ultimoTentativoAt' },
      cliccati: { where: { clickedAt: { not: null } }, data: 'clickedAt' },
      entrati: { where: { enteredAt: { not: null } }, data: 'enteredAt' },
      promemoria: { where: { reminderEsito: 'inviato' }, data: 'reminderSentAt' },
      scartati: { where: { OR: [{ esito: { startsWith: 'saltato' } }, { esito: 'fallito' }] }, data: 'ultimoTentativoAt' },
    };
    const caso = casi[tipo];
    const where = { AND: [caso.where, ...(filtroScheda ? [{ crmRecord: filtroScheda }] : [])] } as never;
    const [totale, inviti] = await Promise.all([
      this.prisma.gaiaInvite.count({ where }),
      this.prisma.gaiaInvite.findMany({
        where,
        orderBy: [{ [caso.data]: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }] as never,
        skip,
        take: PER_PAGINA,
        select: {
          email: true, esito: true, sentAt: true, clickedAt: true, enteredAt: true, reminderSentAt: true, ultimoTentativoAt: true, createdAt: true,
          crmRecord: { select: campiScheda },
        },
      }),
    ]);
    const righe = (inviti as unknown as (Record<string, unknown> & { email: string | null; esito: string; createdAt: Date; crmRecord: Scheda2 | null })[])
      .filter((i) => !!i.crmRecord)
      .map((i) => riga(
        i.crmRecord as Scheda2,
        i.email,
        (i[caso.data] as Date | null) ?? (tipo === 'scartati' ? i.createdAt : null),
        tipo === 'scartati' || tipo === 'oggi' ? motivoLeggibile(i.esito === 'inviato' || i.esito === 'invio' ? null : i.esito) : null,
      ));
    return { tipo, pagina, perPagina: PER_PAGINA, totale, righe };
  }

  /** Le due email a un indirizzo di prova, con il nome «Maria» e link che non aprono niente. */
  async prova(email: string, actorId: string) {
    const falsi = {
      nome: 'Maria',
      email,
      link_prova: `${this.api()}/public/gaia/inizia?t=prova`,
      link_disiscrizione: `${this.api()}/public/gaia/cancellami?t=prova`,
      link_preferenze: `${this.appUrl()}/preferenze`,
      app_url: this.appUrl(),
    };
    const esiti: Record<string, boolean> = {};
    for (const predefinito of [GAIA_INVITO, GAIA_PROMEMORIA]) {
      const m = (await this.modello(predefinito)) ?? predefinito;
      esiti[m.key] = await this.mail.send({
        to: email,
        subject: `[PROVA] ${this.riempi(m.subject, falsi)}`,
        html: this.riempi(m.bodyHtml, falsi),
        templateKey: `gaia_prova:${m.key}`,
      });
    }
    await this.audit.log({ action: 'marketing.invito_gaia.prova', actorId, entityType: 'email_template', entityId: 'gaia', metadata: { email, esiti } });
    if (!Object.values(esiti).some(Boolean)) throw new BadRequestException('Invio di prova non riuscito (controlla BREVO_API_KEY su Render).');
    return { inviate: esiti };
  }

  // ---------- Le pagine dei link ----------

  async paginaInizio(token: string): Promise<string> {
    const trovata = await this.schedaDelLink(token);
    if (!trovata) return paginaLinkNonValido(this.appUrl());
    return paginaInizio({
      nome: nomeCortese(trovata.rec.firstName, trovata.rec.name),
      emailMascherata: emailMascherata(trovata.email),
      azione: `${this.api()}/public/gaia/inizia?t=${encodeURIComponent(token)}`,
      appUrl: this.appUrl(),
    });
  }

  private scheda(id: string) {
    return this.prisma.crmRecord.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, firstName: true, phone: true, clientId: true,
        assignedCoachId: true, assignedNutritionistId: true, assignmentStatus: true,
        gaiaInvite: { select: { email: true, sentAt: true } },
      },
    }) as Promise<
      | (Scheda & {
          phone: string | null;
          assignedCoachId: string | null;
          assignedNutritionistId: string | null;
          assignmentStatus: string | null;
          gaiaInvite: { email: string | null; sentAt: Date | null } | null;
        })
      | null
    >;
  }

  /**
   * ⛔ La scheda del link, SOLO se l'invito è partito davvero e all'indirizzo che la scheda ha
   * ancora. Se un import o lo staff ha cambiato l'email, il vecchio link non apre niente: aprirebbe
   * l'account della persona nuova a chi aveva l'indirizzo vecchio.
   */
  private async schedaDelLink(token: string) {
    const recordId = verificaTokenInvito(token, this.segreto());
    const rec = recordId ? await this.scheda(recordId) : null;
    const email = rec?.email?.trim().toLowerCase() ?? '';
    if (!rec || !email || !rec.gaiaInvite?.sentAt || rec.gaiaInvite.email !== email) return null;
    return { rec, email };
  }

  /**
   * Il pulsante «Scegli la mia password»: dove mandare la persona.
   * - link non valido → pagina che lo dice;
   * - ha già una password sua → all'accesso;
   * - altrimenti: account creato se manca, collegato alla scheda (con la sua coach), token di
   *   reimpostazione a tempo, e via alla pagina della password.
   */
  async inizia(token: string, ip?: string): Promise<{ vai: string } | { pagina: string }> {
    const trovata = await this.schedaDelLink(token);
    if (!trovata) return { pagina: paginaLinkNonValido(this.appUrl()) };
    const { rec, email } = trovata;
    const accesso = `${this.appUrl()}/login`;

    // Anche l'indirizzo secondario: se è già di qualcuno, un secondo account renderebbe ambiguo l'accesso.
    let utente = (await this.prisma.user.findFirst({
      where: rec.clientId ? { id: rec.clientId } : { OR: [{ email }, { secondaryEmail: email }] },
      select: { id: true, role: true, mustChangePassword: true, status: true, deletedAt: true },
    })) as Utente | null;

    if (utente && (utente.role !== 'client' || !utente.mustChangePassword || utente.status !== 'active' || utente.deletedAt)) {
      await this.segnaClic(rec.id);
      return { vai: accesso };
    }

    if (!utente) {
      try {
        utente = (await this.prisma.user.create({
          data: {
            email,
            passwordHash: await argon2.hash(randomBytes(24).toString('hex')),
            role: 'client',
            locale: 'it',
            firstName: nomeCortese(rec.firstName, rec.name) === 'Ciao' ? null : nomeCortese(rec.firstName, rec.name),
            phone: rec.phone?.trim() || null,
            mustChangePassword: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, role: true, mustChangePassword: true, status: true, deletedAt: true },
        })) as Utente;
      } catch {
        // Doppio clic: l'altro ha appena creato l'account.
        utente = (await this.prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, mustChangePassword: true, status: true, deletedAt: true },
        })) as Utente | null;
        if (!utente || utente.role !== 'client' || !utente.mustChangePassword) return { vai: accesso };
      }
      await this.audit.log({ action: 'marketing.invito_gaia.account', actorId: utente!.id, entityType: 'crm_record', entityId: rec.id, ipAddress: ip });
    }
    const userId = utente!.id;

    if (!rec.clientId) {
      // Se l'account è già collegato a un'altra scheda (stesso indirizzo), quella resta la sua.
      await this.prisma.crmRecord
        .updateMany({ where: { id: rec.id, clientId: null }, data: { clientId: userId } })
        .catch((e) => { if (!eDoppione(e)) throw e; });
    }
    await agganciaAssegnazioneAlProfilo(this.prisma, userId, {
      name: rec.name,
      assignedCoachId: rec.assignmentStatus === 'accepted' ? rec.assignedCoachId : null,
      assignedNutritionistId: rec.assignedNutritionistId,
    });

    const ore = (await this.impostazioni()).linkOre;
    const token64 = randomBytes(32).toString('hex');
    await this.prisma.actionToken.create({
      data: {
        userId,
        type: 'password_reset' as never,
        tokenHash: createHash('sha256').update(token64).digest('hex'),
        expiresAt: new Date(Date.now() + Math.max(1, Number.isFinite(ore) ? ore : 48) * 3600_000),
      },
    });
    await this.segnaClic(rec.id);
    return { vai: `${this.appUrl()}/reset-password?token=${token64}` };
  }

  private async segnaClic(recordId: string): Promise<void> {
    await this.prisma.gaiaInvite.updateMany({ where: { crmRecordId: recordId, clickedAt: null }, data: { clickedAt: new Date() } }).catch(() => undefined);
  }

  async paginaCancellami(token: string): Promise<string> {
    const recordId = verifyPrefsToken(token, this.segreto());
    const rec = recordId ? await this.scheda(recordId) : null;
    if (!rec) return paginaLinkNonValido(this.appUrl());
    return paginaCancellami({
      emailMascherata: rec.email ? emailMascherata(rec.email.trim().toLowerCase()) : 'questo indirizzo',
      azione: `${this.api()}/public/gaia/cancellami?t=${encodeURIComponent(token)}`,
      appUrl: this.appUrl(),
      preferenze: this.marketing.prefsPageUrlForToken(token),
    });
  }

  async cancellami(token: string): Promise<string> {
    const recordId = verifyPrefsToken(token, this.segreto());
    if (!recordId) return paginaLinkNonValido(this.appUrl());
    try {
      await this.marketing.oneClickUnsubscribe(token);
    } catch {
      return paginaLinkNonValido(this.appUrl()); // scheda cancellata nel frattempo
    }
    return paginaCancellata({ appUrl: this.appUrl(), preferenze: this.marketing.prefsPageUrlForToken(token) });
  }
}
