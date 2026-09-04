/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — file estratto da Metabole e ripulito.
 * Manuale: kit/manuale/01-grafica.md
 * Da fare mentre lo copi: riduci THEMES ai temi che vuoi davvero
 * ⚠️ I commenti che raccontano decisioni ed errori passati sono TENUTI apposta:
 *    sono il motivo per cui il file è fatto così. Non toglierli mentre adatti.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api/client';
import { useAuth } from './auth/AuthContext';

/**
 * I temi commutabili del backoffice. L'id combacia con `[data-theme]` nel CSS **e** con
 * `ACCOUNT_THEMES` nel backend: sono tre posti, e se ne manca uno il tema si applica e poi torna
 * indietro al primo ricaricamento (id non accettato dal salvataggio) oppure la pagina resta senza
 * colori (id senza blocco CSS).
 */
export interface ThemeDef { id: string; label: string; bg: string; surface: string; accent: string; text: string; }
export const THEMES: ThemeDef[] = [
  { id: 'light', label: 'Chiaro · verde', bg: '#faf8f3', surface: '#ffffff', accent: '#12a386', text: '#16302c' },
  { id: 'dark', label: 'Notturno · oro', bg: '#14110b', surface: '#1e1810', accent: '#cba14e', text: '#ece3d0' },
  { id: 'taupe', label: 'Tortora · terracotta', bg: '#e6ded2', surface: '#f5f0e8', accent: '#c2683c', text: '#33291f' },
  { id: 'white', label: 'Minimal · indaco', bg: '#ffffff', surface: '#ffffff', accent: '#5b57c9', text: '#1c1a24' },
  /**
   * Fucsia elegante, non acceso: il fucsia puro (#e91e63) su un fondo chiaro grida e stanca in una
   * giornata di lavoro. Qui l'accento è ABBASSATO verso il magenta scuro (#b03a6e) — contrasto ~5:1
   * sul bianco, quindi leggibile anche in piccolo — e il fondo è un cipria appena rosato che lo
   * accompagna invece di combatterlo. Il testo è un prugna scurissimo, non nero: il nero puro
   * accanto al rosa fa sembrare la pagina una stampa mal calibrata.
   */
  { id: 'fucsia', label: 'Cipria · fucsia', bg: '#f7f0f3', surface: '#ffffff', accent: '#b03a6e', text: '#2b1f27' },
  /**
   * «ACCESO», dettato da Simone: verde mela primario, lo stesso verde desaturato al 50% come
   * secondario, e come accento **l'indaco della combinazione Minimal** (#5b57c9, lo stesso identico).
   *
   * ⚠️ Una libertà, una sola, e sui NUMERI: il verde desaturato al 50% *alla stessa luminosità*
   * (#74882e) è un oliva che sta al buio quanto il verde mela — due fondi indistinguibili, e le card
   * sparirebbero nella pagina. Quindi il secondario è lo stesso colore desaturato **e schiarito**
   * (#edf2d9): resta quel verde, ma fa il mestiere che gli tocca, cioè reggere il testo. Il testo è
   * un verde quasi nero e non nero puro — 6,8:1 sul mela, 14:1 sulle card.
   *
   * ⏪ Il 12/8 è stato provato con il mela sulla barra e il fondo desaturato, e **rimesso com'era**
   * su indicazione di Simone: il fondo torna mela pieno.
   */
  { id: 'acceso', label: 'Acceso · mela e indaco', bg: '#8db600', surface: '#edf2d9', accent: '#5b57c9', text: '#16250a' },
];
const IDS = THEMES.map((t) => t.id);
const DEFAULT = 'light';
const LS_THEME = 'app_bo_theme';
const LS_PICKED = 'app_bo_theme_picked';

function applyDom(theme: string) {
  document.documentElement.dataset.theme = IDS.includes(theme) ? theme : DEFAULT;
}

interface ThemeState { theme: string; setTheme: (t: string) => void; themes: ThemeDef[]; }
const ThemeCtx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<string>(() => {
    try { return localStorage.getItem(LS_THEME) || DEFAULT; } catch { return DEFAULT; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { applyDom(theme); }, [theme]);

  // Quando l'utente è caricato, l'account è la fonte di verità.
  useEffect(() => {
    const u = user as (typeof user & { theme?: string }) | null;
    if (u?.theme && IDS.includes(u.theme)) {
      setThemeState(u.theme);
      try { localStorage.setItem(LS_THEME, u.theme); } catch { /* no-op */ }
    }
    if (user && !safeGet(LS_PICKED)) setPickerOpen(true);
  }, [user]);

  const setTheme = useCallback((t: string) => {
    if (!IDS.includes(t)) return;
    setThemeState(t);
    try { localStorage.setItem(LS_THEME, t); } catch { /* no-op */ }
    applyDom(t);
    api('/me/account', { method: 'PATCH', body: JSON.stringify({ theme: t }) }).catch(() => { /* best-effort */ });
  }, []);

  const closePicker = useCallback(() => {
    try { localStorage.setItem(LS_PICKED, '1'); } catch { /* no-op */ }
    setPickerOpen(false);
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
      {pickerOpen && <ThemePicker onClose={closePicker} />}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeState {
  return useContext(ThemeCtx) ?? { theme: DEFAULT, setTheme: () => undefined, themes: THEMES };
}

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

function Swatch({ t, active, onClick }: { t: ThemeDef; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? '2px solid var(--accent)' : '1px solid var(--line)',
        borderRadius: 14, padding: 12, cursor: 'pointer', textAlign: 'left',
        background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: active ? '0 0 0 4px rgba(18,163,134,0.16)' : 'none', transition: 'box-shadow .15s, border-color .15s',
      }}
    >
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: t.bg, border: '1px solid rgba(0,0,0,.12)' }} />
        <span style={{ width: 26, height: 26, borderRadius: 8, background: t.surface, border: '1px solid rgba(0,0,0,.12)' }} />
        <span style={{ width: 26, height: 26, borderRadius: 8, background: t.accent }} />
      </span>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{t.label}</span>
    </button>
  );
}

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const [sel, setSel] = useState(theme);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', background: 'rgba(8,20,16,.55)', padding: 16 }}>
      <div style={{ width: 'min(520px,100%)', background: 'var(--card)', borderRadius: 20, border: '1px solid var(--line)', padding: 24, boxShadow: 'var(--shadow-hover)' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 4px', color: 'var(--ink)' }}>Scegli il tuo tema</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px' }}>Potrai cambiarlo quando vuoi dalle Impostazioni.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {THEMES.map((t) => <Swatch key={t.id} t={t} active={sel === t.id} onClick={() => { setSel(t.id); setTheme(t.id); }} />)}
        </div>
        <button onClick={onClose} className="btn" style={{ width: '100%', marginTop: 18 }}>Conferma</button>
      </div>
    </div>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {THEMES.map((t) => <Swatch key={t.id} t={t} active={theme === t.id} onClick={() => setTheme(t.id)} />)}
    </div>
  );
}
