'use client';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useStore } from '@/context/StoreContext';

export const aInput = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pine-900';
export const aBtn = 'bg-pine-900 hover:bg-pine-800 text-white font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-60';
export const aBtn2 = 'bg-white border border-gray-200 hover:bg-sage-100 text-pine-900 font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-60';
export const aDanger = 'bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-60';
export const aCard = 'bg-white rounded-2xl border border-gray-100 shadow-sm';

export function useCan() {
  const { user } = useStore();
  return (...perms: string[]) => !!user && (user.isAdmin || perms.length === 0 || perms.some((p) => user.permissions.includes(p)));
}

/** Chargement d'une ressource ; `path` null = pas de requête. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return; let off = false; setLoading(true); setError('');
    api.get(path).then((d) => { if (!off) setData(d); }).catch((e) => { if (!off) setError(e.message); }).finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [path, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function Msg({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'bg-red-50 border-red-100 text-red-700', success: 'bg-emerald-50 border-emerald-100 text-emerald-800', info: 'bg-sage-100 border-sage-200 text-pine-900' }[kind];
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`${c} border rounded-xl px-4 py-2.5 text-xs font-semibold`}>{children}</div>;
}
export const Loading = () => <div className="flex justify-center py-10"><i className="fa-solid fa-circle-notch fa-spin text-xl text-pine-900"></i></div>;

export function Pill({ map, v }: { map?: Record<string, { label: string; cls: string }>; v: string }) {
  const m = map?.[v] || { label: v, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`${m.cls} text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap`}>{m.label}</span>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-extrabold text-pine-900">{title}</h2><button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-700"><i className="fa-solid fa-xmark"></i></button></div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Pager({ meta, onPage }: { meta?: { page: number; pages: number; total: number }; onPage: (p: number) => void }) {
  if (!meta) return null;
  return (
    <div className="flex items-center justify-between text-xs text-gray-500 pt-3">
      <span>{meta.total} résultat(s)</span>
      {meta.pages > 1 && <div className="flex items-center gap-2">
        <button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} className={aBtn2}>Précédent</button>
        <span>Page {meta.page} / {meta.pages}</span>
        <button disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} className={aBtn2}>Suivant</button>
      </div>}
    </div>
  );
}

export interface Col<T = any> { key: string; label: string; render?: (row: T) => ReactNode; cls?: string }
export function Table<T = any>({ cols, rows, empty = 'Aucun résultat.', rowKey = 'id' }: { cols: Col<T>[]; rows: T[]; empty?: string; rowKey?: string }) {
  return (
    <div className={`${aCard} overflow-x-auto`}>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-gray-500 border-b bg-gray-50/60">{cols.map((c) => <th key={c.key} className={`px-4 py-3 font-bold whitespace-nowrap ${c.cls || ''}`}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-gray-400">{empty}</td></tr>}
          {rows.map((r: any, i) => <tr key={r[rowKey] ?? i} className="hover:bg-sage-50/50">{cols.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.cls || ''}`}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function PageTitle({ title, children, sub }: { title: string; sub?: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-pine-900">{title}</h1>{sub && <p className="text-xs text-gray-500">{sub}</p>}</div><div className="flex flex-wrap gap-2">{children}</div></div>;
}

export interface FilterDef { key: string; label: string; type?: 'select' | 'text' | 'date'; options?: [string, string][] }
/** Liste paginée avec recherche / filtres. */
export function useListState(initial: Record<string, any> = {}) {
  const [f, setF] = useState<Record<string, any>>({ page: 1, ...initial });
  const [debounced, setDebounced] = useState(f);
  const t = useRef<any>();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(() => setDebounced(f), 300); return () => clearTimeout(t.current); }, [f]);
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, ...(k !== 'page' ? { page: 1 } : {}) }));
  return { f, set, query: qs(debounced) };
}
export function Filters({ defs, f, set }: { defs: FilterDef[]; f: Record<string, any>; set: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {defs.map((d) => d.type === 'select'
        ? <select key={d.key} aria-label={d.label} value={f[d.key] || ''} onChange={(e) => set(d.key, e.target.value)} className={`${aInput} !w-auto`}><option value="">{d.label}</option>{d.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : <input key={d.key} aria-label={d.label} type={d.type === 'date' ? 'date' : 'search'} placeholder={d.label} value={f[d.key] || ''} onChange={(e) => set(d.key, e.target.value)} className={`${aInput} !w-auto min-w-[200px]`} title={d.label} />)}
    </div>
  );
}

/** Page liste générique : filtre + tableau + pagination. */
export function ListView<T = any>({ path, listKey, cols, filters = [], initial, extra, empty }: { path: string; listKey: string; cols: Col<T>[] | ((reload: () => void) => Col<T>[]); filters?: FilterDef[]; initial?: Record<string, any>; extra?: ReactNode | ((reload: () => void) => ReactNode); empty?: string }) {
  const { f, set, query } = useListState(initial);
  const { data, loading, error, reload } = useApi<any>(`${path}${query}`);
  const columns = typeof cols === 'function' ? cols(reload) : cols;
  return (
    <div className="space-y-4">
      {filters.length > 0 && <Filters defs={filters} f={f} set={set} />}
      {typeof extra === 'function' ? extra(reload) : extra}
      {error && <Msg>{error}</Msg>}
      {loading && !data ? <Loading /> : <Table cols={columns} rows={data?.[listKey] || []} empty={empty} />}
      <Pager meta={data?.meta} onPage={(p) => set('page', p)} />
    </div>
  );
}

/* ------------------------------------------------------------------ Formulaires */
export interface FieldDef {
  name: string; label: string; type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'password' | 'email' | 'datetime-local' | 'checks';
  options?: [string | number, string][]; required?: boolean; hint?: string; step?: string; half?: boolean; rows?: number; min?: number; max?: number;
}
export function FormFields({ fields, v, set }: { fields: FieldDef[]; v: Record<string, any>; set: (k: string, val: any) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {fields.map((f) => {
        const val = v[f.name] ?? (f.type === 'checks' ? [] : '');
        const wrap = (child: ReactNode) => <div key={f.name} className={`space-y-1 ${f.half ? '' : f.type === 'checkbox' ? '' : 'sm:col-span-2'}`}>{f.type !== 'checkbox' && <label className="text-xs font-bold text-gray-700">{f.label}{f.required && ' *'}</label>}{child}{f.hint && <p className="text-[11px] text-gray-400">{f.hint}</p>}</div>;
        if (f.type === 'checkbox') return <label key={f.name} className="flex items-center gap-2 text-xs font-bold sm:col-span-2"><input type="checkbox" className="accent-pine-900" checked={!!Number(val) || val === true} onChange={(e) => set(f.name, e.target.checked ? 1 : 0)} />{f.label}</label>;
        if (f.type === 'textarea') return wrap(<textarea rows={f.rows || 3} required={f.required} value={val} onChange={(e) => set(f.name, e.target.value)} className={aInput} />);
        if (f.type === 'select') return wrap(<select required={f.required} value={val} onChange={(e) => set(f.name, e.target.value)} className={aInput}><option value="">—</option>{f.options!.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>);
        if (f.type === 'checks') return wrap(<div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto border rounded-lg p-3">{f.options!.map(([o, l]) => <label key={o} className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-pine-900" checked={(val as any[]).includes(o)} onChange={(e) => set(f.name, e.target.checked ? [...val, o] : (val as any[]).filter((x) => x !== o))} />{l}</label>)}</div>);
        return wrap(<input type={f.type || 'text'} step={f.step} min={f.min} max={f.max} required={f.required} value={val ?? ''} onChange={(e) => set(f.name, e.target.value)} className={aInput} autoComplete={f.type === 'password' ? 'new-password' : undefined} />);
      })}
    </div>
  );
}

