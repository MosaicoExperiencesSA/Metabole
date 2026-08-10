/**
 * COME UN PIANO ENTRA NEL CARRELLO — e perché su «entrambi» si parte da un mese solo.
 *
 * `billing` dice come si vende un piano, e lo decide il Negozio in backoffice:
 *
 *  - `one_time` — un mese solo, niente da scegliere;
 *  - `recurring` — solo abbonamento, niente da scegliere;
 *  - `both` — la cliente scegli, e il Checkout le mostra il pulsante per passare da una forma
 *    all'altra.
 *
 * ## Il difetto da cui nasce (12/8)
 *
 * `PlanFlow` — la coda dell'onboarding, cioè **la strada principale del primo acquisto** — dichiarava
 * il piano senza il campo `billing` e quindi non lo passava al carrello. Al Checkout la scelta fra
 * abbonamento e pagamento unico non compariva **mai**: per il carrello quel piano era `one_time`,
 * qualunque cosa dicesse il Negozio. Le altre due strade (il Negozio e il pulsante del report di fine
 * percorso) lo passavano da tempo; restava fuori quella da cui passa ogni nuova cliente.
 *
 * ## La regola del valore di partenza, che è la parte delicata
 *
 * Su `both` si parte da **un mese solo**. Non è un dettaglio di implementazione: in `PlanFlow` non
 * esiste nessuna schermata in cui la cliente abbia scelto fra le due forme — quella sta nel Negozio —
 * e mettere in carrello un **addebito ricorrente** per un'opzione che nessuno le ha mostrato è il modo
 * più rapido di trovarsi una richiesta di rimborso, e di meritarsela.
 *
 * Su `recurring` invece `abbonamento` è vero perché la forma è quella e basta: lì non c'è nessuna
 * scelta da rispettare.
 *
 * Questa funzione esiste separata dal componente per una ragione sola: così la regola si può
 * verificare. Dentro `goCheckout` sarebbe stata una riga in mezzo a una navigazione, cioè esattamente
 * il tipo di riga in cui il difetto di sopra è vissuto per mesi senza che nessuno lo vedesse.
 */

export type PlanBilling = 'one_time' | 'recurring' | 'both';

export interface PianoDaVendere {
  id: string;
  name: string;
  priceCents: number;
  period: string;
  billing?: PlanBilling | string | null;
}

export interface PianoInCarrello {
  id: string;
  name: string;
  priceCents: number;
  period: string;
  billing: PlanBilling;
  abbonamento: boolean;
}

/**
 * Normalizza `billing`. Un valore assente o sconosciuto vale `one_time`: fra le tre forme è l'unica
 * che non impegna la cliente per i mesi successivi, e davanti a un dato che non capiamo si sceglie
 * quella che non le addebita niente a sua insaputa.
 */
export function normalizzaBilling(v: unknown): PlanBilling {
  return v === 'recurring' || v === 'both' ? v : 'one_time';
}

export function pianoPerCarrello(p: PianoDaVendere): PianoInCarrello {
  const billing = normalizzaBilling(p.billing);
  return {
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    period: p.period,
    billing,
    abbonamento: billing === 'recurring',
  };
}
