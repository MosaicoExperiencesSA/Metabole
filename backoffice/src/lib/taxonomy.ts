import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface TaxItem { code: string; label: string }
/**
 * Una DIETA assegnabile. `style` viaggia col nome perché vanno scritti insieme sul profilo:
 * `pickDietFor` cerca famiglia **e** stile, e una famiglia con lo stile di un'altra non trova
 * niente e ripiega su una dieta vicina (è il difetto §16.10).
 */
export interface TaxFamily {
  name: string;
  style: string | null;
  label: string;
  /**
   * ⛔ **La famiglia si sta chiudendo** (piano panieri): resta assegnabile — chi ce l'ha sopra deve
   * continuare a vederla — ma chi assegna un lead deve sapere che mettercene uno nuovo significa
   * un'altra persona da migrare a mano domani.
   *
   * ⚠️ Facoltativo perché una risposta vecchia dell'API non ce l'ha, e `undefined` deve voler dire
   * «non lo so», non «sì»: marcare per sbaglio una famiglia viva farebbe smettere di assegnarla.
   */
  inChiusura?: boolean;
}
export interface Taxonomy { regimes: TaxItem[]; styles: TaxItem[]; families?: TaxFamily[]; cookingMethods?: TaxItem[] }

// Fallback (usati finché la fetch non risponde e se l'API fallisce).
const DEFAULT_REGIMES: TaxItem[] = [
  { code: 'omnivore', label: 'Onnivora' },
  { code: 'vegetarian', label: 'Vegetariana' },
  { code: 'vegan', label: 'Vegana' },
];
const STYLE_LABELS: Record<string, string> = {
  mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile', keto: 'Keto', keto_mediterranean: 'Keto-Mediterranea', dash: 'DASH',
};

// Fallback stili: se l'API non risponde, le tendine restano comunque usabili.
const DEFAULT_STYLES: TaxItem[] = Object.entries(STYLE_LABELS).map(([code, label]) => ({ code, label }));

/** Ripiego dei metodi di cottura: l'elenco vero è `backend/src/common/metodi-cottura.ts`. */
const METODI_RIPIEGO: TaxItem[] = [
  { code: 'veloce', label: 'Veloce' },
  { code: 'forno', label: 'Al forno' },
  { code: 'padella', label: 'In padella' },
  { code: 'vapore', label: 'Al vapore' },
  { code: 'meal_prep', label: 'Meal prep' },
  { code: 'piatto_freddo', label: 'Piatto freddo' },
];

// Cache di modulo: una sola fetch condivisa fra tutti i componenti.
let cache: Taxonomy | null = null;

/**
 * Regimi (configurabili dalle impostazioni) + stili (ricavati dalle diete esistenti).
 * Ritorna le liste per i menu a tendina e due helper per le etichette.
 */
export function useTaxonomy() {
  const [tax, setTax] = useState<Taxonomy>(cache ?? { regimes: DEFAULT_REGIMES, styles: DEFAULT_STYLES, families: [], cookingMethods: METODI_RIPIEGO });

  function load() {
    api<Taxonomy>('/catalog/taxonomy')
      .then((t) => {
        const norm: Taxonomy = {
          regimes: t.regimes?.length ? t.regimes : DEFAULT_REGIMES,
          styles: t.styles?.length ? t.styles : DEFAULT_STYLES, // catalogo senza diete → tendina comunque usabile
          // Nessun ripiego inventato: se il catalogo non risponde la tendina «Dieta» resta vuota e
          // si vede. Un elenco di diete finto farebbe scegliere una dieta che non esiste.
          families: t.families ?? [],
          // I metodi di cottura li decide il backend (`common/metodi-cottura.ts`). Il ripiego serve
          // solo finché la risposta non arriva: senza, la tendina della ricetta sarebbe vuota e
          // sembrerebbe rotta.
          cookingMethods: t.cookingMethods?.length ? t.cookingMethods : METODI_RIPIEGO,
        };
        cache = norm;
        setTax(norm);
      })
      .catch(() => { /* resta il fallback */ });
  }
  useEffect(() => { load(); }, []);

  const regimeLabel = (code: string) => tax.regimes.find((r) => r.code === code)?.label ?? code;
  const styleLabel = (code: string) => tax.styles.find((s) => s.code === code)?.label ?? STYLE_LABELS[code] ?? code;

  const families = tax.families ?? [];
  const cookingMethods = tax.cookingMethods?.length ? tax.cookingMethods : METODI_RIPIEGO;
  const metodoLabel = (code: string) => cookingMethods.find((m) => m.code === code)?.label ?? code.replace(/_/g, ' ');
  const familyLabel = (name: string) => families.find((f) => f.name === name)?.label ?? name;
  return { regimes: tax.regimes, styles: tax.styles, families, cookingMethods, regimeLabel, styleLabel, familyLabel, metodoLabel, reload: load };
}
