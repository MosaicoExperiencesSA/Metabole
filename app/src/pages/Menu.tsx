import { useState } from 'react';

/**
 * Menu / diario — replica del prototipo: intestazione, toggle Oggi/Domani,
 * carosello pasti con "Ricetta", storico menu, e il dettaglio ricetta
 * ("Come si cucina": Veloce / Al forno / Meal prep). Dati dimostrativi.
 */

type Meal = [string, string, number, string, string, string, string];
const DAYS: Record<'oggi' | 'domani', Meal[]> = {
  oggi: [
    ['Colazione', 'Yogurt, avena e frutta', 320, 'Veloce', 'ti-coffee', '#F3E8DC', '#B8863B'],
    ['Spuntino', 'Frutta secca e frutto', 150, 'Al volo', 'ti-apple', '#F3F9E8', '#4D7C0F'],
    ['Pranzo', 'Farro, pollo e verdure', 480, 'Da portare', 'ti-salad', '#DCEBE3', '#12A386'],
    ['Merenda', 'Yogurt greco', 120, 'Leggera', 'ti-cup', '#EFEAF9', '#6C5AB7'],
    ['Cena', 'Orata, patate e insalata', 430, 'Leggera', 'ti-fish', '#DCEBE3', '#0E7C66'],
  ],
  domani: [
    ['Colazione', 'Pancake proteici', 350, 'Sfizio sano', 'ti-coffee', '#F3E8DC', '#B8863B'],
    ['Spuntino', 'Un frutto', 80, 'Al volo', 'ti-apple', '#F3F9E8', '#4D7C0F'],
    ['Pranzo', 'Vellutata e legumi', 400, 'Comfort', 'ti-bowl-spoon', '#DCEBE3', '#12A386'],
    ['Merenda', 'Cioccolato fondente', 90, 'Sfizio', 'ti-cup', '#EFEAF9', '#6C5AB7'],
    ['Cena', 'Pizza integrale', 520, 'Giorno libero', 'ti-pizza', '#FBEEE7', '#E8825A'],
  ],
};

const STORICO: [string, string, boolean, string][] = [
  ['Menu mediterraneo', 'Lun 6 lug', true, '-0,4 kg'],
  ['Sgarro gestito', 'Sab 4 lug', true, 'stabile'],
  ['Menu proteico', 'Gio 2 lug', false, '+0,2 kg'],
];

const METHODS: Record<string, string[]> = {
  Veloce: ['Lessa il farro.', 'Salta il pollo.', 'Aggiungi le verdure.', 'Condisci.'],
  'Al forno': ['Cuoci il farro.', 'In teglia pollo e verdure.', 'Forno 200° per 18 min.'],
  'Meal prep': ['La sera prima cuoci tutto.', 'Dividi nei contenitori.', 'Condisci al momento.'],
};

function Recipe({ meal, onBack }: { meal: Meal; onBack: () => void }) {
  const [method, setMethod] = useState('Veloce');
  return (
    <div className="menu">
      <button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button>
      <h1>{meal[1]}</h1>
      <div className="recipe-tags">
        <span className="meal-tag" style={{ background: '#F2EFE8', color: '#5F6E6B' }}>{meal[2]} kcal</span>
        <span className="meal-tag" style={{ background: '#F2EFE8', color: '#5F6E6B' }}>15 min</span>
        <span className="meal-tag" style={{ background: '#DCEBE3', color: '#0E7C66' }}>{meal[3]}</span>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-tools-kitchen-2" /></span>
          <b style={{ fontSize: 13 }}>Come si cucina</b>
        </div>
        <div className="pill-row" style={{ marginBottom: 10 }}>
          {Object.keys(METHODS).map((k) => (
            <button key={k} className={`pill${method === k ? ' on' : ''}`} onClick={() => setMethod(k)}>{k}</button>
          ))}
        </div>
        <ol className="recipe-steps">
          {METHODS[method].map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}

export default function Menu() {
  const [day, setDay] = useState<'oggi' | 'domani'>('oggi');
  const [recipe, setRecipe] = useState<Meal | null>(null);

  if (recipe) return <Recipe meal={recipe} onBack={() => setRecipe(null)} />;

  const meals = DAYS[day];
  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#F3E8DC', color: '#B8863B' }}><i className="ti ti-chef-hat" /></span>
        <div>
          <h1 style={{ margin: 0 }}>Il mio menu</h1>
          <div className="muted">Piano 5 pasti · la tua giornata</div>
        </div>
      </div>

      <div className="pill-row" style={{ marginBottom: 12 }}>
        <button className={`pill${day === 'oggi' ? ' on' : ''}`} onClick={() => setDay('oggi')}>Oggi</button>
        <button className={`pill${day === 'domani' ? ' on' : ''}`} onClick={() => setDay('domani')}>Domani</button>
      </div>

      <div className="meals-col">
        {meals.map((m, i) => (
          <div className="meal-row" key={i}>
            <div className="meal-thumb" style={{ background: m[5] }}><i className={`ti ${m[4]}`} style={{ color: m[6] }} /></div>
            <div className="meal-body">
              <span className="meal-tag" style={{ background: m[5], color: m[6] }}>{m[0]} · {m[3]}</span>
              <div className="meal-name">{m[1]}</div>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 12 }}>{m[2]} kcal · 15 min</span>
                <button className="btn-recipe" onClick={() => setRecipe(m)}>Ricetta</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sec">Storico menu</div>
      <div className="meals-col">
        {STORICO.map((s, i) => (
          <div className="card storico-row" key={i}>
            <span className={`storico-thumb${s[2] ? ' ok' : ''}`}><i className={`ti ${s[2] ? 'ti-check' : 'ti-minus'}`} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s[0]}</div>
              <div className="muted" style={{ fontSize: 11 }}>{s[1]}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: s[2] ? '#3B6D11' : '#993C1D' }}>{s[2] ? 'Vantaggio' : 'Nessun calo'}</div>
              <div className="muted" style={{ fontSize: 10 }}>{s[3]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
