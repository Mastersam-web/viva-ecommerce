'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/context/StoreContext';
import { Alert, Spinner, btnPrimary, btnSecondary, card } from './ui';

function ConfirmationInner() {
  const id = useSearchParams().get('order');
  const { user, authReady } = useStore();
  const [order, setOrder] = useState<any>(null); const [instr, setInstr] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (!id || !authReady) return;
    if (!user) { setErr('Connectez-vous pour consulter cette commande.'); return; }
    api.get(`/orders/${id}`).then((r) => setOrder(r.order)).catch((e) => setErr(e.message));
    try { const v = sessionStorage.getItem(`viva_instr_${id}`); if (v) setInstr(JSON.parse(v)); } catch { /* ignore */ }
  }, [id, user, authReady]);
  if (err) return <Alert>{err}</Alert>;
  if (!order) return <Spinner />;
  return (
    <div className={`${card} p-8 sm:p-12 text-center space-y-5 max-w-2xl mx-auto`}>
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl"><i className="fa-solid fa-check"></i></div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-pine-900">Merci pour votre commande !</h1>
      <p className="text-sm text-gray-600">Commande <b className="text-gray-900">{order.order_number}</b> · Total <b className="text-gray-900">{money(order.grand_total)}</b></p>
      {instr?.type === 'instructions' && (
        <div className="text-left"><Alert kind="info"><p>{instr.message}</p>{instr.details && <p className="mt-2 font-mono text-[11px] break-words">{instr.details}</p>}{instr.reference && <p className="mt-2">Référence à indiquer : <b>{instr.reference}</b></p>}</Alert></div>
      )}
      {instr?.type === 'none' && <Alert kind="info">{instr.message}</Alert>}
      <p className="text-xs text-gray-500">Un email de confirmation vient de vous être envoyé.</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href={`/compte/commandes/${order.id}`} className={btnPrimary}>Suivre ma commande</Link>
        <Link href="/boutique" className={btnSecondary}>Continuer mes achats</Link>
      </div>
    </div>
  );
}
export const Confirmation = () => <Suspense fallback={<Spinner />}><ConfirmationInner /></Suspense>;
