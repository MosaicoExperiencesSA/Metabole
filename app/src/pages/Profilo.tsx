import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AppHeader from '../components/AppHeader';
import BrandPicker from '../components/BrandPicker';
import WaterUnitPicker from '../components/WaterUnitPicker';
import NotificationPrefs from '../components/NotificationPrefs';
import Sheet from '../components/Sheet';
import { baseDaMostrare, fraseQuante, type RispostaBase } from '../lib/base-certificata';
import { parseCodiceFiscale } from '../lib/codiceFiscale';
import { raccontaSpuntiniEsclusi } from '../lib/spuntiniEsclusi';
import { elencoIntolleranze, statoAllergie } from '../lib/vincoliProfilo';
import { DIET_INFO, DIET_INFO_FONTI } from '../onboarding/dietInfo';

const PHONE_PREFIXES = ['+39', '+41', '+33', '+49', '+43', '+44', '+34', '+32', '+31', '+351', '+386', '+1'];
const COUNTRIES = ['Italia', 'Svizzera', 'Francia', 'Germania', 'Austria', 'Regno Unito', 'Spagna', 'Belgio', 'Paesi Bassi', 'Portogallo', 'Slovenia', 'Altro'];

interface AddrSuggestion { label: string; addressLine: string; postalCode: string; city: string; province: string; country: string; }

function splitPhone(p: string | null): { prefix: string; number: string } {
  if (!p) return { prefix: '+39', number: '' };
  const m = p.trim().match(/^(\+\d{1,3})\s*(.*)$/);
  if (m) return { prefix: m[1], number: m[2] };
  return { prefix: '+39', number: p.trim() };
}

/**
 * I pasti saltati, a parole — **per leggerli, non per sceglierli** (21/8).
 *
 * ⚠️ Servono solo a chi l'orologio non l'ha ancora toccato: la sua finestra storica sta decidendo
 * quali pasti riceve, e senza queste frasi la leggerebbe come `skip_all_but_dinner`. Chi ha
 * impostato i suoi orari legge invece le fasce, che sono la cosa vera.
 *
 * ⚠️ Copia delle etichette cliente di `backend/src/menu/finestre-digiuno.ts`, che è la tabella
 * unica: un frontend non può importare dal backend. Ci sono **tutte e otto**, compresa la ritirata e
 * le tre che l'orologio calcola — `finestre-nelle-tendine.spec.ts` lo verifica sul sorgente.
 */
const SALTA_LABEL: Record<string, string> = {
  skip_breakfast: 'Salti la colazione — mangi da pranzo a cena',
  skip_dinner: 'Salti la cena — mangi da colazione a pranzo',
  skip_lunch: 'Salti il pranzo — mangi a colazione e a cena',
  skip_breakfast_lunch: 'Salti colazione e pranzo — solo la cena',
  skip_dinner_breakfast: 'Salti cena e colazione — finestra a metà giornata',
  // ⚠️ Le tre finestre nate dall'orologio (21/8): NON si scelgono da qui — le calcola la durata
  // della finestra — ma si devono poter **leggere**, o la cliente vede il codice grezzo.
  skip_morning_snack: 'Mangi da colazione a cena, senza lo spuntino del mattino',
  skip_breakfast_and_snacks: 'Mangi due volte al giorno — pranzo e cena',
  skip_all_but_dinner: 'Un pasto solo al giorno',
};

const REGIME_LABEL: Record<string, string> = {
  omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana', pescetarian: 'Pescetariana',
};

interface Nutrition {
  regime: string | null; dietStyle: string | null; mealsPerDay: number | null;
  fasting: boolean; fastingWindow: string | null; dietName: string | null; coachName: string | null;
  /**
   * ⛔ **LE FASCE, quando l'orologio l'ha già impostato** (21/8). È `vistaOrologio(...).attuale` del
   * backend: la stessa risposta che dà `/me/digiuno`, non un secondo conto fatto qui.
   * ⚠️ `null` = non l'ha ancora toccato. Non si compone una finestra di scorta: mostrarle orari che
   * nessuno ha impostato è la stessa bugia del «16:8» scritto a mano, con più cifre.
   */
  digiuno?: {
    protocollo: string; apertura: string; chiusura: string;
    oreFinestra: number; oreDigiuno: number;
    pasti: { slot: string; oraMin: number; ora: string; etichetta: string }[];
  } | null;
  /**
   * Gli spuntini che la nutrizionista ha tolto a lei («togli lo spuntino», azione 3
   * dell'assistente). Il motore li rispetta già da giorni: qui si dicono, che è tutta la voce 235.
   */
  pastiEsclusi?: string[];
  /**
   * I due vincoli che decidono cosa NON può esserci nel piatto (Simone, 16/8). Erano già in
   * profilo, ma nel riquadro «Cibi esclusi» più in basso: qui salgono in sintesi.
   * ⚠️ `allergieDichiarateIl` a `null` = non gliel'abbiamo mai chiesto, che NON è «nessuna».
   */
  allergies?: string[];
  intolerances?: string[];
  allergieDichiarateIl?: string | null;
  /** La descrizione che la nutrizionista ha scritto per la cliente su QUESTA dieta. */
  dietDescription?: string | null;
  /** Lo stile della dieta assegnata: la chiave delle schede generali (`DIET_INFO`). */
  dietStyleAssegnato?: string | null;
  /**
   * ⚠️ I menu che deve ancora ricevere sono ancora quelli della dieta PRECEDENTE.
   *
   * Il backend lo manda da sempre e **l'app non lo usava**: la cliente leggeva «Mediterranea senza
   * glutine» qui e trovava il pane nel menu di domani, senza che niente le dicesse perché. Con il
   * glutine di mezzo non è un dettaglio di interfaccia.
   */
  menuAncoraSullaDietaPrecedente?: boolean;
  /** Il nome della dieta su cui sono costruite quelle giornate. */
  dietNameMenuInCorso?: string | null;
}

/**
 * "La mia alimentazione" (richiesta Simone 6/8): tipo di alimentazione, numero di pasti e
 * dieta assegnata, in sola lettura. Sono le tre cose che decidono i menu, e finora la cliente
 * le sceglieva in registrazione e poi non le rivedeva più — non sapeva nemmeno cosa stava
 * seguendo. Non sono modificabili qui di proposito: cambiarle cambia il piano ed è una
 * decisione clinica. Ma si dice a chi chiedere, invece di lasciare un muro.
 */
