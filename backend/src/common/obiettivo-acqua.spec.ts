/**
 * L'obiettivo dell'acqua, uno solo (Simone, 12/8: «33 ml/kg dal parametro, ovunque»).
 *
 * Il test che conta è quello sui limiti: se il report si calcolasse i litri per conto suo
 * tornerebbe a dire un numero diverso dalla home agli estremi — solo un po' meno diverso di prima.
 */
import { BICCHIERI_MAX, BICCHIERI_MIN, bicchieriObiettivo, litriDaBicchieri, litriObiettivo } from './obiettivo-acqua';

const ML_PER_KG = 33;

describe('bicchieriObiettivo', () => {
  it('70 kg → 9 bicchieri', () => {
    // 70 × 33 = 2310 ml → 9,24 bicchieri → 9.
    expect(bicchieriObiettivo(70, ML_PER_KG)).toBe(9);
  });

  it('⚠️ sotto il minimo si alza, sopra il massimo si ferma', () => {
    // Sotto il minimo non sarebbe salutare per nessuno; sopra il massimo l'obiettivo diventa
    // irraggiungibile — e un obiettivo irraggiungibile si ignora e basta.
    expect(bicchieriObiettivo(30, ML_PER_KG)).toBe(BICCHIERI_MIN);
    expect(bicchieriObiettivo(200, ML_PER_KG)).toBe(BICCHIERI_MAX);
  });

  it('⚠️ senza peso non si inventa un numero', () => {
    // Chi chiama usa il proprio ripiego (il globale `water_goal_glasses`), invece di calcolare su
    // un peso che non ha.
    expect(bicchieriObiettivo(null, ML_PER_KG)).toBeNull();
    expect(bicchieriObiettivo(0, ML_PER_KG)).toBeNull();
    expect(bicchieriObiettivo(-5, ML_PER_KG)).toBeNull();
    expect(bicchieriObiettivo(undefined, ML_PER_KG)).toBeNull();
  });

  it('un parametro storto non produce un obiettivo storto', () => {
    expect(bicchieriObiettivo(70, 0)).toBeNull();
    expect(bicchieriObiettivo(70, NaN)).toBeNull();
  });

  it('cambiare il parametro cambia l\'obiettivo, che è il motivo per cui è un parametro', () => {
    expect(bicchieriObiettivo(70, 40)).toBe(11);
  });
});

describe('i litri sono gli stessi bicchieri, non un altro conto', () => {
  it('⚠️ il report parte dai bicchieri, quindi rispetta gli stessi limiti', () => {
    // A 130 kg il calcolo grezzo darebbe 4,29 L; la home ne mostra 4,0 (16 bicchieri). Prima il
    // report diceva 3,9 con la sua formula: tre numeri diversi per la stessa persona.
    expect(litriObiettivo(130, ML_PER_KG)).toBe(4);
    expect(litriObiettivo(70, ML_PER_KG)).toBe(2.25);
  });

  it('⚠️ e non è quello che diceva prima: 70 kg passa da 2,1 a 2,25 L', () => {
    // Conseguenza accettata da Simone: la home aveva ragione, il report si allinea.
    expect(litriObiettivo(70, ML_PER_KG)).not.toBe(2.1);
  });

  it('senza bicchieri non ci sono litri', () => {
    expect(litriDaBicchieri(null)).toBeNull();
    expect(litriObiettivo(null, ML_PER_KG)).toBeNull();
  });

  it('la conversione è pulita: un bicchiere è 250 ml', () => {
    expect(litriDaBicchieri(8)).toBe(2);
    expect(litriDaBicchieri(6)).toBe(1.5);
  });
});
