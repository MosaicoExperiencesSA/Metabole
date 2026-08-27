import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { api, apiPublic, getRefreshToken, setAccessToken, setOspite, setRefreshToken } from '../api/client';
import { track, currentRefcod } from '../lib/track';
import { dimenticaAperture } from '../lib/giorno-aperto';

const WIDGET_TOKEN_KEY = 'metabole_widget_token';

/** Sul nativo: ottiene un token widget (lunga scadenza) e lo salva nello storage
 *  condiviso (SharedPreferences "CapacitorStorage") che il widget da home screen legge. */
async function syncWidgetToken() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { token } = await api<{ token: string }>('/auth/widget-token', { method: 'POST' });
    await Preferences.set({ key: WIDGET_TOKEN_KEY, value: token });
  } catch {
    /* il widget resterà sull'ultimo stato noto */
  }
}

export interface User {
  id: string;
  email: string;
  role: string;
  locale: string;
  status: string;
  emailVerifiedAt: string | null;
  firstName?: string | null;
  lastName?: string | null;
  // true per gli account provvisori (es. lead creati da backoffice con password di
  // default): l'app forza l'impostazione di una password personale a fine questionario.
  mustChangePassword?: boolean;
  // Utenza gemella (cliente <-> staff, stessa persona): abilita "Passa all'altro profilo".
  linkedUserId?: string | null;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  email: string;
  // Telefono già combinato (prefisso + numero), obbligatorio con l'email.
  phone: string;
  password: string;
  refCode?: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * «ENTRA COME»: il backoffice apre QUESTA app in una scheda nuova, con il token
 * di impersonazione nel **frammento** dell'indirizzo (`/entra#t=…`).
 *
 * Nel frammento e non nella query per due motivi: il frammento non viaggia verso il server e non
 * finisce nell'header `Referer` quando la pagina carica un'immagine o un font di terzi. E si
 * cancella dalla barra degli indirizzi appena letto, così non resta nella cronologia di chi guarda.
 *
 * Prima il pulsante scambiava la sessione DENTRO il backoffice: ma una cliente nel backoffice non
 * ha nessuna pagina, e chi premeva «Entra come» finiva su «Accesso non consentito». Il posto dove
 * si guarda l'app di una cliente è l'app.
 */
function tokenDalFrammento(): string | null {
  if (typeof window === 'undefined') return null;
  const frammento = window.location.hash.replace(/^#/, '');
  if (!frammento) return null;
  const t = new URLSearchParams(frammento).get('t');
  if (!t) return null;
  // Via dalla barra degli indirizzi, subito: non deve restare nella cronologia.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return t;
}

interface AuthValue {
  user: User | null;
  /** Sessione «Entra come»: si guarda l'account di un'altra persona, in sola lettura. */
  ospite: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  switchAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ospite, setOspiteState] = useState(false);

  useEffect(() => {
    (async () => {
      // Il token di «Entra come» vince su qualsiasi sessione salvata su questo browser, e non la
      // tocca: il refresh token di chi ha fatto login resta dov'è, e alla scadenza dei 30 minuti
      // NON viene usato (vedi `setOspite` in api/client).
      const tokenOspite = tokenDalFrammento();
      if (tokenOspite) {
        setOspite(true);
        setOspiteState(true);
        setAccessToken(tokenOspite);
        try {
          setUser(await api<User>('/me'));
        } catch {
          setAccessToken(null);
          setOspite(false);
          setOspiteState(false);
        } finally {
          setLoading(false);
        }
        return;
      }
      if (!getRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api<User>('/me')); // l'api rinnova l'access token in automatico
        void syncWidgetToken();
      } catch {
        setRefreshToken(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function applyAuth(res: AuthResponse) {
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
    /**
     * ⛔ **Cambia la persona: quello che sapevamo dei suoi giorni non vale più** (26/8). «Passa
     * all'altro profilo» cambia utente **senza ricaricare la pagina** — madre e figlia sullo stesso
     * telefono — e l'elenco dei giorni già segnati come aperti vive in un modulo. Senza questa riga
     * il 27 già mandato per la prima zittiva il segnale della seconda, e i suoi menu restavano «non
     * lo so» per il server: nessuno glieli avrebbe più rifatti.
     */
    dimenticaAperture();
    void syncWidgetToken();
  }

  async function login(email: string, password: string) {
    const res = await apiPublic<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    applyAuth(res);
    track('login', { role: res.user?.role });
  }

  async function register(data: RegisterPayload) {
    const body: Record<string, string> = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      password: data.password,
    };
    if (data.addressLine?.trim()) body.addressLine = data.addressLine.trim();
    if (data.postalCode?.trim()) body.postalCode = data.postalCode.trim();
    if (data.city?.trim()) body.city = data.city.trim();
    if (data.province?.trim()) body.province = data.province.trim().toUpperCase();
    if (data.refCode?.trim()) body.refCode = data.refCode.trim().toUpperCase();
    // Se non è stato inserito un ref code ma l'utente è arrivato da ?ref=CODICE,
    // lo usiamo per l'attribuzione commerciale (vedi Tracciamento_Dati §2).
    else {
      const ref = currentRefcod();
      if (ref) body.refCode = ref.toUpperCase();
    }
    const res = await apiPublic<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    applyAuth(res);
    track('register', { refcod: body.refCode ?? null });
  }

  async function logout() {
    track('logout');
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await apiPublic('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      /* logout locale comunque */
    }
    setRefreshToken(null);
    setAccessToken(null);
    setUser(null);
    dimenticaAperture();
    if (Capacitor.isNativePlatform()) { try { await Preferences.remove({ key: WIDGET_TOKEN_KEY }); } catch { /* ignora */ } }
  }

  /** "Passa all'altro profilo": nuova coppia di token per l'utenza collegata, senza logout. */
  async function switchAccount() {
    const res = await api<AuthResponse>('/auth/switch', { method: 'POST' });
    applyAuth(res);
    track('switch_account', { role: res.user?.role });
  }

  async function refreshMe() {
    try {
      setUser(await api<User>('/me'));
    } catch {
      /* ignora */
    }
  }

  return (
    <AuthContext.Provider value={{ user, ospite, loading, login, register, logout, refreshMe, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuori da AuthProvider');
  return ctx;
}
