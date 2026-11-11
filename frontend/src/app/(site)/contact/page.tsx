import type { Metadata } from 'next';
import ContactForm from '@/components/ContactForm';
import { serverGet } from '@/lib/server';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez notre équipe : formulaire, adresse, téléphone et horaires du service client VIVA Live Better.',
  alternates: { canonical: '/contact' },
};
export const revalidate = 60;

export default async function ContactPage() {
  const s = (await serverGet<{ settings: Record<string, string> }>('/settings'))?.settings || {};
  const address = s['store.contact_address'] || '123 Avenue de la République, 75011 Paris, France';
  const phone = s['store.contact_phone'] || '+33 1 23 45 67 89';
  const email = s['store.contact_email'] || 'support@vivalivebetter.com';
  const hours = s['store.opening_hours'] || 'Lundi - Samedi: 9h00 - 19h00';
  const info = [
    { icon: 'fa-location-dot', title: 'Siège Social & Boutique', text: address },
    { icon: 'fa-phone', title: 'Téléphone', text: phone },
    { icon: 'fa-envelope', title: 'Email Support', text: email },
    { icon: 'fa-clock', title: "Horaires d'Ouverture", text: hours },
  ];
  return (
    <div className="page-content relative bg-gradient-to-b from-gray-50 via-sage-50/30 to-gray-50 min-h-screen">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-fixed opacity-[0.04] pointer-events-none"></div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 relative z-10">
        {/* En-tête Contact avec image de fond */}
        <div className="relative rounded-3xl p-8 text-center space-y-3 max-w-3xl mx-auto overflow-hidden border border-sage-200 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?auto=format&fit=crop&w=1200&q=80" alt="Contact Header Background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950/90 via-pine-900/85 to-pine-950/90 backdrop-blur-xs"></div>

          <div className="relative z-10 space-y-2 text-white">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-md">Besoin d'aide ?</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Contactez notre équipe</h1>
            <p className="text-sage-200 text-xs sm:text-sm max-w-xl mx-auto">Notre service client dédié répond à toutes vos demandes 7j/7.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Formulaire de Contact */}
          <div className="lg:col-span-7 bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Envoyez-nous un message</h3>
            <ContactForm />
          </div>

          {/* Information Cards */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-sage-100 p-6 sm:p-8 rounded-3xl border border-sage-200 space-y-6">
              <h3 className="font-bold text-pine-900 text-xl">Nos Coordonnées</h3>
              <div className="space-y-4 text-xs sm:text-sm text-gray-700">
                {info.map((i) => (
                  <div key={i.title} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-pine-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`fa-solid ${i.icon} text-xs`}></i>
                    </div>
                    <div>
                      <p className="font-bold text-pine-900">{i.title}</p>
                      <p className="text-gray-600">{i.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Support Card */}
            <div className="bg-pine-900 text-white rounded-3xl p-6 shadow-md border border-pine-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
                <i className="fa-solid fa-headset text-lg"></i>
              </div>
              <h4 className="font-bold text-base">Assistance Rapide 24/7</h4>
              <p className="text-xs text-sage-200 leading-relaxed">
                Une urgence concernant une commande ? Notre équipe de support répond à vos mails en moins de 2 heures.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
