'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Spinner, btnPrimary, btnSecondary, card } from './ui';

function Inner() {
  const sp = useSearchParams(); const email = sp.get('email') || ''; const sig = sp.get('sig') || '';
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle'); const [err, setErr] = useState('');
  const go = async () => {
    setState('busy'); setErr('');
    try { await api.get(`/newsletter/unsubscribe?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(sig)}`); setState('done'); }
    catch (e: any) { setErr(e.message); setState('idle'); }
  };
  return (
    <div className={`${card} p-8 text-center space-y-4 max-w-md mx-auto`}>
      <h1 className="text-xl font-extrabold text-pine-900">Désabonnement de la newsletter</h1>
      {err && <Alert>{err}</Alert>}
      {state === 'done' ? <Alert kind="success">Vous êtes désinscrit(e). Vous ne recevrez plus nos e-mails.</Alert>
        : !email || !sig ? <Alert>Lien de désabonnement invalide.</Alert>
        : <><p className="text-sm text-gray-600">Confirmer le désabonnement de <b>{email}</b> ?</p>
          <button disabled={state === 'busy'} onClick={go} className={btnPrimary}>Me désabonner</button></>}
      <div><Link href="/" className={`${btnSecondary} inline-block`}>Retour à la boutique</Link></div>
    </div>
  );
}
export const Unsubscribe = () => <Suspense fallback={<Spinner />}><Inner /></Suspense>;