function MyNutrition() {
  const nav = useNavigate();
  const [n, setN] = useState<Nutrition | null>(null);
  const [stato, setStato] = useState<'carico' | 'ok' | 'ko'>('carico');
  /** Il foglio informativo sulla dieta è aperto: stesso pattern del «?» nel questionario. */
  const [info, setInfo] = useState(false);
  /**
   * LA BASE CERTIFICATA. ⚠️ Lettura a parte e **sotto `catch`**: è un di più, e se non arriva la
   * riga semplicemente non c'è. Legarla al caricamento del riepilogo vorrebbe dire far sparire
   * dieta, allergie e regime perché non si è saputo contare le ricette sicure.
   */
  const [base, setBase] = useState<RispostaBase | null>(null);

  useEffect(() => {
    api<Nutrition>('/me/nutrition')
      .then((r) => { setN(r); setStato('ok'); })
      .catch(() => setStato('ko'));
    api<RispostaBase>('/me/personal-base')
      .then(setBase)
      .catch(() => setBase(null));
  }, []);

  if (stato === 'carico') return <div className="card"><p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Carico…</p></div>;
  if (stato === 'ko' || !n) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Il riepilogo non è disponibile in questo momento. Se ti serve subito, chiedilo alla tua coach.
        </p>
      </div>
    );
  }

  // ⚠️ Qui prima finiva la stringa tecnica: la cliente leggeva «Digiuno intermittente (finestra
  // skip_breakfast)». Il nome dei pasti saltati ha una riga sua, qui sotto, con le parole vere.
  /**
   * ⛔ **QUI C'ERA «Digiuno intermittente 16:8», SCRITTO A MANO** (corretto il 21/8).
   *
   * Era vero finché 16:8 era l'unica finestra che il percorso conosceva. Da quando la durata la
   * sceglie lei, a una cliente sulla 14:10 questa riga diceva il protocollo **di un'altra** — nella
   * schermata che esiste apposta per farle leggere il suo piano. Una costante nel sorgente non dà
   * errore quando smette di essere vera: continua a rispondere, con sicurezza.
   */
  const pasti = n.fasting
    ? `Digiuno intermittente${n.digiuno ? ` ${n.digiuno.protocollo}` : ''}`
    : n.mealsPerDay
      ? `${n.mealsPerDay} pasti al giorno`
      : null;
  const riga = (
    icona: string,
    etichetta: string,
    valore: string | null,
    vuoto: string,
    // Il «?» come nel questionario: `onInfo` presente = la riga ha una spiegazione da aprire.
    onInfo?: () => void,
    /**
     * ⚠️ **Un'altra pagina, non un'altra spiegazione** (21/8). Il «?» apre un foglio che racconta;
     * questa freccia porta dove la cosa si *cambia*. Sono due gesti diversi e devono avere due segni
     * diversi: un «?» che invece di spiegare porta via è il modo più rapido per insegnare a non
     * toccarlo più.
     */
    onVai?: { dove: () => void; etichetta: string },
  ) => (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
      <i className={`ti ti-${icona}`} style={{ fontSize: 17, color: 'var(--teal)', flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="muted" style={{ fontSize: 11.5 }}>{etichetta}</div>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{valore ?? <span className="muted" style={{ fontWeight: 400 }}>{vuoto}</span>}</div>
      </div>
      {onInfo && (
        <button
          type="button"
          className="info-dot"
          aria-label={`Cos'è la dieta ${valore ?? ''}`.trim()}
          onClick={onInfo}
        >
          ?
        </button>
      )}
      {onVai && (
        <button
          type="button"
          aria-label={onVai.etichetta}
          onClick={onVai.dove}
          style={{
            background: 'none', border: 0, padding: 6, margin: 0, cursor: 'pointer',
            color: 'var(--teal)', lineHeight: 0, flex: 'none', alignSelf: 'center',
          }}
        >
          <i className="ti ti-chevron-right" style={{ fontSize: 20 }} />
        </button>
      )}
    </div>
  );

  /**
   * Cosa mostrare nel foglio: prima la descrizione che la nutrizionista ha scritto per lei, poi la
   * scheda generale dello stile. L'ordine è quello deciso l'8/8 e ha una ragione: `clientDescription`
   * parla di *quel* percorso e vale più di una scheda generica, ma non è sempre compilata —
   * `DIET_INFO` c'è sempre e porta le fonti, che sono la parte che rende credibile il popup.
   */
  const stileScheda = n.dietStyleAssegnato ?? n.dietStyle;
  const scheda = stileScheda ? DIET_INFO[stileScheda] : undefined;
  const haInfoDieta = Boolean(n.dietDescription || scheda);
  // `null` quando non le è stato tolto niente: la riga non compare proprio, invece di dire «nessuno».
  const spuntiniTolti = raccontaSpuntiniEsclusi(n.pastiEsclusi);
  const allergie = statoAllergie(n.allergies, n.allergieDichiarateIl);
  const intolleranze = elencoIntolleranze(n.intolerances);

  return (
    <div className="card">
      <div style={{ marginTop: -9 }}>
        {/*
          ⚠️ QUI C'ERA «Tipo di alimentazione», ed è stata TOLTA l'11/8.

          Diceva lo STILE scelto in registrazione, che non identifica una dieta: «Mediterranea»,
          «Mediterranea ipocalorica» e «Pescetariana» hanno tutte lo stesso codice. Nel profilo di
          una cliente che segue la Pescetariana si leggeva «Tipo di alimentazione: Mediterranea» e
          sotto «La tua dieta: Pescetariana»: due righe che si contraddicono, e nessuna delle due
          sbagliata da sola. E siccome lo stile non cambia quando la nutrizionista sposta la cliente
          su un'altra dieta, restava anche indietro.

          «La tua dieta» qui sotto dice il nome vero, e il «?» apre la scheda: sono le due cose che
          servono davvero.
        */}
        {riga('clock-hour-4', 'Pasti', pasti, 'non ancora impostati')}
        {/*
          ⛔ **LE SUE FASCE, non il nome dei pasti che salta** (21/8).

          Qui si leggeva «Salti la colazione — mangi da pranzo a cena», e sotto, in fondo alla
          pagina, c'erano i pallini per cambiarla. Erano la seconda risposta alla stessa domanda:
          l'orologio in home ne dava un'altra, e le due si contraddicevano a ogni tocco. Adesso c'è
          una riga sola, dice **gli orari** — che è la cosa che lei guarda quando ha fame — e la
          freccia porta nell'unico posto dove si sposta.

          ⚠️ I tre stati sono scritti diversi perché **sono diversi**:
           - ha impostato l'orologio → le sue fasce, e quanti pasti;
           - finestra vecchia, orologio mai toccato → la frase della sua finestra, senza orari
             inventati: è quello che il motore sta usando per lei davvero;
           - niente → «non l'hai ancora impostata», che non è «li decide la tua dieta» (voce 256).
             Nessuna scelta non è una scelta.
        */}
        {n.fasting && riga(
          'clock-play',
          'La tua finestra',
          n.digiuno
            ? `${n.digiuno.apertura} – ${n.digiuno.chiusura} · ${n.digiuno.pasti.length} ${n.digiuno.pasti.length === 1 ? 'pasto' : 'pasti'}`
            : n.fastingWindow
              ? (SALTA_LABEL[n.fastingWindow] ?? n.fastingWindow)
              : null,
          'non l\'hai ancora impostata',
          undefined,
          { dove: () => nav('/digiuno'), etichetta: 'Apri il tuo orologio del digiuno' },
        )}
        {/*
          ⚠️ GLI SPUNTINI TOLTI DALLA NUTRIZIONISTA (voce 235). Il motore li rispetta dal 13/8 e
          nessuna schermata lo diceva: la cliente riceveva giornate senza merenda senza sapere
          perché — lo stesso buco che avevano le allergie. Sola lettura: questo non lo cambia lei,
          e non c'entra col digiuno: sono spuntini, la finestra riguarda i pasti principali.
        */}
        {spuntiniTolti && riga('circle-minus', 'Tolti dalla tua nutrizionista', spuntiniTolti, '')}
        {riga(
          'book',
          'La tua dieta',
          n.dietName,
          'te la assegna la nutrizionista',
          haInfoDieta ? () => setInfo(true) : undefined,
        )}
        {n.regime && riga('leaf', 'Regime', REGIME_LABEL[n.regime] ?? n.regime, '')}
        {/*
          ⚠️ ALLERGIE E INTOLLERANZE IN SINTESI (Simone, 16/8). Il dettaglio e la spiegazione lunga
          restano nel riquadro «Cibi esclusi» più sotto: qui c'è quello che serve a leggere il
          proprio piano in una schermata, accanto alla dieta e al regime.

          ⚠️ La riga delle allergie c'è SEMPRE, anche vuota. Se sparisse quando non ce ne sono, la
          sua assenza si leggerebbe come «non ne ho» — che è un'affermazione, e non tocca a una riga
          mancante farla. E «nessuna» si scrive solo se gliel'abbiamo chiesto davvero: altrimenti si
          dice che non risultano, che è la verità (`statoAllergie`).
        */}
        {riga(
          'alert-triangle',
          'Allergie',
          allergie.tipo === 'elenco' ? allergie.testo : allergie.tipo === 'nessuna' ? 'Nessuna' : null,
          'non risultano allergie dichiarate',
        )}
        {/* Le intolleranze invece compaiono solo se ci sono: un elenco vuoto non afferma niente. */}
        {intolleranze && riga('mood-sick', 'Intolleranze', intolleranze, '')}
        {/*
          La domanda che quella riga fa nascere è una sola — «allora mangio meno?» — e la risposta
          è un fatto, non una rassicurazione: `slotEsclusiTotali` ridistribuisce le kcal di quel
          pasto sugli altri, la stessa strada del digiuno. Scriverlo qui costa due righe e evita un
          messaggio alla coach.
        */}
        {spuntiniTolti && (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
            Le calorie di quel pasto sono ridistribuite sugli altri: la giornata resta completa.
            Se non ti torna, parlane con la tua coach.
          </div>
        )}
        {/*
          ⚠️ Sola lettura, e va detto DOVE si cambia. Le allergie sono un dato clinico: le corregge
          la nutrizionista. Una riga che si vede e non si tocca, senza dire come si cambia, insegna
          solo che l'app non ascolta.
        */}
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
          Allergie e intolleranze le corregge la tua nutrizionista: scrivile in chat.
          Le allergie le teniamo fuori dai menu sempre, tracce e derivati compresi.
        </div>
        {/*
          ⚠️ LA CONSEGUENZA DI QUELLE RIGHE, DETTA A LEI (18/8). `GET /me/personal-base` risponde da
          sempre con quante ricette del catalogo sono state certificate sicure per questa cliente e
          con la firma del certificato di personalizzazione — e nell'app non lo chiamava NESSUNO.

          Sta qui e non altrove perché è qui che nasce la domanda: sopra ha appena letto le sue
          allergie e la frase «le teniamo fuori dai menu sempre». La domanda che segue è «e allora
          cosa mi resta?», e la risposta è un numero che esisteva già.

          ⚠️ Se la lettura non riesce non compare niente: «0 ricette certificate sicure per te»
          detto perché una chiamata è andata storta sarebbe falso, e spaventoso.
        */}
        {(() => {
          const b = baseDaMostrare(base);
          if (!b) return null;
          if (b.tipo === 'in_lavorazione') {
            return (
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
                <i className="ti ti-shield-half" style={{ verticalAlign: '-2px', marginRight: 5 }} />
                {b.testo}
              </div>
            );
          }
          return (
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
              <i className="ti ti-shield-check" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              {fraseQuante(b.quante)}: il motore pesca solo da lì.
              {/*
                ⚠️ La firma si mostra piccola e si dice COSA È, senza chiedere a lei di farci
                qualcosa. È la prova che la personalizzazione è avvenuta davvero — la cosa che il
                prodotto promette — e una prova che esiste solo nel database non è una prova per chi
                dovrebbe fidarsi.
              */}
              {b.firma && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, opacity: 0.85 }}>
                  Certificato di personalizzazione{b.versione ? ` n. ${b.versione}` : ''} · firma {b.firma}
                </span>
              )}
            </div>
          );
        })()}
      </div>
      {/*
        Il cambio dieta è deciso ma le giornate in arrivo sono ancora quelle vecchie. Va detto QUI,
        accanto al nome della dieta, perché è esattamente il punto in cui le due cose si
        contraddicono — e va detto senza allarmare: non è un errore, sono menu che devono ancora
        essere rifatti.
      */}
      {n.menuAncoraSullaDietaPrecedente && (
        <div className="card" style={{ background: '#FDECC8', boxShadow: 'none', padding: 11, marginTop: 10 }}>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#8A5A00' }}>
            <i className="ti ti-info-circle" style={{ verticalAlign: '-2px', marginRight: 5 }} />
            I menu dei prossimi giorni sono ancora quelli{n.dietNameMenuInCorso ? ` della ${n.dietNameMenuInCorso}` : ' della dieta precedente'}:
            il cambio è stato deciso e le giornate vengono rifatte. Se in questi giorni trovi qualcosa
            che non va bene per te, scrivilo alla tua coach prima di mangiarlo.
          </span>
        </div>
      )}
      {n.fasting && (
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '10px 0 0' }}>
          I pasti che salti puoi cambiarli tu più sotto, in questa pagina. Se non è una preferenza ma
          qualcosa che non funziona — fame, giramenti di testa, orari di lavoro — parlane con la tua
          coach: si può cambiare anche la finestra, non solo saltare un pasto in più.
        </p>
      )}
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '12px 0 0' }}>
        Questi valori li imposta la nutrizionista e non si cambiano da qui: toccarli cambia i menu che
        ricevi. Se pensi che non siano più adatti a te{n.coachName ? `, parlane con ${n.coachName}` : ', parlane con la tua coach'} —
        se ne occupa lei.
      </p>
      <button className="btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/assistente?who=coach')}>
        <i className="ti ti-message-circle" /> Chiedi un cambio alla coach
      </button>

      {/*
        LA SCHEDA DELLA SUA DIETA (richiesta di Simone dell'8/8: «mettiamo il ? come nel
        questionario, col popup con le caratteristiche di quella dieta»).

        Fino a oggi la cliente leggeva un nome — «Flexitariana» — e nient'altro: aveva scelto in
        registrazione, dove la spiegazione c'era, e nel profilo quel nome tornava nudo mesi dopo.
        Qui si mostrano ENTRAMBE le cose quando ci sono: prima la descrizione che la nutrizionista
        ha scritto per lei (parla del suo percorso), poi la scheda generale dello stile con le fonti.
      */}
      {info && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setInfo(false); }}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '82vh', overflowY: 'auto' }}>
            <div className="sheet-grab" />
            <b style={{ fontSize: 16 }}>{n.dietName ?? scheda?.titolo ?? 'La tua dieta'}</b>

            {n.dietDescription && (
              <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: '8px 0 0' }}>{n.dietDescription}</p>
            )}

            {scheda && (
              <>
                {/* Il titolo dello stile si ripete solo se è diverso dal nome della dieta:
                    «Mediterranea» sotto «Mediterranea» è rumore. */}
                {scheda.titolo !== n.dietName && (
                  <div className="sec" style={{ margin: '14px 0 4px' }}>{scheda.titolo}</div>
                )}
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: n.dietDescription ? '10px 0 0' : '8px 0 0' }}>
                  {scheda.cose}
                </p>

                <div className="sec" style={{ margin: '14px 0 4px' }}>In pratica</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{scheda.inPratica}</p>

                <div className="sec" style={{ margin: '14px 0 4px' }}>Cosa dice la ricerca</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{scheda.cosaDiceLaRicerca}</p>

                <div className="sec" style={{ margin: '14px 0 4px' }}>Da tenere presente</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{scheda.attenzione}</p>

                <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '14px 0 0' }}>
                  Fonti: {(scheda.fonti ?? DIET_INFO_FONTI).join(' · ')}. Sono informazioni generali, non un
                  consiglio medico: il tuo piano lo decide la tua nutrizionista.
                </p>
              </>
            )}

            <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => setInfo(false)}>
              Ho capito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Profilo cliente: piano attivo (giorno X di N) + storico acquisti con
 * possibilità di scaricare la ricevuta PDF dei pagamenti confermati.
 */

