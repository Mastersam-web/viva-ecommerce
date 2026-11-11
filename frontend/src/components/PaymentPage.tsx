'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/context/StoreContext';
import { Alert, Field, Spinner, btnPrimary, btnSecondary, card, inputCls } from './ui';

const ICON: Record<string, string> = { cod: 'fa-money-bill-wave', card: 'fa-credit-card', mobile_money: 'fa-mobile-screen', bank_transfer: 'fa-building-columns' };

const luhn = (n: string) => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return n.length >= 12 && s % 10 === 0; };
// Cartes de test (mode démonstration uniquement)
const TEST_SCENARIO: Record<string, 'success' | 'declined' | 'insufficient'> = { '4242424242424242': 'success', '4000000000000002': 'declined', '4000000000009995': 'insufficient' };

function CardForm({ ctx, id, onDone }: { ctx: any; id: string; onDone: () => void }) {
  const [f, setF] = useState({ number: '', name: '', exp: '', cvc: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fmtNum = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

  const stripe = async () => {
    setBusy(true); setErr('');
    try { const r = await api.post(`/orders/${id}/payment/stripe`); window.location.href = r.url; }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    const digits = f.number.replace(/\s/g, '');
    if (!luhn(digits)) return setErr('Numéro de carte invalide');
    if (f.name.trim().length < 3) return setErr('Nom du titulaire requis');
    const m = /^(\d{2})\/(\d{2})$/.exec(f.exp);
    if (!m || +m[1] < 1 || +m[1] > 12) return setErr("Date d'expiration invalide (MM/AA)");
    const now = new Date();
    if (2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) return setErr('Cette carte est expirée');
    if (!/^\d{3,4}$/.test(f.cvc)) return setErr('Cryptogramme invalide');
    setBusy(true);
    try {
      // Le numéro de carte ne quitte jamais le navigateur : seul le scénario de test et les 4 derniers chiffres sont transmis.
      const r = await api.post(`/orders/${id}/payment/card`, { scenario: TEST_SCENARIO[digits] || 'success', last4: digits.slice(-4) });
      if (r.status === 'failed') setErr(r.reason || 'Paiement refusé');
      onDone();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (!ctx.sandbox) return (
    <div className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <p className="text-xs text-gray-600">Vous allez être redirigé vers la page de paiement sécurisée de notre prestataire. Nous ne conservons aucune donnée de carte.</p>
      <button disabled={busy} onClick={stripe} className={`${btnPrimary} w-full`}>{busy ? 'Redirection…' : `Payer ${money(ctx.payment.amount)}`}</button>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <Alert kind="info"><b>Mode test.</b> Aucun montant n'est prélevé. Carte valide : 4242 4242 4242 4242 · refusée : 4000 0000 0000 0002 · fonds insuffisants : 4000 0000 0000 9995 (date future et CVC au choix).</Alert>
      {err && <Alert>{err}</Alert>}
      <Field label="Numéro de carte"><input className={inputCls} inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={f.number} onChange={(e) => setF({ ...f, number: fmtNum(e.target.value) })} /></Field>
      <Field label="Titulaire de la carte"><input className={inputCls} autoComplete="cc-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiration"><input className={inputCls} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={f.exp} onChange={(e) => setF({ ...f, exp: fmtExp(e.target.value) })} /></Field>
        <Field label="CVC"><input className={inputCls} inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Traitement…' : `Payer ${money(ctx.payment.amount)}`}</button>
    </form>
  );
}

function MobileForm({ ctx, id, onDone }: { ctx: any; id: string; onDone: () => void }) {
  const ops: any[] = ctx.operators || [];
  const [operator, setOperator] = useState(ctx.payment.operator || ops[0]?.code || '');
  const [phone, setPhone] = useState(ctx.payment.payer_phone || '');
  const [step, setStep] = useState<any>(ctx.payment.operator ? { operator: ops.find((o) => o.code === ctx.payment.operator), mode: ctx.sandbox ? 'sandbox' : 'manual' } : null);
  const [proof, setProof] = useState({ reference: '', note: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(''); try { await fn(); } catch (e: any) { setErr(e.message); } setBusy(false); };

  if (!ops.length) return <Alert>Aucun opérateur Mobile Money n'est disponible pour le moment.</Alert>;
  if (!step) return (
    <form onSubmit={(e) => { e.preventDefault(); run(async () => setStep(await api.post(`/orders/${id}/payment/mobile`, { operator, phone }))); }} className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <Field label="Opérateur"><select className={inputCls} value={operator} onChange={(e) => setOperator(e.target.value)}>{ops.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></Field>
      <Field label="Votre numéro Mobile Money" hint="Le numéro depuis lequel vous effectuerez le paiement"><input className={inputCls} type="tel" autoComplete="tel" placeholder="+257 79 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <button disabled={busy} className={`${btnPrimary} w-full`}>Continuer</button>
    </form>
  );
  const op = step.operator || {};
  return (
    <div className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 text-sm space-y-1">
        <p className="font-bold text-pine-900">{op.name}</p>
        {op.number && <p>Numéro marchand : <b className="font-mono">{op.number}</b></p>}
        {op.account_name && <p>Nom du compte : <b>{op.account_name}</b></p>}
        <p>Montant à envoyer : <b>{money(ctx.payment.amount)}</b></p>
        <p>Référence / motif : <b className="font-mono">{ctx.order.order_number}</b></p>
        {op.instructions && <p className="text-xs text-gray-600 pt-1">{op.instructions}</p>}
      </div>
      {step.mode === 'sandbox' ? (
        <div className="space-y-2">
          <Alert kind="info"><b>Mode test.</b> Simulez la réponse de l'opérateur : aucun argent n'est transféré.</Alert>
          <button disabled={busy} onClick={() => run(async () => { await api.post(`/orders/${id}/payment/mobile/sandbox`, { outcome: 'success' }); onDone(); })} className={`${btnPrimary} w-full`}>Simuler un paiement approuvé</button>
          <button disabled={busy} onClick={() => run(async () => { await api.post(`/orders/${id}/payment/mobile/sandbox`, { outcome: 'failure' }); onDone(); })} className={`${btnSecondary} w-full`}>Simuler un paiement refusé</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post(`/orders/${id}/payment/proof`, { reference: proof.reference, phone: phone || undefined, operator: op.code, note: proof.note || undefined }); onDone(); }); }} className="space-y-3">
          <p className="text-xs text-gray-600">Une fois le transfert effectué, indiquez l'identifiant de la transaction reçu par SMS. Notre équipe vérifiera le paiement et confirmera votre commande.</p>
          <Field label="Identifiant de transaction"><input className={inputCls} required value={proof.reference} onChange={(e) => setProof({ ...proof, reference: e.target.value })} /></Field>
          <Field label="Note (facultatif)"><input className={inputCls} value={proof.note} onChange={(e) => setProof({ ...proof, note: e.target.value })} /></Field>
          <button disabled={busy} className={`${btnPrimary} w-full`}>J'ai effectué le paiement</button>
        </form>
      )}
      <button type="button" onClick={() => setStep(null)} className="text-xs font-bold text-pine-900 hover:underline">Changer d'opérateur ou de numéro</button>
    </div>
  );
}

function BankForm({ ctx, id, onDone }: { ctx: any; id: string; onDone: () => void }) {
  const [proof, setProof] = useState({ reference: '', note: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post(`/orders/${id}/payment/proof`, { reference: proof.reference, note: proof.note || undefined }); onDone(); } catch (x: any) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 text-sm space-y-2">
        <p className="font-bold text-pine-900">Coordonnées bancaires</p>
        <p className="font-mono text-xs whitespace-pre-line break-words">{ctx.bank?.details}</p>
        <p>Montant : <b>{money(ctx.payment.amount)}</b></p>
        <p>Référence à indiquer : <b className="font-mono">{ctx.bank?.reference}</b></p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <p className="text-xs text-gray-600">Après votre virement, indiquez sa référence (numéro d'opération) pour que notre équipe le rapproche de votre commande.</p>
        <Field label="Référence du virement"><input className={inputCls} required value={proof.reference} onChange={(e) => setProof({ ...proof, reference: e.target.value })} /></Field>
        <Field label="Note (facultatif)"><input className={inputCls} value={proof.note} onChange={(e) => setProof({ ...proof, note: e.target.value })} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>J'ai effectué le virement</button>
      </form>
    </div>
  );
}

function PaymentInner() {
  const id = useSearchParams().get('order') || '';
  const router = useRouter();
  const { user, authReady } = useStore();
  const [ctx, setCtx] = useState<any>(null); const [err, setErr] = useState(''); const [switching, setSwitching] = useState(false);
  const load = useCallback(() => api.get(`/orders/${id}/payment`).then(setCtx).catch((e) => setErr(e.message)), [id]);
  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.replace(`/connexion?next=${encodeURIComponent(`/commande/paiement?order=${id}`)}`); return; }
    load();
  }, [authReady, user, id, load, router]);

  if (err) return <Alert>{err}</Alert>;
  if (!ctx) return <Spinner />;
  const { order, payment, method } = ctx;
  const paid = payment.status === 'paid';
  const verifying = payment.status === 'pending' && !!payment.proof_submitted_at;
  const change = async (code: string) => {
    setSwitching(true); setErr('');
    try { const r = await api.post(`/orders/${id}/pay`, { paymentMethod: code }); if (code === 'cod') router.push(`/commande/confirmation?order=${id}`); else { await load(); } void r; }
    catch (e: any) { setErr(e.message); }
    setSwitching(false);
  };

  return (
    <div className={`${card} p-6 sm:p-8 space-y-5 max-w-lg mx-auto shadow-xl`}>
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center mx-auto"><i className={`fa-solid ${ICON[method.code] || 'fa-wallet'} text-xl`}></i></div>
        <h1 className="text-xl font-extrabold text-pine-900">Paiement · {method.label}</h1>
        <p className="text-sm text-gray-600">Commande <b>{order.order_number}</b></p>
        <p className="text-2xl font-extrabold text-pine-900">{money(payment.amount)}</p>
      </div>

      {paid && <><Alert kind="success">Paiement reçu. Merci ! Vous serez notifié à chaque étape de votre commande.</Alert>
        <Link href={`/compte/commandes/${order.id}`} className={`${btnPrimary} block text-center`}>Suivre ma commande</Link></>}

      {verifying && <><Alert kind="info"><b>Paiement en cours de vérification.</b> Notre équipe contrôle votre paiement{payment.payer_reference ? <> (réf. <span className="font-mono">{payment.payer_reference}</span>)</> : null}. Vous recevrez une notification dès qu'il sera confirmé.</Alert>
        <Link href={`/compte/commandes/${order.id}`} className={`${btnSecondary} block text-center`}>Voir ma commande</Link></>}

      {!paid && !verifying && !ctx.payable && <Alert>Cette commande ne peut plus être réglée en ligne.</Alert>}

      {!paid && !verifying && ctx.payable && (
        <>
          {payment.status === 'failed' && <Alert>Paiement non abouti{payment.failure_reason ? ` : ${payment.failure_reason}` : ''}. Vous pouvez réessayer ou choisir un autre moyen de paiement.</Alert>}
          {method.description && <p className="text-xs text-gray-500 text-center">{method.description}</p>}
          {method.code === 'card' && <CardForm ctx={ctx} id={id} onDone={load} />}
          {method.code === 'mobile_money' && <MobileForm ctx={ctx} id={id} onDone={load} />}
          {method.code === 'bank_transfer' && <BankForm ctx={ctx} id={id} onDone={load} />}
          {method.code === 'cod' && <Link href={`/commande/confirmation?order=${id}`} className={`${btnPrimary} block text-center`}>Continuer</Link>}
          {ctx.otherMethods?.length > 1 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-700">Changer de moyen de paiement</p>
              <div className="flex flex-wrap gap-2">
                {ctx.otherMethods.filter((m: any) => m.code !== method.code).map((m: any) => (
                  <button key={m.code} disabled={switching} onClick={() => change(m.code)} className="text-xs font-bold border border-gray-200 hover:border-pine-900 rounded-full px-4 py-2"><i className={`fa-solid ${ICON[m.code] || 'fa-wallet'} mr-1.5 text-pine-900`}></i>{m.label}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export const PaymentPage = () => <Suspense fallback={<Spinner />}><PaymentInner /></Suspense>;
