import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * `billing` dice COME si vende il piano, e lo decide il Negozio in backoffice:
 * `one_time` = una-tantum (i percorsi 1/3/6 mesi), `recurring` = solo abbonamento (il
 * monitoraggio), `both` = a scelta della cliente (il mantenimento: abbonamento o mese singolo).
 *
 * `abbonamento` è la scelta fatta, e conta **soltanto** quando `billing` è `both`. Sugli altri
 * piani decide il piano, non la cliente: per questo la verità sta in `ricorrente` qui sotto e non
 * nel flag da solo. La stessa regola è scritta anche nel backend (`commerce.service.checkout`):
 * qui serve a mostrare la schermata giusta, lì a impedire l'acquisto sbagliato.
 */
export type PlanBilling = 'one_time' | 'recurring' | 'both';
export interface CartPlan { id: string; name: string; priceCents: number; period: string; billing?: PlanBilling; abbonamento?: boolean; }
export interface CartProduct { id: string; name: string; priceCents: number; qty: number; }

/** True se questo piano diventerà un addebito ricorrente. Unica definizione, usata ovunque. */
export function isRicorrente(plan: CartPlan | null): boolean {
  if (!plan) return false;
  const billing = plan.billing ?? 'one_time';
  return billing === 'recurring' || (billing === 'both' && !!plan.abbonamento);
}

interface CartValue {
  plan: CartPlan | null;
  /** True se il carrello, così com'è, diventerà un abbonamento con addebito automatico. */
  ricorrente: boolean;
  products: CartProduct[];
  setPlan: (p: CartPlan | null) => void;
  /** Abbonamento o mese singolo sul piano già nel carrello (ha effetto solo sui piani `both`). */
  setAbbonamento: (v: boolean) => void;
  addProduct: (p: { id: string; name: string; priceCents: number }) => void;
  setQty: (id: string, qty: number) => void;
  removeProduct: (id: string) => void;
  clear: () => void;
  count: number;
  subtotalCents: number;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<CartPlan | null>(null);
  const [products, setProducts] = useState<CartProduct[]>([]);

  function setAbbonamento(v: boolean) {
    setPlan((p) => (p ? { ...p, abbonamento: v } : p));
  }
  function addProduct(p: { id: string; name: string; priceCents: number }) {
    setProducts((list) => {
      const found = list.find((x) => x.id === p.id);
      if (found) return list.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...list, { ...p, qty: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    setProducts((list) => (qty <= 0 ? list.filter((x) => x.id !== id) : list.map((x) => (x.id === id ? { ...x, qty } : x))));
  }
  function removeProduct(id: string) {
    setProducts((list) => list.filter((x) => x.id !== id));
  }
  function clear() {
    setPlan(null);
    setProducts([]);
  }

  const subtotalCents = (plan?.priceCents ?? 0) + products.reduce((a, p) => a + p.priceCents * p.qty, 0);
  const count = (plan ? 1 : 0) + products.reduce((a, p) => a + p.qty, 0);
  const ricorrente = isRicorrente(plan);

  const value = useMemo(
    () => ({ plan, ricorrente, products, setPlan, setAbbonamento, addProduct, setQty, removeProduct, clear, count, subtotalCents }),
    [plan, ricorrente, products, count, subtotalCents],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart fuori da CartProvider');
  return ctx;
}