export function FormModal({ title, fields: fieldsProp, initial, onSubmit, onClose, submitLabel = 'Enregistrer', children }: { title: string; fields: FieldDef[] | ((v: Record<string, any>) => FieldDef[]); initial: Record<string, any>; onSubmit: (v: Record<string, any>) => Promise<any>; onClose: () => void; submitLabel?: string; children?: ReactNode }) {
  const [v, setV] = useState(initial); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string, val: any) => setV((x) => ({ ...x, [k]: val }));
  const fields = typeof fieldsProp === 'function' ? fieldsProp(v) : fieldsProp;
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await onSubmit(v); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <Msg>{err}</Msg>}
        <FormFields fields={fields} v={v} set={set} />{children}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className={aBtn2}>Annuler</button><button disabled={busy} className={aBtn}>{busy ? '…' : submitLabel}</button></div>
      </form>
    </Modal>
  );
}

/** Nettoie un objet de formulaire : '' → null, nombres, booléens. */
export const clean = (o: Record<string, any>, numeric: string[] = [], keep: string[] = []) => {
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(o)) {
    if (val === '' || val === undefined) { out[k] = null; continue; }
    out[k] = numeric.includes(k) ? Number(val) : val;
  }
  keep.forEach((k) => { if (out[k] === null) delete out[k]; });
  return out;
};
export const toLocalInput = (d?: string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function useToast() { return useStore().showToast; }
export function useConfirm() { return (msg: string) => typeof window !== 'undefined' && window.confirm(msg); }
