'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/context/StoreContext';

const input = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pine-900';

export default function ContactForm() {
  const { showToast, user } = useStore();
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/support/tickets', { ...f, name: f.name || (user ? `${user.first_name} ${user.last_name}` : ''), email: f.email || user?.email || '', type: 'contact' });
      showToast('Votre message a bien été envoyé !');
      setF({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) { showToast(err.message || "Impossible d'envoyer le message"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Nom complet</label>
          <input type="text" required value={f.name} onChange={set('name')} placeholder="Jean Dupont" className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Adresse Email</label>
          <input type="email" required value={f.email} onChange={set('email')} placeholder="jean@example.com" className={input} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Sujet</label>
        <input type="text" required value={f.subject} onChange={set('subject')} placeholder="Question sur ma commande..." className={input} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-700">Message</label>
        <textarea rows={4} required value={f.message} onChange={set('message')} placeholder="Bonjour, je souhaite savoir..." className={input}></textarea>
      </div>
      <button type="submit" disabled={busy} className="bg-pine-900 hover:bg-pine-800 text-white font-bold py-3 px-8 rounded-full transition text-sm shadow-md disabled:opacity-60">
        Envoyer le message
      </button>
    </form>
  );
}
