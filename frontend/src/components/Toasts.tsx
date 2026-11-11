'use client';
import { useStore } from '@/context/StoreContext';

export default function Toasts() {
  const { toasts } = useStore();
  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} role="status" className={`fixed bottom-5 right-5 bg-pine-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 transform transition-all duration-300 ${t.visible ? '' : 'translate-y-10 opacity-0'}`}>
          <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i> {t.message}
        </div>
      ))}
    </>
  );
}
