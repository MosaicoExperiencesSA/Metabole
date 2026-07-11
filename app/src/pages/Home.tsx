import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import Sheet from '../components/Sheet';
import CheckinPopup from '../components/CheckinPopup';

/**
 * Home / dashboard — replica fedele del prototipo del socio:
 * saluto, card del coach (mascotte + frase), "Oggi a colpo d'occhio",
 * i pasti di oggi, azioni rapide, eventi gestiti, popup check-in e schede dal basso.
 * (Dati dimostrativi per ora; il collegamento ai dati reali arriva dopo.)
 */

type Meal = [string, string, number, string, string, string, string, boolean];
const MEALS: Meal[] = [
  ['Colazione', 'Yogurt, avena e frutta', 320, 'Veloce', 'ti-coffee', '#F3E8DC', '#B8863B', false],
  ['Spuntino', 'Frutta secca e frutto', 150, 'Al volo', 'ti-apple', '#F3F9E8', '#4D7C0F', false],
  ['Pranzo', 'Farro, pollo e verdure', 480, 'Da portare', 'ti-salad', '#DCEBE3', '#12A386', true],
  ['Merenda', 'Yogurt greco', 120, 'Leggera', 'ti-cup', '#EFEAF9', '#6C5AB7', false],
  ['Cena', 'Orata, patate e insalata', 430, 'Leggera', 'ti-fish', '#DCEBE3', '#0E7C66', false],
];

const FRASI = [
  'Non è una dieta, è il tuo nuovo stile.',
  'Un passo alla volta è comunque un passo avanti.',
  'I piccoli gesti di oggi sono i risultati di domani.',
  'Bevi, respira, muoviti: il resto viene.',
  'Sii gentile con te: stai già facendo tanto.',
  'La costanza batte la perfezione.',
];

const HELP: Record<string, { t: string; b: string; cta: string }> = {
  fame: { t: 'Ho fame adesso', b: "Bevi un bicchiere d'acqua e prendi un frutto o dei semi: spesso la fame passa in 15 minuti. Se ti capita spesso di pomeriggio, lo segnalo a Sara e anticipiamo lo spuntino.", cta: 'Chiedi a Sara' },
  fuori: { t: 'Mangio fuori', b: 'Scegli una proteina con verdure, evita bevande zuccherate e concediti un piccolo piacere senza sensi di colpa. Domani ti preparo un rientro morbido, tranquilla.', cta: 'Ok, grazie' },
  sost: { t: 'Sostituisci un ingrediente', b: 'Non hai un ingrediente o non ti piace? Alternativa equivalente: al posto del farro, quinoa o orzo. Vuoi che aggiorni la ricetta di oggi?', cta: 'Aggiorna ricetta' },
};

const SPESA = ['Farro', 'Petto di pollo', 'Yogurt greco', 'Avena', 'Frutta fresca', 'Zucchine', 'Pomodorini', 'Orata', 'Patate'];

function coachOfDay(name: string): { bg: string; head: string } {
  const h = new Date().getHours();
  if (h < 11) return { bg: '#2AA7C4', head: `Buongiorno, ${name}!` };
  if (h < 14) return { bg: '#12A386', head: `Sei in rotta, ${name}!` };
  if (h < 17) return { bg: '#2AA7C4', head: `Bevi un po', ${name}` };
  if (h < 21) return { bg: '#D8663C', head: 'Muoviti un po\'!' };
  return { bg: '#2E2A5A', head: `Buonanotte, ${name}` };
}

function CoachChat() {
  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <span className="sara-av">SC</span>
        <div><b style={{ fontSize: 15 }}>Sara — la tua coach</b><div className="muted" style={{ fontSize: 11 }}>Domande sanitarie? Ti giro alla nutrizionista.</div></div>
      </div>
      <div className="chat-col">
        <div className="bubble-in">Ciao! Come procede questa settimana?</div>
        <div className="bubble-out">Bene, un po' di fame il pomeriggio</div>
        <div className="bubble-in">Perfetto, anticipiamo lo spuntino. Ci vediamo in televisita il 22!</div>
      </div>
      <div className="chat-input">
        <input className="input" style={{ borderRadius: 22 }} placeholder="Scrivi a Sara…" />
        <button className="btn" style={{ width: 'auto', padding: '10px 13px' }}><i className="ti ti-send" /></button>
      </div>
    </>
  );
}