interface MyProfile {
  email: string; secondaryEmail: string | null; firstName: string | null; lastName: string | null; nickname: string | null;
  addressLine: string | null; postalCode: string | null; city: string | null; province: string | null; country: string | null; phone: string | null;
  birthDate: string | null; codiceFiscale: string | null;
}
interface Plan { name: string; period: string; priceCents: number; }
interface Subscription { id: string; status: string; startDate: string | null; endDate: string | null; firstMenuDate: string | null; plan: Plan | null; }
interface Payment { id: string; description: string; amountCents: number; method: string; status: string; createdAt: string; }

/**
 * L'abbonamento RICORRENTE (`GET /me/subscription/recurring`), che è un'altra cosa dal piano qui
 * sopra: qui c'è solo quello con addebito automatico su carta, e `null` se non ce n'è.
 */
interface Ricorrente { id: string; nome: string; prezzoCents: number; rinnovaIl: string | null; disdettaChiesta: boolean; pagamentoFallito: boolean; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const DAY = 86_400_000;

const STATUS: Record<string, { label: string; bg: string; col: string }> = {
  pending: { label: 'In attesa', bg: '#FBF0D9', col: '#8A6D1B' },
  receipt_uploaded: { label: 'Contabile inviata', bg: '#E4EEF9', col: '#2B5A93' },
  approved: { label: 'Pagato', bg: '#DCF0D8', col: '#3B6D11' },
  rejected: { label: 'Rifiutato', bg: '#F9E1DE', col: '#B3261E' },
  cancelled: { label: 'Annullato', bg: '#EEE', col: '#666' },
};
const METHOD: Record<string, string> = { card: 'Carta', bank_transfer: 'Bonifico', manual: 'Manuale' };

/** La data "vera" di inizio per la cliente è quella del PRIMO MENU erogato (non l'iscrizione). */
function planStart(sub: Subscription): string | null {
  return sub.firstMenuDate ?? sub.startDate;
}

function planProgress(sub: Subscription): { day: number; total: number; pct: number } | null {
  const startIso = planStart(sub);
  if (!startIso || !sub.endDate) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  const total = Math.max(1, Math.round((end - start) / DAY));
  const day = Math.min(total, Math.max(1, Math.floor((now - start) / DAY) + 1));
  return { day, total, pct: Math.round((day / total) * 100) };
}

/**
 * SPOSTARE LA DATA DI INIZIO DEL PIANO, dal profilo (richiesta di Simone dell'11/8: «dal profilo,
 * cliccando sul piano, mi fa modificare la data di inizio fino a 24 ore prima»).
 *
 * Fino a ieri questa cosa si poteva fare in due modi: dal backoffice (una coach, col suo permesso)
 * oppure chiedendolo a Gaia in chat. Chi comprava con la data sbagliata e non se la sentiva di
 * scrivere in chat non aveva nessuna strada.
 *
 * ## Perché prima si CHIEDE al server e poi si disegna
 *
 * `GET /me/plan-start` risponde se si può, e con quali limiti. La regola sta lì e non qui: le ore di
 * blocco sono un parametro di configurazione (`plan_start_change_lock_hours`) che si cambia dal
 * backoffice senza nessuna pubblicazione, e un'app che le avesse scritte dentro resterebbe indietro
 * fino alla OTA successiva — dicendo «puoi» dove il server dice «no», che è il modo più rapido di
 * far sembrare l'app rotta.
 *
 * Per lo stesso motivo il pulsante **non compare** quando non si può: un pulsante che c'è e poi
 * risponde «non si può» è peggio di un pulsante che non c'è, perché la spiegazione arriva dopo il
 * tocco invece che al posto suo. Quando manca poco, al suo posto c'è la frase con la strada che
 * resta aperta (la coach in chat).
 */
function DataInizioPiano({ onSpostata }: { onSpostata: () => void }) {
  interface Stato {
    puo: boolean;
    perche?: 'nessun_piano' | 'gia_partito' | 'troppo_tardi';
    inizio: string | null;
    oreMancanti?: number;
    oreDiBlocco: number;
    massimoGiorniAvanti: number;
    minimoSelezionabile: string;
  }
  const nav = useNavigate();
  const [stato, setStato] = useState<Stato | null>(null);
  const [aperto, setAperto] = useState(false);
  const [scelta, setScelta] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);

  useEffect(() => {
    api<Stato>('/me/plan-start')
      .then((s) => { setStato(s); setScelta((s.inizio ?? s.minimoSelezionabile).slice(0, 10)); })
      // Un errore qui non è un problema della cliente: la sezione non compare e il resto del
      // profilo funziona. Serviva a mostrare un pulsante in più, non un messaggio d'errore.
      .catch(() => setStato(null));
  }, []);

  const giorno = (s: string) => new Date(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  /** Il giorno più in là che si può scegliere: `massimoGiorniAvanti` da oggi. */
  const massimo = stato ? new Date(Date.now() + stato.massimoGiorniAvanti * DAY).toISOString().slice(0, 10) : undefined;

  async function salva() {
    if (!scelta) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ inizio: string; sbloccoMenu: string }>('/me/plan-start', {
        method: 'PATCH',
        body: JSON.stringify({ data: scelta }),
      });
      setAperto(false);
      setFatto(
        `Fatto: il piano parte ${giorno(r.inizio)}. I menu li vedrai dal ` +
          `${new Date(r.sbloccoMenu).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}.`,
      );
      setStato((s) => (s ? { ...s, inizio: r.inizio } : s));
      // La scheda qui sopra mostra le date del piano: va ricaricata, o resta quella vecchia.
      onSpostata();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non è stato possibile spostare la data. Riprova.');
    } finally {
      setBusy(false);
    }
  }

  if (!stato) return null;
  // Piano già partito, o nessun piano: non c'è niente da spostare e niente da spiegare.
  if (!stato.puo && stato.perche !== 'troppo_tardi') return null;

  if (!stato.puo) {
    return (
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '12px 0 0' }}>
        <i className="ti ti-clock-hour-4" /> Il piano parte fra poco: da qui la data non si sposta più.
        Se ti serve cambiarla,{' '}
        <span style={{ textDecoration: 'underline' }} onClick={() => nav('/assistente?who=coach')}>scrivilo alla tua coach</span>{' '}
        — lei può ancora farlo.
      </p>
    );
  }

  return (
    <>
      <button className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => { setAperto(true); setFatto(null); }}>
        <i className="ti ti-calendar-event" /> Sposta la data di inizio
      </button>
      {fatto && <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: '8px 0 0', color: '#0E7C66' }}>{fatto}</p>}

      {aperto && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAperto(false); }}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <b style={{ fontSize: 16 }}>Quando vuoi partire?</b>
            {stato.inizio && (
              <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                Adesso il piano è previsto per {giorno(stato.inizio)}.
              </p>
            )}
            <input
              type="date"
              className="input"
              style={{ width: '100%', marginTop: 12 }}
              value={scelta}
              min={stato.minimoSelezionabile}
              max={massimo}
              onChange={(e) => setScelta(e.target.value)}
            />
            {/*
              Si dice PRIMA che i menu si rifanno. Il blocco è di 24 ore ma i menu si sbloccano due
              giorni prima: c'è una finestra in cui la cliente ha già i menu davanti — e magari ha
              fatto la spesa — e spostando la data quei menu vengono rigenerati. Scoprirlo dopo
              sarebbe la cosa peggiore che questa schermata può fare.
            */}
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '10px 0 0' }}>
              I menu vengono ricalcolati sulla data nuova: se ne avevi già qualcuno davanti, cambierà.
              Si può spostare fino a {stato.massimoGiorniAvanti} giorni da oggi, e non nelle
              ultime {stato.oreDiBlocco} ore prima della partenza.
            </p>
            {err && <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: '10px 0 0', color: '#B3261E' }}>{err}</p>}
            <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={busy || !scelta} onClick={salva}>
              {busy ? 'Sposto…' : 'Confermo questa data'}
            </button>
            <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setAperto(false)}>
              Lascia com'è
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * "Cibi esclusi": i cibi che la cliente ha chiesto di non vedere più nei menu
 * (dislikedFoods). Da qui può toglierli o aggiungerne; le intolleranze restano
 * mostrate a parte e si cambiano con lo staff (sono un dato di sicurezza).
 */
