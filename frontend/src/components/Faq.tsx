'use client';
import { useState } from 'react';

export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3 max-w-3xl">
      {items.map((it, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 text-sm font-bold text-pine-900">
            {it.q}<i className={`fa-solid fa-chevron-down text-xs transition-transform ${open === i ? 'rotate-180' : ''}`}></i>
          </button>
          {open === i && <p className="px-5 pb-5 text-xs sm:text-sm text-gray-600 leading-relaxed font-medium">{it.a}</p>}
        </div>
      ))}
    </div>
  );
}