function SpesaList() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-basket" /></span>
        <div><b style={{ fontSize: 15 }}>Lista della spesa</b><div className="muted" style={{ fontSize: 11 }}>Per i prossimi 2 giorni</div></div>
      </div>
      {SPESA.map((it) => {
        const on = checked[it];
        return (
          <div key={it} className="spesa-item" style={{ opacity: on ? 0.55 : 1 }} onClick={() => setChecked((c) => ({ ...c, [it]: !c[it] }))}>
            <span className={`spesa-ck${on ? ' on' : ''}`}>{on && <i className="ti ti-check" />}</span>
            <span style={{ fontSize: 13 }}>{it}</span>
          </div>
        );
      })}
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'coach' | 'fame' | 'fuori' | 'sost' | 'spesa'>(null);
  const [checkin, setCheckin] = useState(true);

  const name = (user?.firstName || user?.email?.split('@')[0] || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const today = new Date();
  const dateStr = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const coach = coachOfDay(name);
  const frase = FRASI[today.getDate() % FRASI.length];

  return (
    <div className="home">
      <div className="home-head">
        <div>
          <h1 style={{ textTransform: 'capitalize' }}>Ciao, {name}</h1>
          <div className="muted" style={{ textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <div className="home-icons">
          <button className="home-icon" style={{ color: '#12A386' }} onClick={() => setSheet('coach')}><i className="ti ti-message-2" /></button>
          <button className="home-icon" style={{ color: '#6C5AB7' }} onClick={() => navigate('/negozio')}><i className="ti ti-shopping-bag" /></button>
          <button className="home-icon" style={{ color: '#10403A' }}><i className="ti ti-bell" /></button>
        </div>
      </div>

      <div className="coach-hero" style={{ background: coach.bg, cursor: 'pointer' }} onClick={() => setSheet('coach')}>
        <div className="row-between">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Il tuo coach</span>
          <span className="chip-flame"><i className="ti ti-flame" /> 5 giorni</span>
        </div>
        <div className="coach-body">
          <Gaia size={70} controls={false} mouth="big" />
          <div className="coach-head">{coach.head}</div>
        </div>
        <div className="coach-phrase">"{frase}"</div>
      </div>

      <div className="sec">Oggi a colpo d'occhio</div>
      <div className="stat-row">
        <div className="stat"><i className="ti ti-droplet" style={{ color: '#2AA7C4' }} /><div className="stat-v">5/8</div><div className="muted stat-l">acqua</div></div>
        <div className="stat"><i className="ti ti-walk" style={{ color: '#E8825A' }} /><div className="stat-v">4.200</div><div className="muted stat-l">passi</div></div>
        <div className="stat" onClick={() => navigate('/obiettivo')} style={{ cursor: 'pointer' }}><i className="ti ti-ruler-2" style={{ color: '#3A6EA5' }} /><div className="stat-v">oggi</div><div className="muted stat-l">misure</div></div>
      </div>

      <div className="row-between" style={{ margin: '6px 2px 8px' }}>
        <span className="sec" style={{ margin: 0 }}>I pasti di oggi <span className="muted" style={{ fontWeight: 400 }}>· 5 pasti</span></span>
        <span className="chip" style={{ cursor: 'pointer' }} onClick={() => setSheet('spesa')}><i className="ti ti-basket" style={{ fontSize: 13 }} /> Lista spesa</span>
      </div>
      <div className="meals-col">
        {MEALS.map((m, i) => (
          <div className="meal-row" key={i}>
            <div className="meal-thumb" style={{ background: m[5] }}><i className={`ti ${m[4]}`} style={{ color: m[6] }} /></div>
            <div className="meal-body">
              <span className="meal-tag" style={{ background: m[5], color: m[6] }}>{m[0]} · {m[3]}</span>
              <div className="meal-name">{m[1]}</div>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 12 }}>{m[2]} kcal · 15 min</span>
                {m[7] && <button className="btn-recipe" onClick={() => navigate('/menu')}>Ricetta</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sec">Ti serve una mano adesso?</div>
      <div className="card">
        <div className="qa-row">
          <span className="qa-chip" onClick={() => setSheet('fame')}>Ho fame</span>
          <span className="qa-chip" onClick={() => setSheet('fuori')}>Mangio fuori</span>
          <span className="qa-chip" onClick={() => setSheet('sost')}>Sostituisci</span>
        </div>
      </div>

      <div className="sec">Eventi gestiti</div>
      <div className="event-card" onClick={() => navigate('/calendario')}>
        <span className="event-ic"><i className="ti ti-heart" /></span>
        <div style={{ flex: 1 }}>
          <div className="event-title">Matrimonio tra 4 giorni</div>
          <div className="event-sub">Ti preparo per arrivare serena</div>
        </div>
        <i className="ti ti-chevron-right" style={{ color: '#C08363' }} />
      </div>

      {/* Popup e schede */}
      {checkin && <CheckinPopup onDone={() => setCheckin(false)} />}
      {sheet === 'coach' && <Sheet onClose={() => setSheet(null)}><CoachChat /></Sheet>}
      {sheet === 'spesa' && <Sheet onClose={() => setSheet(null)}><SpesaList /></Sheet>}
      {sheet && HELP[sheet] && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#12A386', color: '#fff' }}><i className="ti ti-sparkles" /></span>
            <b style={{ fontSize: 15 }}>{HELP[sheet].t}</b>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#2E3E3B', marginBottom: 14 }}>{HELP[sheet].b}</div>
          <button className="btn" onClick={() => setSheet(null)}>{HELP[sheet].cta}</button>
        </Sheet>
      )}
    </div>
  );
}
