'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/context/StoreContext';
import { Alert, Field, btnPrimary, card, inputCls } from './ui';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

function Box({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={`${card} p-8 space-y-6 shadow-xl`}>
      <div className="space-y-1 text-center">
        <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center mx-auto mb-3"><i className="fa-solid fa-leaf text-xl"></i></div>
        <h1 className="text-2xl font-extrabold text-pine-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LoginInner() {
  const { refreshUser, showToast } = useStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api.post('/auth/login', f);
      const u = await refreshUser();
      showToast(`Bienvenue ${u?.first_name || ''} !`);
      router.push(next || (u?.isStaff ? (u.isAdmin || u.permissions.includes('dashboard.view') ? '/admin' : '/admin/livraisons') : '/compte'));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Box title="Connexion" subtitle="Accédez à votre compte VIVA">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <Field label="Adresse email"><input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} placeholder="jean@example.com" /></Field>
        <Field label="Mot de passe"><input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} /></Field>
        <div className="text-right"><Link href="/mot-de-passe-oublie" className="text-xs font-bold text-pine-900 hover:underline">Mot de passe oublié ?</Link></div>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <p className="text-center text-xs text-gray-600">Pas encore de compte ? <Link href={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-pine-900 hover:underline">Créer un compte</Link></p>
    </Box>
  );
}
export const LoginForm = () => <Suspense><LoginInner /></Suspense>;

function RegisterInner() {
  const { refreshUser, showToast } = useStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.password !== f.confirm) return setErr('Les mots de passe ne correspondent pas');
    setBusy(true);
    try {
      await api.post('/auth/register', { first_name: f.first_name, last_name: f.last_name, email: f.email, phone: f.phone || null, password: f.password });
      await refreshUser(); showToast('Compte créé ! Un email de confirmation vous a été envoyé.');
      router.push(next || '/compte');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Box title="Créer un compte" subtitle="Rejoignez VIVA Live Better">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input required value={f.first_name} onChange={set('first_name')} autoComplete="given-name" className={inputCls} /></Field>
          <Field label="Nom"><input required value={f.last_name} onChange={set('last_name')} autoComplete="family-name" className={inputCls} /></Field>
        </div>
        <Field label="Adresse email"><input type="email" required value={f.email} onChange={set('email')} autoComplete="email" className={inputCls} /></Field>
        <Field label="Téléphone (facultatif)"><input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" className={inputCls} placeholder="+33 6 12 34 56 78" /></Field>
        <Field label="Mot de passe" hint="8 caractères minimum, avec majuscule, minuscule et chiffre"><input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" className={inputCls} /></Field>
        <Field label="Confirmer le mot de passe"><input type="password" required value={f.confirm} onChange={set('confirm')} autoComplete="new-password" className={inputCls} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
      <p className="text-center text-xs text-gray-600">Déjà inscrit ? <Link href="/connexion" className="font-bold text-pine-900 hover:underline">Se connecter</Link></p>
    </Box>
  );
}
export const RegisterForm = () => <Suspense><RegisterInner /></Suspense>;

export function ForgotForm() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { setMsg((await api.post('/auth/forgot-password', { email })).message); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <Box title="Mot de passe oublié" subtitle="Nous vous envoyons un lien de réinitialisation">
      {msg ? <Alert kind="success">{msg}</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          {err && <Alert>{err}</Alert>}
          <Field label="Adresse email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <button disabled={busy} className={`${btnPrimary} w-full`}>Envoyer le lien</button>
        </form>
      )}
      <p className="text-center text-xs"><Link href="/connexion" className="font-bold text-pine-900 hover:underline">Retour à la connexion</Link></p>
    </Box>
  );
}

function ResetInner() {
  const token = useSearchParams().get('token') || '';
  const router = useRouter();
  const [f, setF] = useState({ password: '', confirm: '' }); const [err, setErr] = useState(''); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.password !== f.confirm) return setErr('Les mots de passe ne correspondent pas');
    setBusy(true);
    try { await api.post('/auth/reset-password', { token, password: f.password }); setOk(true); setTimeout(() => router.push('/connexion'), 2000); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Box title="Nouveau mot de passe">
      {ok ? <Alert kind="success">Mot de passe modifié. Redirection vers la connexion…</Alert> : !token ? <Alert>Lien invalide.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          {err && <Alert>{err}</Alert>}
          <Field label="Nouveau mot de passe" hint="8 caractères minimum, avec majuscule, minuscule et chiffre"><input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} autoComplete="new-password" /></Field>
          <Field label="Confirmer"><input type="password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} className={inputCls} autoComplete="new-password" /></Field>
          <button disabled={busy} className={`${btnPrimary} w-full`}>Enregistrer</button>
        </form>
      )}
    </Box>
  );
}
export const ResetForm = () => <Suspense><ResetInner /></Suspense>;

function VerifyInner() {
  const token = useSearchParams().get('token') || '';
  const { refreshUser } = useStore();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading'); const [msg, setMsg] = useState('');
  useEffect(() => {
    api.post('/auth/verify-email', { token }).then(() => { setState('ok'); refreshUser(); }).catch((e) => { setState('error'); setMsg(e.message); });
  }, [token, refreshUser]);
  return (
    <Box title="Confirmation de l'email">
      {state === 'loading' ? <p className="text-center text-sm text-gray-500">Vérification…</p> : state === 'ok' ? <Alert kind="success">Votre adresse email est confirmée. Merci !</Alert> : <Alert>{msg}</Alert>}
      <p className="text-center text-xs"><Link href="/" className="font-bold text-pine-900 hover:underline">Retour à la boutique</Link></p>
    </Box>
  );
}
export const VerifyForm = () => <Suspense><VerifyInner /></Suspense>;
