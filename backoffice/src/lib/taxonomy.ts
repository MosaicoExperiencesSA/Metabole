import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface TaxItem { code: string; label: string }
export interface Taxonomy { regimes: TaxItem[]; styles: TaxItem[] }

// Fallback (usati finché la fetch non risponde e se l'API fallisce).
const DEFAULT_REGIMES: TaxItem[] = [
  { code: 'omnivore', label: 'Onnivora' },
  { code: 'vegetarian', label: 'Vegetariana' },
  { code: 'vegan', label: 'Vegana' },
];
const STYLE_LABELS: Record<string, string> = {
  mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile', keto: 'Keto', dash: 'DASH',
};

// Fallback stili: se l'API non risponde, le tendine restano comunque usabili.
const DEFAULT_STYLES: TaxItem[] = Object.entries(STYLE_LABELS).map(([code, label]) => ({ code, label }));

// Cache di modulo: una sola fetch condivisa fra tutti i componenti.
let cache: Taxonomy | null = null;

/**
 * Regimi (configurabili dalle impostazioni) + stili (ricavati dalle diete esistenti).
 * Ritorna le liste per i menu a tendina e due helper per le etichette.
 */
export function useTaxonomy() {
  const [tax, setTax] = useState<Taxonomy>(cache ?? { regimes: DEFAULT_REGIMES, styles: DEFAULT_STYLES });

  function load() {
    api<Taxonomy>('/catalog/taxonomy')
      .then((t) => {
        const norm: Taxonomy = {
          regimes: t.regimes?.length ? t.regimes : DEFAULT_REGIMES,
          styles: t.styles?.length ? t.styles : DEFAULT_STYLES, // catalogo senza diete → tendina comunque usabile
        };
        cache = norm;
        setTax(norm);
      })
      .catch(() => { /* resta il fallback */ });
  }
  useEffect(() => { load(); }, []);

  const regimeLabel = (code: string) => tax.regimes.find((r) => r.code === code)?.label ?? code;
  const styleLabel = (code: string) => tax.styles.find((s) => s.code === code)?.label ?? STYLE_LABELS[code] ?? code;

  return { regimes: tax.regimes, styles: tax.styles, regimeLabel, styleLabel, reload: load };
}
