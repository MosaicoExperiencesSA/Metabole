import { Injectable } from '@nestjs/common';
import { CATALOGS, Locale, MessageEntry } from './messages';

export type MessageParams = Record<string, string | number | null | undefined>;

/**
 * i18n (spec sez. 12): contenuti, messaggi e notifiche localizzabili,
 * `locale` per utente. Italiano è la lingua base; fallback sempre su it.
 */
@Injectable()
export class I18nService {
  /** 'en-US' → 'en'; tutto ciò che non è supportato → 'it'. */
  normalize(locale?: string | null): Locale {
    const short = (locale ?? 'it').toLowerCase().slice(0, 2);
    return short === 'en' ? 'en' : 'it';
  }

  /** Voce di catalogo con fallback sull'italiano. */
  entry(locale: string | null | undefined, key: string): MessageEntry | null {
    const loc = this.normalize(locale);
    return CATALOGS[loc][key] ?? CATALOGS.it[key] ?? null;
  }

  /** Interpolazione {parametro} → valore. */
  interpolate(template: string, params?: MessageParams): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      return value === undefined || value === null ? match : String(value);
    });
  }

  /**
   * Rende titolo + corpo scegliendo la variante con un seed deterministico
   * (stesso utente+giorno → stesso testo; giorni diversi → varietà).
   */
  render(
    locale: string | null | undefined,
    key: string,
    params?: MessageParams,
    seed = '',
  ): { title: string; body: string } {
    const entry = this.entry(locale, key);
    if (!entry) return { title: key, body: key };
    const index = entry.variants.length > 1 ? hashString(seed + key) % entry.variants.length : 0;
    return {
      title: this.interpolate(entry.title, params),
      body: this.interpolate(entry.variants[index], params),
    };
  }

  /** Solo il testo (per email e etichette: prima variante o seed). */
  text(locale: string | null | undefined, key: string, params?: MessageParams, seed = ''): string {
    return this.render(locale, key, params, seed).body;
  }
}

/** Hash deterministico (djb2), niente dipendenze. */
export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}
