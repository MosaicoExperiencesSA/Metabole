import { Injectable, Logger } from '@nestjs/common';
import { Resolver } from 'dns/promises';

/**
 * ⛔ **IL DOMINIO DELL'INDIRIZZO RICEVE POSTA?** — il filtro dell'invito a Gaia (6/11/2026).
 *
 * Il diag del 6/11 sulla coda: 58.572 righe, 648 indirizzi su 391 domini che non ricevono posta,
 * quasi tutti errori di battitura (`gmail.con` 58, `gmal.com` 18, `g.mail.com` 16, `libeto.it` 13).
 * Ognuno di quelli diventa un rimbalzo e pesa sulla reputazione presso Brevo (bounce al 7,37%).
 * Qui si scartano PRIMA dell'invio.
 *
 * Come si decide (RFC 5321 §5.1):
 *  - il dominio non esiste (`ENOTFOUND`) → non riceve;
 *  - ha un MX vero → riceve;
 *  - ha solo il «null MX» (RFC 7505: il dominio dichiara di non ricevere) → non riceve;
 *  - non ha MX → la posta si consegna all'indirizzo del dominio: se c'è un A o un AAAA riceve,
 *    altrimenti no. (Esempio vero: `posta.istruzione.it` non ha MX ma ha un A.)
 *
 * ⛔ **Nel dubbio si manda.** Un DNS lento, un SERVFAIL, un errore qualsiasi danno `non_so`, e
 * `non_so` non scarta: lo scarto è per sempre (la scheda esce dalla coda con `saltato:dominio`),
 * un guasto del DNS dura un minuto. Per lo stesso motivo `non_so` non si tiene in memoria.
 *
 * ⚠️ Cosa NON vede: una casella chiusa da anni su un dominio vero come libero.it, e i
 * refusi che qualcuno ha registrato con un MX (`gimail.com`, `hotmial.it`). Quelli li trova solo un
 * servizio di verifica a pagamento.
 */
export type EsitoDominio = 'riceve' | 'non_riceve' | 'non_so';
export type Risposta<T> = { record: T[] } | { errore: string };

const NON_ESISTE = 'ENOTFOUND';
const VUOTO = 'ENODATA';

function vuota<T>(r: Risposta<T>): boolean {
  return 'errore' in r ? r.errore === VUOTO : r.record.length === 0;
}

/** Il MX da solo basta a decidere? Se è vuoto serve guardare l'indirizzo del dominio. */
export function serveIndirizzo(mx: Risposta<{ exchange: string }>): boolean {
  return vuota(mx);
}

/**
 * Il giudizio, senza rete. `indirizzi` sono le risposte A e AAAA, chieste solo se `serveIndirizzo`.
 */
export function giudicaDominio(
  mx: Risposta<{ exchange: string }>,
  indirizzi: Risposta<string>[] = [],
): EsitoDominio {
  if ('errore' in mx) {
    if (mx.errore === NON_ESISTE) return 'non_riceve';
    if (mx.errore !== VUOTO) return 'non_so';
  } else if (mx.record.length > 0) {
    const veri = mx.record.filter((r) => r.exchange && r.exchange !== '.');
    return veri.length > 0 ? 'riceve' : 'non_riceve';
  }
  // Nessun MX: decide l'indirizzo del dominio.
  if (indirizzi.length === 0) return 'non_so';
  if (indirizzi.some((r) => 'record' in r && r.record.length > 0)) return 'riceve';
  if (indirizzi.every((r) => vuota(r) || ('errore' in r && r.errore === NON_ESISTE))) return 'non_riceve';
  return 'non_so';
}

/** Il dominio di un indirizzo, in minuscolo; `null` se non c'è. */
export function dominioDi(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase();
  const i = e.lastIndexOf('@');
  const d = i < 0 ? '' : e.slice(i + 1);
  return d ? d : null;
}

async function chiedi<T>(p: Promise<T[]>): Promise<Risposta<T>> {
  try {
    return { record: await p };
  } catch (e) {
    return { errore: String((e as { code?: string }).code ?? 'ERRORE') };
  }
}

/** La domanda vera al DNS: tre secondi per tentativo, due tentativi. */
export async function interrogaDns(dominio: string): Promise<EsitoDominio> {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  const mx = await chiedi(r.resolveMx(dominio));
  if (!serveIndirizzo(mx)) return giudicaDominio(mx);
  const [a, aaaa] = await Promise.all([chiedi(r.resolve4(dominio)), chiedi(r.resolve6(dominio))]);
  return giudicaDominio(mx, [a, aaaa]);
}

const RICORDO_MS = 24 * 3600_000;
const RICORDI_MAX = 20_000;
const IN_PARALLELO = 10;

@Injectable()
export class PostaDeiDomini {
  private readonly logger = new Logger(PostaDeiDomini.name);
  private readonly memoria = new Map<string, { esito: EsitoDominio; fino: number }>();
  protected interroga: (dominio: string) => Promise<EsitoDominio> = interrogaDns;

  /** Per le prove: lo stesso filtro con una risposta finta al posto del DNS. */
  static conInterroga(f: (dominio: string) => Promise<EsitoDominio>): PostaDeiDomini {
    const p = new PostaDeiDomini();
    p.interroga = f;
    return p;
  }

  /** I domini, fra quelli degli indirizzi dati, che sicuramente NON ricevono posta. */
  async senzaPosta(emails: (string | null | undefined)[], adesso = Date.now()): Promise<Set<string>> {
    const domini = [...new Set(emails.map(dominioDi).filter((d): d is string => !!d))];
    const daChiedere = domini.filter((d) => {
      const m = this.memoria.get(d);
      return !m || m.fino <= adesso;
    });
    let i = 0;
    let nonSo = 0;
    const lavora = async () => {
      while (i < daChiedere.length) {
        const d = daChiedere[i++];
        let esito: EsitoDominio;
        try {
          esito = await this.interroga(d);
        } catch {
          esito = 'non_so';
        }
        if (esito === 'non_so') {
          nonSo++;
          this.memoria.delete(d);
          continue;
        }
        if (this.memoria.size >= RICORDI_MAX) this.memoria.clear();
        this.memoria.set(d, { esito, fino: adesso + RICORDO_MS });
      }
    };
    await Promise.all(Array.from({ length: Math.min(IN_PARALLELO, daChiedere.length) }, lavora));
    if (nonSo > 0) this.logger.warn(`[invito-gaia] ${nonSo} domini non verificati (DNS): si manda lo stesso.`);
    return new Set(domini.filter((d) => this.memoria.get(d)?.esito === 'non_riceve'));
  }
}
