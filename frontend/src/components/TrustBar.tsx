'use client';
import { useStore } from '@/context/StoreContext';

export default function TrustBar() {
  const { settings } = useStore();
  const threshold = Number(settings['store.free_shipping_threshold'] ?? 49);
  const days = settings['store.return_days'] ?? '30';
  const items = [
    { icon: 'fa-truck', title: 'Free Shipping', text: `Dès ${threshold}$ d'achat` },
    { icon: 'fa-rotate-left', title: 'Easy Returns', text: `Garantie ${days} jours` },
    { icon: 'fa-shield-halved', title: 'Secure Payments', text: 'Crypteur SSL 100%' },
    { icon: 'fa-headset', title: '24/7 Support', text: 'Service client dédié' },
  ];
  return (
    <section className="border-y border-gray-200/80 bg-white py-8 my-6 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
          {items.map((it) => (
            <div key={it.title} className="flex flex-col md:flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-pine-900 text-lg">
                <i className={`fa-solid ${it.icon}`}></i>
              </div>
              <div>
                <h5 className="text-xs font-bold text-gray-900">{it.title}</h5>
                <p className="text-[11px] text-gray-500">{it.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
