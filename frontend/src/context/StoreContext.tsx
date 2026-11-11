'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { CartItem, User } from '@/types';

export interface WishItem { id: number; slug: string; name: string; price: number; image: string | null }
interface Toast { id: number; message: string; visible: boolean }

interface Store {
  settings: Record<string, string>;
  user: User | null;
  authReady: boolean;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (p: { id: number; slug: string; name: string; price: number; image: string | null; variantId?: number; variantName?: string | null }, qty?: number) => void;
  changeQty: (id: number, variantId: number, delta: number) => void;
  setQty: (id: number, variantId: number, qty: number) => void;
  removeFromCart: (id: number, variantId: number) => void;
  clearCart: () => void;
  wishlist: WishItem[];
  isWished: (id: number) => boolean;
  toggleWishlist: (p: WishItem) => void;
  cartOpen: boolean; setCartOpen: (v: boolean) => void;
  wishlistOpen: boolean; setWishlistOpen: (v: boolean) => void;
  mobileMenuOpen: boolean; setMobileMenuOpen: (v: boolean) => void;
  toasts: Toast[];
  showToast: (message: string) => void;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

const PENDING_KEY = 'viva_pending_add';
const WISH_KEY = 'viva_wishlist_v2';
const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ } };

export function StoreProvider({ settings, children }: { settings: Record<string, string>; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const toastId = useRef(0);
  const syncedFor = useRef<number | null>(null);

  /* ---------- Toast (mêmes classes/animation que l'original) ---------- */
  const showToast = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, visible: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, visible: true } : x))), 10);
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, visible: false } : x)));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 300);
    }, 3000);
  }, []);

  /* ---------- Hydratation depuis le navigateur ---------- */
  useEffect(() => {
    setWishlist(read<WishItem[]>(WISH_KEY, []));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) write(WISH_KEY, wishlist); }, [wishlist, hydrated]);

  /* ---------- Authentification ---------- */
  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get<{ user: User }>('/auth/me');
      setUser(r.user);
      return r.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setAuthReady(true);
    }
  }, []);
  useEffect(() => { refreshUser(); }, [refreshUser]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
    syncedFor.current = null;
    setCart([]); setWishlist([]);
    write(WISH_KEY, []);
    showToast('Vous êtes déconnecté');
  }, [showToast]);

  /* ---------- Chargement du panier du compte (le panier n'existe que pour un client connecté) ---------- */
  useEffect(() => {
    if (!hydrated || !user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    (async () => {
      try {
        const server = (await api.get<{ items: { productId: number; variantId: number; quantity: number }[] }>('/cart')).items;
        let lines: CartItem[] = [];
        if (server.length) {
          const q = await api.post('/cart/quote', { items: server });
          lines = q.lines.map((l: any) => ({ id: l.productId, variantId: l.variantId, slug: l.slug, name: l.name, variantName: l.variantName, price: l.unitPrice, image: l.image, qty: l.quantity }));
        }
        // Produit que le visiteur voulait ajouter avant de se connecter
        try {
          const raw = sessionStorage.getItem(PENDING_KEY);
          if (raw) {
            sessionStorage.removeItem(PENDING_KEY);
            const p = JSON.parse(raw);
            const ex = lines.find((i) => i.id === p.id && i.variantId === (p.variantId || 0));
            if (ex) ex.qty += p.qty || 1; else lines.push({ id: p.id, variantId: p.variantId || 0, slug: p.slug, name: p.name, variantName: p.variantName, price: p.price, image: p.image || '', qty: p.qty || 1 });
            setTimeout(() => showToast(`Ajouté au panier: "${p.name}"`), 300);
          }
        } catch { /* ignore */ }
        setCart(lines);
        const localWish = read<WishItem[]>(WISH_KEY, []);
        await Promise.all(localWish.map((w) => api.post(`/wishlist/${w.id}`).catch(() => null)));
        const wl = await api.get<{ products: any[] }>('/wishlist');
        setWishlist(wl.products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image })));
      } catch { /* chargement facultatif */ }
    })();
  }, [user, hydrated, showToast]);

  // Enregistre le panier côté serveur (debounce) pour un client connecté
  useEffect(() => {
    if (!user || !hydrated || syncedFor.current !== user.id) return;
    const t = setTimeout(() => {
      api.put('/cart', { items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, quantity: c.qty })) }).catch(() => null);
    }, 800);
    return () => clearTimeout(t);
  }, [cart, user, hydrated]);

  /* ---------- Panier ---------- */
  const addToCart: Store['addToCart'] = useCallback((p, qty = 1) => {
    // Un compte est obligatoire pour utiliser le panier : on mémorise le produit puis on envoie vers la connexion.
    if (!user) {
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, qty })); } catch { /* ignore */ }
      showToast('Connectez-vous ou créez un compte pour ajouter au panier');
      const here = window.location.pathname + window.location.search;
      setTimeout(() => router.push(`/connexion?next=${encodeURIComponent(here)}&panier=1`), 700);
      return;
    }
    const variantId = p.variantId || 0;
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id && i.variantId === variantId);
      if (ex) return c.map((i) => (i === ex ? { ...i, qty: i.qty + qty } : i));
      return [...c, { id: p.id, variantId, slug: p.slug, name: p.name, variantName: p.variantName, price: p.price, image: p.image || '', qty }];
    });
    showToast(`Ajouté au panier: "${p.name}"`);
  }, [showToast, user, router]);
  const removeFromCart = useCallback((id: number, variantId: number) => setCart((c) => c.filter((i) => !(i.id === id && i.variantId === variantId))), []);
  const changeQty = useCallback((id: number, variantId: number, delta: number) =>
    setCart((c) => c.flatMap((i) => (i.id === id && i.variantId === variantId ? (i.qty + delta <= 0 ? [] : [{ ...i, qty: i.qty + delta }]) : [i]))), []);
  const setQty = useCallback((id: number, variantId: number, qty: number) =>
    setCart((c) => c.flatMap((i) => (i.id === id && i.variantId === variantId ? (qty <= 0 ? [] : [{ ...i, qty: Math.min(999, qty) }]) : [i]))), []);
  const clearCart = useCallback(() => setCart([]), []);

  /* ---------- Favoris ---------- */
  const isWished = useCallback((id: number) => wishlist.some((w) => w.id === id), [wishlist]);
  const toggleWishlist = useCallback((p: WishItem) => {
    const has = wishlist.some((w) => w.id === p.id);
    setWishlist((w) => (has ? w.filter((x) => x.id !== p.id) : [...w, p]));
    showToast(has ? 'Retiré des favoris' : 'Ajouté aux favoris !');
    if (user) (has ? api.del(`/wishlist/${p.id}`) : api.post(`/wishlist/${p.id}`)).catch(() => null);
  }, [wishlist, user, showToast]);

  const value = useMemo<Store>(() => ({
    settings, user, authReady, refreshUser, logout,
    cart, cartCount: cart.reduce((a, i) => a + i.qty, 0), cartSubtotal: cart.reduce((a, i) => a + i.price * i.qty, 0),
    addToCart, changeQty, setQty, removeFromCart, clearCart,
    wishlist, isWished, toggleWishlist,
    cartOpen, setCartOpen, wishlistOpen, setWishlistOpen, mobileMenuOpen, setMobileMenuOpen, toasts, showToast,
  }), [settings, user, authReady, refreshUser, logout, cart, addToCart, changeQty, setQty, removeFromCart, clearCart, wishlist, isWished, toggleWishlist, cartOpen, wishlistOpen, mobileMenuOpen, toasts, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
