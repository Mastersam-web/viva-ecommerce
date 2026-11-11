import type { ReactNode } from 'react';

/** Éléments d'interface réutilisés (mêmes classes que le design d'origine). */
export const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pine-900';
export const btnPrimary = 'bg-pine-900 hover:bg-pine-800 text-white font-bold py-3 px-8 rounded-full transition text-sm shadow-md disabled:opacity-60 disabled:cursor-not-allowed';
export const btnSecondary = 'bg-sage-100 hover:bg-sage-200 text-pine-900 font-bold py-2.5 px-6 rounded-full transition text-sm disabled:opacity-60';
export const card = 'bg-white rounded-3xl border border-gray-100 shadow-sm';

export function PageHeader({ badge, title, text }: { badge: string; title: string; text?: string }) {
  return (
    <div className="relative rounded-3xl p-8 sm:p-12 mb-8 overflow-hidden border border-pine-900/10 shadow-lg bg-pine-900">
      <div className="absolute inset-0 bg-gradient-to-r from-pine-950/90 via-pine-900/80 to-pine-800/60"></div>
      <div className="relative z-10 space-y-3 max-w-xl text-white">
        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-widest backdrop-blur-md">{badge}</span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{title}</h1>
        {text && <p className="text-sage-200 text-xs sm:text-sm font-medium leading-relaxed">{text}</p>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'bg-red-50 border-red-100 text-red-700', success: 'bg-emerald-50 border-emerald-100 text-emerald-800', info: 'bg-sage-100 border-sage-200 text-pine-900' }[kind];
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`${c} border rounded-2xl px-4 py-3 text-xs font-semibold`}>{children}</div>;
}

export function Spinner() {
  return <div className="flex justify-center py-12"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-pine-900"></i></div>;
}

export function Shell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="page-content relative bg-gradient-to-b from-sage-50/50 via-white to-gray-50 min-h-[60vh]">
      <section className={`${narrow ? 'max-w-md' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10`}>{children}</section>
    </div>
  );
}
