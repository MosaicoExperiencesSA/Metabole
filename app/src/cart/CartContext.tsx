import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CartPlan { id: string; name: string; priceCents: number; period: string; }
export interface CartProduct { id: string; name: string; priceCents: number; qty: number; }

interface CartValue {
  plan: CartPlan | null;
  products: CartProduct[];
  setPlan: (p: CartPlan | null) => void;
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

  const value = useMemo(
    () => ({ plan, products, setPlan, addProduct, setQty, removeProduct, clear, count, subtotalCents }),
    [plan, products, count, subtotalCents],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart fuori da CartProvider');
  return ctx;
}
