import { useState } from 'react';

/** Agenda / calendario — giorni speciali con guida Prima / Il giorno / Dopo. */
const PANELS: Record<string, { title: string; body: string }> = {
  Prima: { title: 'Ci arriviamo leggeri', body: 'Menu sgonfianti, più acqua, nessun digiuno.' },
  'Il giorno': { title: 'Oggi si vive', body: 'Goditi il pranzo, senza sensi di colpa.' },
  Dopo: { title: 'Rientro morbido', body: 'Un giorno leggero, riprendi il check-in.' },
};

export default function Calendario() {
  const [tab, setTab] = useState('Prima');
  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#FBEEE7', color: '#E8825A' }}><i className="ti ti-calendar-heart" /></span>
        <div><h1 style={{ margin: 0 }}>Agenda</h1><div className="muted">I tuoi giorni speciali</div></div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="event-ic" style={{ background: '#E8825A', color: '#fff' }}><i className="ti ti-heart" /></span>
          <div><b style={{ fontSize: 14 }}>Matrimonio</b><div className="muted">Sabato · tra 4 giorni</div></div>
        </div>
        <div className="pill-row" style={{ marginBottom: 12 }}>
          {Object.keys(PANELS).map((k) => (
            <button key={k} className={`pill${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{k}</button>
          ))}
        </div>
        <div>
          <b style={{ fontSize: 13 }}>{PANELS[tab].title}</b>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#3a4b48', marginTop: 6 }}>{PANELS[tab].body}</div>
        </div>
      </div>

      <div className="card" style={{ background: '#DCEBE3', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
        <i className="ti ti-shield-check" style={{ color: '#0E7C66' }} />
        <span style={{ fontSize: 12, color: '#0E7C66' }}>I tuoi risultati restano protetti.</span>
      </div>
    </div>
  );
}
