'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/context/StoreContext';

export default function Newsletter() {
  const { showToast } = useStore();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/newsletter', { email });
      showToast(`Merci pour votre inscription, ${email} !`);
      setEmail('');
    } catch (err: any) {
      showToast(err.message || 'Inscription impossible');
    } finally { setBusy(false); }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-pine-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl border border-pine-800">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400 text-xl">
            <i className="fa-regular fa-envelope"></i>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Stay in the Loop</h3>
          <p className="text-sage-200 text-xs sm:text-sm">
            Inscrivez-vous pour recevoir nos offres exclusives, nouveautés et conseils directement dans votre boîte mail.
          </p>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Entrez votre email..." aria-label="Email"
              className="bg-white/10 text-white placeholder-sage-300 border border-white/20 rounded-full px-5 py-3 text-xs sm:text-sm focus:outline-none focus:bg-white/20 flex-1"
            />
            <button type="submit" disabled={busy} className="bg-sage-100 hover:bg-white text-pine-900 font-extrabold px-6 py-3 rounded-full transition text-xs sm:text-sm disabled:opacity-60">
              S'abonner
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