function ExcludedFoods() {
  const [foods, setFoods] = useState<string[] | null>(null);
  const [intol, setIntol] = useState<string[]>([]);
  /**
   * ALLERGIE — non comparivano da nessuna parte in app (punto D dell'handoff del 12/8).
   *
   * È il dato con la conseguenza più seria dei tre — un'allergia si evita sempre, tracce e derivati
   * compresi — e la cliente non poteva rivedere quello che aveva dichiarato. Se ha spuntato la
   * casella sbagliata al questionario, o se ne è dimenticata una, oggi non ha modo di accorgersene:
   * lo scopre dal piatto.
   *
   * `null` = non le abbiamo mai chieste (o la pagina è stata saltata): è diverso da «nessuna», e la
   * differenza si vede nel testo.
   */
  const [allergie, setAllergie] = useState<string[]>([]);
  const [allergieChieste, setAllergieChieste] = useState<boolean>(true);
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Pop-up delle spezie (vedi `backend/src/menu/spezie.ts`): una spezia esclusa cancella dal
  // ricettario tutti i piatti che la contengono, quindi il server non la registra e spiega
  // perché. Qui va anche tolta la pastiglia aggiunta in modo ottimistico.
  const [avviso, setAvviso] = useState<{ titolo: string; testo: string } | null>(null);

  /** Quale dei due elenchi è aperto: 'vietati' (allergie) o 'evitare' (intolleranze + non graditi). */
  const [elenco, setElenco] = useState<'vietati' | 'evitare' | null>(null);

  useEffect(() => {
    api<{ dislikedFoods: string[] | null; intolerances: string[] | null; allergies: string[] | null; allergieDichiarateIl: string | null }>('/me/client-profile')
      .then((p) => {
        setFoods(p.dislikedFoods ?? []);
        setIntol(p.intolerances ?? []);
        setAllergie(p.allergies ?? []);
        setAllergieChieste(!!p.allergieDichiarateIl || (p.allergies ?? []).length > 0);
      })
      .catch(() => setFoods([]));
  }, []);

  async function save(next: string[]) {
    setBusy(true); setErr(null); setMsg(null);
    const prev = foods;
    setFoods(next);
    try {
      await api('/me/client-profile', { method: 'PATCH', body: JSON.stringify({ dislikedFoods: next }) });
    } catch (e) {
      setFoods(prev);
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function addFood() {
    const v = add.trim();
    if (v.length < 2 || !foods) return;
    if (foods.some((f) => f.toLowerCase() === v.toLowerCase())) { setAdd(''); return; }
    setBusy(true); setErr(null); setMsg(null); setAvviso(null);
    const prev = foods;
    setAdd('');
    setFoods([...foods, v]); // ottimistico
    try {
      // Non solo salva l'esclusione: applica SUBITO la sostituzione ai menu di oggi e
      // dei prossimi giorni (stesso endpoint della "cambia cibo" in Home). Qui la portata
      // è per forza `forever`: siamo nella sezione "Cibi esclusi", dove l'esclusione
      // permanente è proprio l'intento dichiarato.
      const r = await api<{
        applicato?: boolean;
        avvisoSpezia?: { titolo: string; testo: string };
        /** ⚠️ Quello che ha scritto non è un alimento ma una frase: il server lo dice, e lo dice
         *  LUI perché la regola vive in un posto solo (`common/esclusioni-scritte-bene.ts`). */
        avvisoEsclusione?: string;
      }>('/me/menu/substitute', { method: 'POST', body: JSON.stringify({ ingredient: v, scope: 'forever' }) });
      /**
       * ⚠️ Va guardato PRIMA delle spezie: se quello che ha scritto è una frase, non è nemmeno
       * arrivato al cancello delle spezie — e mostrarle il messaggio sbagliato la manderebbe a
       * cercare un problema che non ha.
       */
      if (r.avvisoEsclusione) {
        setFoods(prev); // il server non l'ha salvato: la pastiglia non deve restare lì a mentire
        setAdd(v); // e il testo torna nel campo, così può correggerlo invece di riscriverlo
        setAvviso({ titolo: 'Scrivilo come un elenco', testo: r.avvisoEsclusione });
        return;
      }
      if (r.avvisoSpezia) {
        setFoods(prev); // il server non l'ha salvato: la pastiglia non deve restare lì a mentire
        setAvviso({ titolo: r.avvisoSpezia.titolo, testo: r.avvisoSpezia.testo });
        return;
      }
      setMsg(`«${v}» escluso: i menu sono stati aggiornati.`);
    } catch (e) {
      setFoods(prev);
      setErr(e instanceof Error ? e.message : 'Non è stato possibile aggiornare il menu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5 }}>
        Questi cibi non compaiono nei tuoi menu. Puoi toglierli o aggiungerne quando vuoi.
      </p>
      {foods === null ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Carico…</p>
      ) : foods.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun cibo escluso per ora.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {foods.map((f) => (
            <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEF3F1', borderRadius: 999, padding: '5px 8px 5px 12px', fontSize: 12.5, fontWeight: 600, color: '#2E3E3B' }}>
              {f}
              <button aria-label={`Rimuovi ${f}`} disabled={busy} onClick={() => void save(foods.filter((x) => x !== f))}
                style={{ border: 0, background: '#DDE7E3', color: '#4A5A56', width: 18, height: 18, borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <input className="input" style={{ width: '100%' }} placeholder="Aggiungi un cibo… (es. funghi)" value={add}
          onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addFood(); }} />
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy || add.trim().length < 2} onClick={addFood}>{busy ? 'Aggiorno…' : 'Aggiungi'}</button>
      </div>
      {err && <div style={{ color: '#993C1D', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {msg && <div style={{ color: '#0E7C66', fontSize: 12, marginTop: 6 }}>{msg}</div>}
      {avviso && (
        <div style={{ marginTop: 10, padding: '11px 12px', borderRadius: 11, background: '#FDF6E8', border: '1px solid #F0DFBA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <i className="ti ti-alert-circle" style={{ color: '#C98A2E', fontSize: 15 }} />
            <b style={{ fontSize: 13, color: '#6B4E12' }}>{avviso.titolo}</b>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5C4A22' }}>{avviso.testo}</div>
          <button className="btn ghost" style={{ marginTop: 9, padding: '6px 12px', fontSize: 12.5 }} onClick={() => setAvviso(null)}>Ho capito</button>
        </div>
      )}
      {allergie.length > 0 && (
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 11.5 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 12, verticalAlign: '-1px', color: '#C0392B' }} /> Allergie registrate: <b>{allergie.join(', ')}</b> — le evitiamo sempre, anche nelle tracce e nei derivati. Per correggerle scrivi alla tua nutrizionista.
        </p>
      )}
      {allergie.length === 0 && !allergieChieste && (
        // ⚠️ Non si scrive «Nessuna allergia»: non lo sappiamo. Per chi si è iscritta prima che la
        // domanda avesse una risposta registrabile, «nessuna» sarebbe un'affermazione nostra su un
        // dato sanitario che non abbiamo mai raccolto.
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 11.5 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 12, verticalAlign: '-1px', color: '#C98A2E' }} /> Non risultano allergie dichiarate. Se ne hai una, dillo alla tua nutrizionista: è la prima cosa che teniamo fuori dai menu.
        </p>
      )}
      {intol.length > 0 && (
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 11.5 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 12, verticalAlign: '-1px' }} /> Intolleranze registrate: <b>{intol.join(', ')}</b> — per cambiarle parlane con la tua coach o nutrizionista.
        </p>
      )}
      {/*
        ⚠️ I DUE ELENCHI VERI (richiesta di Simone, 13/8).
        Sopra c'è quello che ha DICHIARATO; qui sotto cosa comporta davvero nel piatto. Una cliente
        sceglie «frutta a guscio» e non sa che vuol dire noci, mandorle, nocciole, pistacchi: il
        valore non sono i pulsanti, è l'espansione — le stesse parole con cui il motore le toglie i
        piatti. E fa da controllo: se ci vede dentro qualcosa che non c'entra, lo dice.
      */}
      <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn ghost" style={{ fontSize: 12.5 }} onClick={() => setElenco('vietati')}>
          <i className="ti ti-ban" style={{ color: '#C0392B' }} /> Cibi assolutamente vietati
        </button>
        <button className="btn ghost" style={{ fontSize: 12.5 }} onClick={() => setElenco('evitare')}>
          <i className="ti ti-alert-circle" style={{ color: '#C98A2E' }} /> Cibi da evitare
        </button>
      </div>
      {elenco && <ElencoEsclusi quale={elenco} onClose={() => setElenco(null)} />}
    </div>
  );
}

/**
 * ⛔ **«PREFERISCO RICETTE SEMPLICI» È STATA TOLTA — 3/9.**
 *
 * La preferenza è uscita dal motore il 2/9 (decisione di Simone, dopo il caso Patrizia del 31/8).
 * L'interruttore però è rimasto qui: la cliente lo accendeva e **non succedeva niente**. Un
 * interruttore che non accende nulla è la cosa che `CLAUDE.md` dice di non lasciare in giro — e
 * quando è la cliente a premerlo è peggio di una chiave di permesso morta, perché lei ci conta.
 *
 * ⚠️ **Non si poteva togliere insieme al resto**: sta nell'app, e sparisce dai telefoni solo con un
 * rilascio OTA. Chi ha la versione vecchia continua a vederlo finché non aggiorna.
 *
 * ⛔ **`prefersSimpleRecipes` NON è stato tolto dal DTO** (`profile/dto/update-profile.dto.ts`), e
 * non va tolto in questo giro: le app **già installate** mandano quel campo a ogni salvataggio, e
 * un DTO che non lo accetta più risponde **400** — la cliente non salverebbe più il profilo, nome e
 * allergie comprese, per un campo che non serve a nessuno. Si pulisce quando le versioni vecchie
 * non sono più in giro, ed è un altro giro.
 *
 * ⚠️ **Il valore in banca dati si tiene**: dice a chi quella preferenza interessava, e non si
 * ricrea. Se un giorno la funzione torna, quella è l'unica lista che c'è.
 */

/**
 * Attività fisica: guida il calcolo del fabbisogno calorico giornaliero (e quindi le calorie
 * dei menu). La cliente sceglie quanto si muove; se non risponde, si usa il tipo di lavoro.
 */
const ACTIVITY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentaria', hint: 'poco o niente movimento' },
  { value: 'light', label: 'Leggera', hint: '1–3 volte a settimana' },
  { value: 'moderate', label: 'Moderata', hint: '3–5 volte a settimana' },
  { value: 'active', label: 'Attiva', hint: '6–7 volte a settimana' },
  { value: 'very_active', label: 'Molto attiva', hint: 'sport intenso o lavoro fisico' },
];

function ActivityPref() {
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ activityLevel?: string | null }>('/me/client-profile')
      .then((p) => setValue(p.activityLevel ?? ''))
      .catch(() => setValue(''))
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: string) {
    setBusy(true); setErr(null);
    const prev = value;
    setValue(next);
    try {
      await api('/me/client-profile', { method: 'PATCH', body: JSON.stringify({ activityLevel: next }) });
    } catch (e) {
      setValue(prev);
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5 }}>
        Quanto ti muovi o ti alleni? Ci aiuta a calibrare le calorie dei tuoi menu.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {ACTIVITY_OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button key={o.value} onClick={() => save(o.value)} disabled={!loaded || busy}
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                border: on ? '2px solid var(--teal)' : '1px solid var(--line)', background: on ? '#EAF5F1' : '#fff', cursor: 'pointer' }}>
              <i className={`ti ${on ? 'ti-circle-check-filled' : 'ti-circle'}`} style={{ fontSize: 20, color: on ? 'var(--teal)' : '#C6CFCB' }} />
              <span><b style={{ fontSize: 13.5 }}>{o.label}</b> <span className="muted" style={{ fontSize: 12 }}>— {o.hint}</span></span>
            </button>
          );
        })}
      </div>
      {err && <div style={{ color: '#993C1D', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/**
 * ⛔ **QUI C'ERA IL SELETTORE «QUALI PASTI SALTI», ED È SPARITO IL 21/8.**
 *
 * Simone: «non ha più senso scegliere i pasti, sono campi che devono proprio sparire». È la Regola
 * d'Oro del manuale: **la durata della finestra dice quanti pasti**. Da quando la cliente trascina
 * il suo orologio, `fastingWindow` non è una scelta — è il risultato di apertura e protocollo,
 * ricalcolato a ogni spostamento.
 *
 * ⚠️ **E questa card era già rotta, non solo di troppo**: i suoi pallini facevano
 * `PATCH /me/client-profile { fastingWindow }`, e `fastingWindow` è uscito dal DTO insieme alla
 * domanda del questionario. Ogni tocco sarebbe finito in un errore rosso senza motivo.
 *
 * ⚠️ E anche funzionando sarebbe stata **la seconda risposta** alla stessa domanda: qui i pasti, in
 * home l'orologio. Due schermate che si contraddicono a ogni tocco.
 *
 * La finestra si legge nel riepilogo qui sopra e si sposta in un posto solo: la pagina
 * dell'orologio, `/digiuno`, che la riga del riepilogo apre con un tocco.
 */

export default function Profilo() {
  const { user, logout, switchAccount } = useAuth();
  const [switching, setSwitching] = useState(false);

  async function goToLinked() {
    setSwitching(true);
    try {
      await switchAccount();
      window.location.href = '/'; // ricarica l'app nel profilo staff
    } catch {
      setSwitching(false);
    }
  }
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [ric, setRic] = useState<Ricorrente | null>(null);
  const [ricBusy, setRicBusy] = useState(false);
  const [ricMsg, setRicMsg] = useState<string | null>(null);
  const [disdettaAperta, setDisdettaAperta] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sezione "I miei dati"
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [phonePrefix, setPhonePrefix] = useState('+39');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editing, setEditing] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [dataMsg, setDataMsg] = useState<string | null>(null);

  // Gestione email (cambio con verifica + secondaria)
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // Autocompletamento indirizzo (OpenStreetMap / Nominatim, senza chiave)
  const [addrSug, setAddrSug] = useState<AddrSuggestion[]>([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api<Subscription | null>('/me/subscription').catch(() => null),
      api<Payment[]>('/me/payments').catch(() => [] as Payment[]),
      api<MyProfile>('/me/profile').catch(() => null),
      api<Ricorrente | null>('/me/subscription/recurring').catch(() => null),
    ]).then(([s, p, pr, r]) => {
      setSub(s);
      setRic(r);
      setPayments(Array.isArray(p) ? p : []);
      if (pr) { setProfile(pr); setForm(pr); const sp = splitPhone(pr.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number); }
    }).finally(() => setLoading(false));
  }, []);

  /** Ricarica il piano dal server: lo chiama chi ne cambia le date (lo spostamento dell'inizio). */
  async function ricaricaPiano() {
    setSub(await api<Subscription | null>('/me/subscription').catch(() => null));
  }

  /** Disdetta / ripensamento: entrambe passano da qui e ricaricano lo stato vero dal server. */
  async function azioneRicorrente(azione: 'cancel' | 'resume') {
    setRicBusy(true);
    setRicMsg(null);
    try {
      await api(`/me/subscription/${azione}`, { method: 'POST' });
      setRic(await api<Ricorrente | null>('/me/subscription/recurring').catch(() => null));
      setDisdettaAperta(false);
      setRicMsg(azione === 'cancel' ? 'Disdetta registrata. Resta tutto attivo fino alla scadenza.' : 'Bentornata: l’abbonamento continua.');
    } catch (e) {
      setRicMsg(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setRicBusy(false);
    }
  }

  /** «Aggiorna la carta»: portale di Stripe. I dati della carta non passano mai da noi. */
  async function apriPortaleCarta() {
    setRicBusy(true);
    setRicMsg(null);
    try {
      const { url } = await api<{ url: string }>('/me/subscription/card-portal');
      window.location.href = url;
    } catch (e) {
      setRicMsg(e instanceof ApiError ? e.message : 'Portale non disponibile: riprova fra poco.');
      setRicBusy(false);
    }
  }

  function searchAddress(q: string) {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (q.trim().length < 3) { setAddrSug([]); setAddrOpen(false); setAddrLoading(false); return; }
    setAddrOpen(true);
    setAddrLoading(true);
    addrTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=6&accept-language=it`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        type A = { road?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string; municipality?: string; county?: string; state?: string; country?: string };
        type R = { display_name: string; name?: string; address?: A };
        const data: R[] = await res.json();
        const sug: AddrSuggestion[] = (data ?? []).map((r) => {
          const a = r.address ?? {};
          const street = [a.road ?? r.name, a.house_number].filter(Boolean).join(' ') || (r.display_name.split(',')[0] ?? '');
          const city = a.city ?? a.town ?? a.village ?? a.municipality ?? '';
          return { label: r.display_name, addressLine: street, postalCode: a.postcode ?? '', city, province: a.county ?? a.state ?? '', country: a.country ?? '' };
        }).filter((s) => s.addressLine);
        setAddrSug(sug);
      } catch {
        setAddrSug([]);
      } finally {
        setAddrLoading(false);
      }
    }, 450);
  }

  function pickAddress(s: AddrSuggestion) {
    setForm((f) => ({ ...f, addressLine: s.addressLine, postalCode: s.postalCode, city: s.city, province: s.province, country: s.country || f.country }));
    setAddrOpen(false);
    setAddrSug([]);
  }

  async function saveData() {
    setSavingData(true);
    setDataMsg(null);
    setErr(null);
    try {
      const phone = phoneNumber.trim() ? `${phonePrefix} ${phoneNumber.trim()}` : '';
      const body = {
        firstName: form.firstName ?? '', lastName: form.lastName ?? '', nickname: form.nickname ?? '',
        addressLine: form.addressLine ?? '', postalCode: form.postalCode ?? '', city: form.city ?? '',
        province: form.province ?? '', country: form.country ?? '', phone,
        birthDate: form.birthDate ?? '', codiceFiscale: form.codiceFiscale ?? '',
      };
      const updated = await api<MyProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setProfile(updated);
      setForm(updated);
      const sp = splitPhone(updated.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number);
      setEditing(false);
      setDataMsg('Dati aggiornati.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingData(false);
    }
  }

  async function requestEmailChange() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      await api('/auth/email-change/request', { method: 'POST', body: JSON.stringify({ newEmail: newEmail.trim() }) });
      setEmailMsg('Ti abbiamo inviato un link di conferma alla nuova email: aprilo per confermarla.');
      setNewEmail(''); setEmailOpen(false);
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Richiesta non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function makePrimary() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      const r = await api<{ email: string; secondaryEmail: string | null }>('/auth/email/primary', { method: 'POST' });
      setProfile((p) => (p ? { ...p, email: r.email, secondaryEmail: r.secondaryEmail } : p));
      setEmailMsg('Email principale aggiornata. Notifiche e ricevute andranno alla nuova principale.');
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function removeSecondary() {
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      const r = await api<{ email: string; secondaryEmail: string | null }>('/auth/email/secondary', { method: 'DELETE' });
      setProfile((p) => (p ? { ...p, secondaryEmail: r.secondaryEmail } : p));
      setEmailMsg('Email secondaria rimossa.');
    } catch (e) {
      setEmailErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally { setEmailBusy(false); }
  }

  async function reloadPayments() {
    const p = await api<Payment[]>('/me/payments').catch(() => [] as Payment[]);
    setPayments(Array.isArray(p) ? p : []);
  }

  /** Carica la contabile del bonifico (PDF o immagine) come base64. */
  async function uploadReceipt(id: string, file: File) {
    setBusyId(id);
    setErr(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File troppo grande (max 5 MB).');
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('File non leggibile.'));
        r.readAsDataURL(file);
      });
      await api(`/me/payments/${id}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, contentBase64 }) });
      await reloadPayments();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setBusyId(null);
    }
  }

  /** Annulla un proprio ordine ancora in attesa. */
  async function cancelOrder(id: string) {
    if (!confirm('Vuoi annullare questo ordine? Resterà nello storico come annullato.')) return;
    setBusyId(id);
    setErr(null);
    try {
      await api(`/me/payments/${id}/cancel`, { method: 'POST' });
      await reloadPayments();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadReceipt(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/me/payments/${id}/receipt-pdf`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non è stato possibile scaricare la ricevuta.');
    } finally {
      setBusyId(null);
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || '').replace(/^\w/, (c) => c.toUpperCase());
  const prog = sub && sub.status === 'active' ? planProgress(sub) : null;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="home">
      <AppHeader title="Profilo" />

      <div className="menu-head" style={{ marginTop: 4 }}>
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-user" /></span>
        <div>
          <h1 style={{ margin: 0 }}>{name || 'Profilo'}</h1>
          <div className="muted">{user?.email}</div>
        </div>
      </div>

      {/* I miei dati */}
      <div className="row-between" style={{ margin: '4px 2px 8px' }}>
        <span className="sec" style={{ margin: 0 }}>I miei dati</span>
        {profile && !editing && <button className="btn-recipe" style={{ padding: '4px 12px' }} onClick={() => { setEditing(true); setDataMsg(null); }}><i className="ti ti-pencil" /> Modifica</button>}
      </div>
      {dataMsg && <div className="banner ok" style={{ marginBottom: 10 }}>{dataMsg}</div>}
      {profile && (
        <div className="card">
          {!editing ? (
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div><span className="muted">Nome:</span> <b>{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}</b></div>
              <div><span className="muted">Nickname:</span> <b>{profile.nickname || '—'}</b></div>
              <div><span className="muted">Indirizzo:</span> <b>{[profile.addressLine, profile.postalCode, profile.city, profile.province, profile.country].filter(Boolean).join(', ') || '—'}</b></div>
              <div><span className="muted">Telefono:</span> <b>{profile.phone || '—'}</b></div>
              <div><span className="muted">Data di nascita:</span> <b>{profile.birthDate ? new Date(profile.birthDate + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</b></div>
              <div><span className="muted">Codice fiscale:</span> <b>{profile.codiceFiscale || '—'}</b></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Nome" value={form.firstName ?? ''} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Cognome" value={form.lastName ?? ''} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
              <input className="input" placeholder="Nickname" value={form.nickname ?? ''} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} />

              <select className="input" value={form.country ?? ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}>
                <option value="">Paese…</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.country && !COUNTRIES.includes(form.country) && <option value={form.country}>{form.country}</option>}
              </select>

              <div style={{ position: 'relative' }}>
                <input
                  className="input" placeholder="Via e numero (digita per cercare)" autoComplete="off"
                  value={form.addressLine ?? ''}
                  onChange={(e) => { setForm((f) => ({ ...f, addressLine: e.target.value })); searchAddress(e.target.value); }}
                  onFocus={() => { if (addrSug.length) setAddrOpen(true); }}
                />
                {addrOpen && (
                  <div className="addr-pop">
                    {addrLoading && <div className="addr-opt" style={{ cursor: 'default', color: 'var(--muted)' }}><i className="ti ti-loader" /> <span>Cerco indirizzi…</span></div>}
                    {!addrLoading && addrSug.length === 0 && <div className="addr-opt" style={{ cursor: 'default', color: 'var(--muted)' }}><i className="ti ti-map-off" /> <span>Nessun indirizzo trovato — scrivilo a mano</span></div>}
                    {addrSug.map((s, i) => (
                      <button type="button" key={i} className="addr-opt" onClick={() => pickAddress(s)}>
                        <i className="ti ti-map-pin" style={{ color: 'var(--teal)' }} /> <span>{s.label}</span>
                      </button>
                    ))}
                    <button type="button" className="addr-opt" style={{ justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }} onClick={() => setAddrOpen(false)}>Chiudi</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" style={{ width: 96, flex: '0 0 auto' }} placeholder="CAP" value={form.postalCode ?? ''} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Città" value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                <input className="input" style={{ width: 74, flex: '0 0 auto' }} placeholder="Prov." value={form.province ?? ''} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <select className="input" style={{ width: 96, flex: '0 0 auto' }} value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)}>
                  {PHONE_PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
                  {!PHONE_PREFIXES.includes(phonePrefix) && <option value={phonePrefix}>{phonePrefix}</option>}
                </select>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Numero di telefono" inputMode="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>

              <input
                className="input"
                placeholder="Codice fiscale (facoltativo)"
                autoCapitalize="characters"
                maxLength={16}
                value={form.codiceFiscale ?? ''}
                onChange={(e) => {
                  const cf = e.target.value.toUpperCase();
                  const parsed = parseCodiceFiscale(cf);
                  setForm((f) => ({ ...f, codiceFiscale: cf, ...(parsed.birthDate ? { birthDate: parsed.birthDate } : {}) }));
                }}
              />
              {form.codiceFiscale && parseCodiceFiscale(form.codiceFiscale).birthDate && (
                <div className="muted" style={{ fontSize: 11, marginTop: -4 }}>Data di nascita ricavata dal codice fiscale.</div>
              )}
              <label className="muted" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                Data di nascita
                <input
                  className="input"
                  type="date"
                  style={{ marginTop: 4 }}
                  value={form.birthDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                />
              </label>

              <div className="muted" style={{ fontSize: 11 }}>L'email ({profile.email}) non si cambia da qui: servirà una verifica via link.</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <button className="btn" style={{ flex: 1 }} onClick={saveData} disabled={savingData}>{savingData ? 'Salvo…' : 'Salva'}</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setEditing(false); setForm(profile); const sp = splitPhone(profile.phone); setPhonePrefix(sp.prefix); setPhoneNumber(sp.number); setErr(null); setAddrOpen(false); }}>Annulla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Le mie email */}
      {profile && (
        <>
          <div className="sec">Le mie email</div>
          {emailMsg && <div className="banner ok" style={{ marginBottom: 10 }}>{emailMsg}</div>}
          {emailErr && <div className="banner err" style={{ marginBottom: 10 }}>{emailErr}</div>}
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <b style={{ wordBreak: 'break-all' }}>{profile.email}</b>
                <div className="muted" style={{ fontSize: 11 }}>Principale · notifiche e ricevute</div>
              </div>
              <span className="chip" style={{ background: '#DCF0D8', color: '#3B6D11', flex: '0 0 auto' }}>Principale</span>
            </div>

            {profile.secondaryEmail && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <b style={{ wordBreak: 'break-all' }}>{profile.secondaryEmail}</b>
                <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Secondaria · login alternativo</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-recipe" onClick={makePrimary} disabled={emailBusy}>Rendi principale</button>
                  <button className="btn-recipe" style={{ background: '#f3e3e1', color: '#b3261e' }} onClick={removeSecondary} disabled={emailBusy}>Rimuovi</button>
                </div>
              </div>
            )}

            {!emailOpen ? (
              <button className="btn ghost" onClick={() => { setEmailOpen(true); setEmailErr(null); setEmailMsg(null); }}>
                <i className="ti ti-mail-plus" /> {profile.secondaryEmail ? 'Cambia email' : 'Aggiungi / cambia email'}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="muted" style={{ fontSize: 12 }}>Inserisci la nuova email: ti mandiamo un link di conferma. Dopo la verifica potrai sceglierla come principale o tenerle entrambe.</div>
                <input className="input" type="email" inputMode="email" placeholder="nuova@email.it" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={requestEmailChange} disabled={emailBusy || !newEmail.trim()}>{emailBusy ? 'Invio…' : 'Invia link'}</button>
                  <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setEmailOpen(false); setNewEmail(''); }}>Annulla</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* La mia alimentazione: le tre cose che decidono i menu, in sola lettura */}
      <div className="sec" style={{ marginTop: 4 }}>La mia alimentazione</div>
      <MyNutrition />

      {/* Cibi esclusi (dislikedFoods): la lista che guida i menu, correggibile qui */}
      <div className="sec" style={{ marginTop: 4 }}>Cibi esclusi</div>
      <ExcludedFoods />

      {/* Attività fisica: guida il fabbisogno calorico e le calorie dei menu */}
      <div className="sec" style={{ marginTop: 4 }}>Attività fisica</div>
      <ActivityPref />

      {/* Colore dell'app */}
      <div className="sec" style={{ marginTop: 4 }}>Colore dell'app</div>
      <div className="card">
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12.5 }}>Scegli il colore che preferisci: trasforma tutta l'app.</p>
        <BrandPicker />
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 11 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, verticalAlign: '-1px' }} /> L'ultimo è <b>Auto</b>: un colore nuovo ogni due giorni.
        </p>
      </div>

      {/* Acqua: come visualizzarla in dashboard */}
      <div className="sec" style={{ marginTop: 4 }}>Acqua</div>
      <div className="card">
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12.5 }}>Come vuoi contare l'acqua in dashboard? Cambia solo come la vedi: l'obiettivo resta lo stesso.</p>
        <WaterUnitPicker />
      </div>

      {/* Piano attivo */}
      <div className="sec" style={{ marginTop: 4 }}>Il mio piano</div>
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : sub && (sub.status === 'active' || sub.status === 'queued') && sub.plan ? (
        <div className="card" style={{ border: '2px solid #12A386' }}>
          <div className="row-between">
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{sub.plan.name}</div>
              {/*
                ⚠️ IL PIANO CHE COMINCIA PIÙ AVANTI È UN PIANO — 19/8, voce 258.
                Dal 19/8 il server lo scrive `queued` invece di `active` con la data nel futuro.
                Con il confronto di prima questa scheda cadeva nel ramo finale e a una cliente che
                aveva appena pagato scriveva «Non hai ancora un piano attivo — Scopri i piani»: il
                giorno del pagamento, con l'invito a ricomprare quello che aveva appena comprato.
                E ⚠️ colpiva anche chi ha un piano in corso e ne compra uno in coda, perché
                `/me/subscription` risponde con il più RECENTE.
                La pastiglia dice quale dei due è, perché sono due cose diverse: uno sta erogando,
                l'altro comincia il giorno che c'è scritto sotto.
              */}
              {sub.status === 'queued' ? (
                <span className="chip" style={{ background: '#F3E8DC', color: '#B8863B', marginTop: 4 }}><i className="ti ti-clock-hour-4" /> Comincia {planStart(sub) ? fmtDate(planStart(sub)!) : 'a breve'}</span>
              ) : (
                <span className="chip" style={{ background: '#DCF0D8', color: '#3B6D11', marginTop: 4 }}><i className="ti ti-circle-check" /> Attivo</span>
              )}
            </div>
            <i className="ti ti-seeding" style={{ fontSize: 30, color: '#12A386' }} />
          </div>
          {prog && (
            <>
              <div className="row-between" style={{ marginTop: 14, alignItems: 'baseline' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0E7C66' }}>Giorno {prog.day}</span>
                <span className="muted" style={{ fontSize: 13 }}>di {prog.total}</span>
              </div>
              <div className="prog-track" style={{ marginTop: 8 }}>
                <div className="prog-fill" style={{ width: `${prog.pct}%` }} />
              </div>
              <div className="row-between" style={{ marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>Inizio {planStart(sub) ? fmtDate(planStart(sub)!) : '—'}</span>
                <span className="muted" style={{ fontSize: 11 }}>Fine {sub.endDate ? fmtDate(sub.endDate) : '—'}</span>
              </div>
            </>
          )}
          {/* Se il piano non è ancora partito, da qui la data si sposta (fino a 24h prima). */}
          <DataInizioPiano onSpostata={ricaricaPiano} />
        </div>
      ) : sub && sub.status === 'pending' ? (
        <div className="card">
          <b style={{ fontSize: 14 }}>{sub.plan?.name ?? 'Piano'}</b>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>In attesa di conferma del pagamento.</p>
          {/*
            Anche in attesa di pagamento: la data si può ancora spostare, e il server sa che su un
            abbonamento `pending` va scritta solo la base dei menu — le date dell'abbonamento le
            mette l'approvazione. È il caso di chi compra oggi per partire lunedì e sbaglia lunedì.
          */}
          <DataInizioPiano onSpostata={ricaricaPiano} />
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Non hai ancora un piano attivo.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => navigate('/negozio')}>Scopri i piani</button>
        </div>
      )}

      {/* Abbonamento con addebito automatico: c'è solo se la cliente ne ha uno. */}
      {ric && (
        <>
          <div className="sec">Abbonamento</div>
          <div className="card" style={ric.pagamentoFallito ? { border: '1.5px solid #B3261E' } : {}}>
            <div className="row-between">
              <div>
                <b style={{ fontSize: 14 }}>{ric.nome}</b>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {euro(ric.prezzoCents)} al mese
                  {ric.rinnovaIl && (ric.disdettaChiesta ? ` · finisce il ${fmtDate(ric.rinnovaIl)}` : ` · si rinnova il ${fmtDate(ric.rinnovaIl)}`)}
                </div>
              </div>
              <i className="ti ti-repeat" style={{ fontSize: 26, color: ric.disdettaChiesta ? '#8A938F' : '#12A386' }} />
            </div>

            {/* Carta rifiutata: NON è una disdetta. Il servizio continua mentre Stripe riprova. */}
            {ric.pagamentoFallito && (
              <div className="banner err" style={{ marginTop: 10 }}>
                L’ultimo addebito non è andato a buon fine. Il tuo piano resta attivo e ci riproviamo nei prossimi
                giorni: se la carta è scaduta, aggiornala qui sotto.
              </div>
            )}

            {ric.disdettaChiesta && (
              <div className="banner" style={{ marginTop: 10 }}>
                Disdetta registrata. Continui ad avere tutto fino
                {ric.rinnovaIl ? ` al ${fmtDate(ric.rinnovaIl)}` : ' alla scadenza'}, poi non ti addebiteremo più niente.
              </div>
            )}

            {ricMsg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{ricMsg}</div>}

            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn-recipe" disabled={ricBusy} onClick={() => void apriPortaleCarta()}>
                <i className="ti ti-credit-card" style={{ fontSize: 13, marginRight: 4 }} /> Aggiorna la carta
              </button>
              {ric.disdettaChiesta ? (
                <button className="btn-recipe" disabled={ricBusy} onClick={() => void azioneRicorrente('resume')}>
                  <i className="ti ti-rotate" style={{ fontSize: 13, marginRight: 4 }} /> Annulla la disdetta
                </button>
              ) : (
                <button className="btn-recipe" style={{ color: '#B3261E' }} disabled={ricBusy} onClick={() => setDisdettaAperta(true)}>
                  Disdici
                </button>
              )}
            </div>

            {/* Una conferma, non tre schermate: chi vuole uscire esce comunque. */}
            {disdettaAperta && !ric.disdettaChiesta && (
              <div className="card" style={{ marginTop: 10, background: '#FAFAF8' }}>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Vuoi disdire <b>{ric.nome}</b>? Non perdi niente di quello che hai già pagato: resta attivo fino
                  {ric.rinnovaIl ? ` al ${fmtDate(ric.rinnovaIl)}` : ' alla scadenza'}, e puoi ripensarci fino a quel
                  giorno.
                </p>
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button className="btn-recipe" disabled={ricBusy} onClick={() => setDisdettaAperta(false)}>Resto</button>
                  <button className="btn-recipe" style={{ color: '#B3261E' }} disabled={ricBusy} onClick={() => void azioneRicorrente('cancel')}>
                    {ricBusy ? 'Attendi…' : 'Sì, disdici'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Storico acquisti */}
      <div className="sec">Storico acquisti</div>
      {err && <div className="banner err" style={{ marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Carico…</p></div>
      ) : payments.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun acquisto per ora.</p></div>
      ) : (
        <div className="meals-col">
          {payments.map((p) => {
            const st = STATUS[p.status] ?? { label: p.status, bg: '#eee', col: '#555' };
            return (
              <div className="card storico-row" key={p.id} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.description}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {fmtDate(p.createdAt)} · {METHOD[p.method] ?? p.method}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <span className="chip" style={{ background: st.bg, color: st.col, fontSize: 11 }}>{st.label}</span>
                    {p.status === 'approved' && (
                      <button className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busyId === p.id} onClick={() => downloadReceipt(p.id)}>
                        <i className="ti ti-download" style={{ fontSize: 12 }} /> {busyId === p.id ? 'Attendi…' : 'Ricevuta'}
                      </button>
                    )}
                    {(p.status === 'pending' || p.status === 'receipt_uploaded') && (
                      <>
                        <label className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11, cursor: busyId === p.id ? 'default' : 'pointer' }}>
                          <i className="ti ti-upload" style={{ fontSize: 12 }} /> {busyId === p.id ? 'Attendi…' : p.status === 'receipt_uploaded' ? 'Sostituisci contabile' : 'Carica contabile'}
                          <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={busyId === p.id}
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadReceipt(p.id, f); }} />
                        </label>
                        <button className="btn-recipe" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busyId === p.id} onClick={() => cancelOrder(p.id)}>
                          <i className="ti ti-x" style={{ fontSize: 12 }} /> Annulla ordine
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{euro(p.amountCents)}</div>
              </div>
            );
          })}
        </div>
      )}

      <NotificationPrefs />

      {/* Il consenso e la sua revoca: in fondo, dopo tutto il resto. Non si nasconde — è un diritto,
          e nasconderlo sarebbe la scelta di chi spera che nessuno lo trovi — ma non sta nemmeno in
          cima, dove si tocca per sbaglio scorrendo. */}
      <ConsensoCard />

      {user?.linkedUserId && (
        <button className="btn" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} onClick={goToLinked} disabled={switching}>
          <i className="ti ti-switch-horizontal" /> {switching ? 'Passo…' : 'Passa al profilo professionale'}
        </button>
      )}

      <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => { logout(); navigate('/'); }}>
        <i className="ti ti-logout" /> Esci
      </button>

      <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 20, opacity: 0.7 }}>
        Metabole · v{__APP_VERSION__}
      </div>
    </div>
  );
}

/**
 * LA CARD «CONSENSO» (richiesta di Simone dell'8/8).
 *
 * Tre cose in un posto: quando ha dato il consenso, il pulsante per revocarlo, e — se un termine è
 * già partito — quanti giorni restano e come fermarlo.
 *
 * ## Perché l'attrito è tanto, e voluto
 *
 * Revocare fa partire una cancellazione irreversibile. Fra il pulsante e il fatto ci sono un popup
 * che dice cosa succede, la parola ELIMINA da scrivere a mano, e poi trenta giorni in cui può
 * cambiare idea con un clic dalla mail. Nessuno di questi passaggi è lì per scoraggiarla: sono lì
 * perché nessuno cancelli il proprio percorso per una toccata distratta sullo schermo del telefono.
 *
 * I testi arrivano dal BACKEND (`/me/consent` → `testi`) e non sono scritti qui: la frase sulle
 * fatture deve essere identica nel popup, nelle mail e nella pagina di trasparenza, e tre copie
 * della stessa frase in tre posti diversi divergono sempre.
 */
interface StatoConsenso {
  accettato: boolean;
  il: string | null;
  revocatoIl: string | null;
  giorniAttesa: number;
  parolaConferma: string;
  testi: { titolo: string; corpo: string; fatture: string; richiesta: string };
  cancellazione: { richiestaIl: string; previstaIl: string; giorniRimanenti: number } | null;
}

function ConsensoCard() {
  const [stato, setStato] = useState<StatoConsenso | null>(null);
  const [popup, setPopup] = useState(false);
  const [parola, setParola] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const carica = () => {
    api<StatoConsenso>('/me/consent')
      .then(setStato)
      .catch(() => { /* la card semplicemente non compare: non è il posto per un errore rosso */ });
  };
  useEffect(carica, []);

  if (!stato) return null;

  const dataLunga = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const oraBreve = (iso: string) =>
    new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const parolaOk = parola.trim().toUpperCase() === stato.parolaConferma;

  async function revoca() {
    setSalvo(true);
    setErr(null);
    try {
      await api('/me/consent/revoke', { method: 'POST', body: JSON.stringify({ conferma: parola.trim() }) });
      setPopup(false);
      setParola('');
      carica();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non riesco a registrare la revoca. Riprova.');
    } finally {
      setSalvo(false);
    }
  }

  // TERMINE IN CORSO. Il pulsante per fermarlo NON è qui ma nella mail, e va detto: è la decisione
  // del 10/8 («solo la cliente»), e il link mandato al suo indirizzo è ciò che la rende vera. Un
  // pulsante in app, raggiungibile da chiunque abbia il telefono in mano, sarebbe più debole.
  if (stato.cancellazione) {
    const c = stato.cancellazione;
    return (
      <div className="card" style={{ border: '1px solid rgba(180,35,42,.35)' }}>
        <b style={{ fontSize: 15 }}>
          <i className="ti ti-alert-triangle" style={{ verticalAlign: '-2px', color: '#B4232A', marginRight: 6 }} />
          Cancellazione in corso
        </b>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '8px 0 0' }}>
          Hai revocato il consenso il {dataLunga(c.richiestaIl)}. I tuoi dati verranno cancellati il{' '}
          <b>{dataLunga(c.previstaIl)}</b> —{' '}
          {c.giorniRimanenti === 0
            ? 'oggi'
            : c.giorniRimanenti === 1
              ? 'fra un giorno'
              : `fra ${c.giorniRimanenti} giorni`}.
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '10px 0 0' }}>
          Se hai cambiato idea, il pulsante <b>«Sospendi l'eliminazione»</b> è nella mail che ti
          abbiamo mandato — quella con oggetto «La tua richiesta di cancellazione». Solo tu puoi
          fermarla: per questo il link è lì e non qui.
        </p>
        <a
          className="btn ghost"
          href="/privacy/cancellazione"
          style={{ width: '100%', marginTop: 12, justifyContent: 'center', textDecoration: 'none' }}
        >
          <i className="ti ti-list-check" /> Cosa cancelliamo e cosa resta
        </a>
      </div>
    );
  }

  return (
    <div className="card">
      <b style={{ fontSize: 15 }}>
        <i className="ti ti-shield-check" style={{ verticalAlign: '-2px', color: 'var(--teal)', marginRight: 6 }} />
        Consenso
      </b>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>
        {stato.il ? (
          <>Consenso fornito il {dataLunga(stato.il)} alle ore {oraBreve(stato.il)}.</>
        ) : (
          <>Il consenso al trattamento dei dati sanitari è quello che hai accettato in registrazione.</>
        )}
      </p>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: '8px 0 0' }}>
        È il consenso che ci permette di costruire i tuoi menu sui tuoi dati. Puoi revocarlo quando
        vuoi: il percorso si interrompe e i tuoi dati vengono cancellati.
      </p>
      <button
        className="btn ghost"
        style={{ width: '100%', marginTop: 12, justifyContent: 'center', color: '#B4232A' }}
        onClick={() => { setPopup(true); setParola(''); setErr(null); }}
      >
        <i className="ti ti-trash" /> Revoca consenso
      </button>
      <a
        href="/privacy/cancellazione"
        className="muted"
        style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 8 }}
      >
        Cosa cancelliamo e cosa siamo obbligati a tenere
      </a>

      {popup && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPopup(false); }}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '86vh', overflowY: 'auto' }}>
            <div className="sheet-grab" />
            <b style={{ fontSize: 16 }}>{stato.testi.titolo}</b>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '10px 0 0' }}>{stato.testi.corpo}</p>
            {/* La frase sulle fatture sta QUI e non solo nelle mail (decisione del 10/8): per
                qualche minuto avrebbe creduto che si cancellasse anche la contabilità, e non è vero. */}
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0' }}>
              {stato.testi.fatture}
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '14px 0 6px' }}>{stato.testi.richiesta}</p>
            <input
              className="input"
              value={parola}
              onChange={(e) => setParola(e.target.value)}
              placeholder={stato.parolaConferma}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            {err && <p style={{ color: '#B4232A', fontSize: 12.5, margin: '8px 0 0' }}>{err}</p>}
            <button
              className="btn"
              // Disabilitato finché la parola non è quella: l'attrito è il punto, e un pulsante
              // che si può premere prima renderebbe il popup una formalità.
              disabled={!parolaOk || salvo}
              style={{ width: '100%', marginTop: 12, background: parolaOk ? '#B4232A' : undefined }}
              onClick={revoca}
            >
              {salvo ? 'Registro…' : 'Revoca il consenso'}
            </button>
            <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setPopup(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface VoceEsclusa {
  voce: string;
  alimenti: string[];
  motivo: 'allergia' | 'intolleranza' | 'non_gradito';
}

/**
 * L'ELENCO DI COSA NON LE ARRIVA NEL PIATTO — e cosa vuol dire davvero (13/8).
 *
 * ⚠️ Le parole le dà il **server** (`GET /me/esclusioni`), che le costruisce con la stessa funzione
 * con cui il motore toglie i piatti. Se questa schermata se ne tenesse una copia, il giorno che la
 * mappa cambia la cliente leggerebbe un elenco e ne mangerebbe un altro.
 *
 * ⚠️ **Una voce senza alimenti non si nasconde**: «Favismo» oggi non toglie niente perché quella
 * parola non compare in nessun ingrediente. Sparire vorrebbe dire farle perdere una cosa che ha
 * dichiarato lei; mostrarla come le altre le farebbe credere di essere protetta. Si mostra, e si dice
 * che la nutrizionista la sta traducendo.
 *
 * ⚠️ E c'è una riga che non si toglie: **questo elenco non è il permesso di mangiare tutto il resto.**
 */
function ElencoEsclusi({ quale, onClose }: { quale: 'vietati' | 'evitare'; onClose: () => void }) {
  const [dati, setDati] = useState<{ vietati: VoceEsclusa[]; daEvitare: VoceEsclusa[] } | null>(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    api<{ vietati: VoceEsclusa[]; daEvitare: VoceEsclusa[] }>('/me/esclusioni')
      .then(setDati)
      .catch(() => setErrore(true));
  }, []);

  const vietati = quale === 'vietati';
  const voci = (vietati ? dati?.vietati : dati?.daEvitare) ?? [];

  return (
    <Sheet onClose={onClose}>
      <h3 style={{ margin: '0 0 4px' }}>
        <i className={`ti ${vietati ? 'ti-ban' : 'ti-alert-circle'}`} style={{ color: vietati ? '#C0392B' : '#C98A2E' }} />{' '}
        {vietati ? 'Cibi assolutamente vietati' : 'Cibi da evitare'}
      </h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
        {vietati
          ? 'Le tue allergie. Li teniamo fuori dai menu sempre, tracce e derivati compresi.'
          : 'Le tue intolleranze e i cibi che non ami: al loro posto il menu propone qualcos’altro.'}
      </p>

      {errore && <p className="muted" style={{ fontSize: 12.5 }}>Non riesco a caricare l’elenco. Riprova fra poco.</p>}
      {!errore && !dati && <p className="muted" style={{ fontSize: 12.5 }}>Un momento…</p>}

      {dati && voci.length === 0 && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          {vietati
            ? 'Non risulta nessuna allergia. Se ne hai una, dillo alla tua nutrizionista: è la prima cosa che teniamo fuori dai menu.'
            : 'Non c’è ancora niente qui. I cibi che non ti piacciono puoi aggiungerli tu, più sotto nel profilo.'}
        </p>
      )}

      {voci.map((v) => (
        <div key={`${v.motivo}-${v.voce}`} style={{ padding: '10px 0', borderTop: '1px solid var(--line, #ece7de)' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {v.voce}
            {!vietati && (
              <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>
                {' '}· {v.motivo === 'intolleranza' ? 'ti fa stare male' : 'non ti piace'}
              </span>
            )}
          </div>
          {v.alimenti.length > 0 ? (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{v.alimenti.join(', ')}</div>
          ) : (
            <div className="muted" style={{ fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>
              La tua nutrizionista la sta traducendo negli alimenti da togliere.
            </div>
          )}
        </div>
      ))}

      {vietati && voci.length > 0 && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          ⚠️ Questo elenco non è il permesso di mangiare tutto il resto: se ti accorgi che manca
          qualcosa, dillo alla tua nutrizionista.
        </p>
      )}
      {!vietati && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          I cibi che non ti piacciono li gestisci tu, più sotto nel profilo. Le intolleranze invece le
          corregge la nutrizionista.
        </p>
      )}
    </Sheet>
  );
}
