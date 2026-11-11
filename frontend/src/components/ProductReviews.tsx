'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, dateFr } from '@/lib/api';
import { useStore } from '@/context/StoreContext';

export default function ProductReviews({ productId, distribution, total }: { productId: number; distribution: { rating: number; count: number }[]; total: number }) {
  const { user, showToast } = useStore();
  const [reviews, setReviews] = useState<any[]>([]);
  const [form, setForm] = useState({ rating: 5, title: '', comment: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/products/${productId}/reviews?limit=20`).then((r) => setReviews(r.reviews)).catch(() => null), [productId]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/products/${productId}/reviews`, form); showToast('Merci pour votre avis !'); setForm({ rating: 5, title: '', comment: '' }); load(); }
    catch (err: any) { showToast(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-6" id="avis">
      <h2 className="text-2xl font-extrabold text-pine-900 tracking-tight">Avis des clients</h2>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-2 h-fit">
          {distribution.map((d) => (
            <div key={d.rating} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-bold text-gray-600">{d.rating} ★</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${total ? (d.count / total) * 100 : 0}%` }}></div></div>
              <span className="w-6 text-right text-gray-400">{d.count}</span>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {reviews.length === 0 && <p className="text-sm text-gray-500">Aucun avis pour le moment.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-1">
              <div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-900">{r.author}</span><span className="text-[11px] text-gray-400">{dateFr(r.createdAt)}</span></div>
              <div className="text-amber-400 text-[11px] flex">{Array.from({ length: 5 }, (_, i) => <i key={i} className={`fa-solid fa-star${i < r.rating ? '' : ' text-gray-200'}`}></i>)}</div>
              {r.title && <p className="text-sm font-bold text-gray-800">{r.title}</p>}
              {r.comment && <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>}
            </div>
          ))}
          {user ? (
            <form onSubmit={submit} className="bg-sage-100 rounded-3xl border border-sage-200 p-5 space-y-3">
              <p className="text-sm font-bold text-pine-900">Donner mon avis (produit acheté et livré)</p>
              <div className="flex gap-1 text-xl text-amber-400">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} étoiles`}><i className={`fa-solid fa-star${n <= form.rating ? '' : ' text-gray-300'}`}></i></button>)}</div>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre (facultatif)" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-pine-900" />
              <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} placeholder="Votre commentaire" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-pine-900" />
              <button disabled={busy} className="bg-pine-900 hover:bg-pine-800 text-white font-bold px-6 py-2.5 rounded-full text-xs disabled:opacity-60">Publier</button>
            </form>
          ) : <p className="text-xs text-gray-500"><Link href="/connexion" className="font-bold text-pine-900 hover:underline">Connectez-vous</Link> pour donner votre avis.</p>}
        </div>
      </div>
    </section>
  );
}
