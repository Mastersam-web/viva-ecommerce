'use client';
import Link from 'next/link';
import { dateFr, money } from '@/lib/api';
import { ORDER_STATUS } from '@/lib/labels';
import { Loading, Msg, PageTitle, Pill, Table, aCard, useApi, useCan } from './kit';

function Bars({ data, label }: { data: { label: string; revenue: number; orders: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.revenue)); const W = 600, H = 160, bw = data.length ? W / data.length : W;
  return (
    <figure className={`${aCard} p-5`}><figcaption className="text-sm font-extrabold text-pine-900 mb-3">{label}</figcaption>
      {data.length === 0 ? <p className="text-xs text-gray-400 py-10 text-center">Pas encore de ventes encaissées.</p> : (
        <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label={label}>
          {data.map((d, i) => { const h = (d.revenue / max) * H; return <g key={d.label}><rect x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={Math.max(h, 1)} rx={3} className="fill-pine-800"><title>{`${d.label} : ${money(d.revenue)} (${d.orders} paiement(s))`}</title></rect>
            {(data.length <= 12 || i % Math.ceil(data.length / 10) === 0) && <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize="9" className="fill-gray-500">{d.label.slice(data.length > 12 ? 5 : 0)}</text>}</g>; })}
        </svg>)}
    </figure>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useApi<any>('/admin/dashboard'); const can = useCan();
  if (loading) return <Loading />; if (error) return <Msg>{error}</Msg>; if (!data) return null;
  const c = data.cards;
  const cards = [
    ["Chiffre d'affaires", money(c.revenue), 'fa-sack-dollar'], ['Commandes', c.orders, 'fa-box'], ['À traiter', c.pendingOrders, 'fa-hourglass-half'], ['Clients', c.customers, 'fa-users'],
    ['Produits actifs', c.products, 'fa-shirt'], ['Ruptures', c.outOfStock, 'fa-triangle-exclamation'], ['Stock faible', c.lowStock, 'fa-battery-quarter'], ['Paiements à vérifier', c.paymentsToVerify ?? 0, 'fa-money-check-dollar'],
  ];
  return (
    <>
      <PageTitle title="Tableau de bord" sub="Vue d'ensemble de l'activité" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([t, v, i]) => <div key={t as string} className={`${aCard} p-4 flex items-center gap-3`}><span className="w-10 h-10 rounded-xl bg-sage-100 text-pine-900 flex items-center justify-center"><i className={`fa-solid ${i}`}></i></span><div><b className="block text-lg text-pine-900">{v}</b><span className="text-[11px] text-gray-500">{t}</span></div></div>)}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {([['Aujourd\'hui', data.sales.today], ['Ce mois', data.sales.month], ['Cette année', data.sales.year]] as const).map(([t, s]) => <div key={t} className={`${aCard} p-4`}><p className="text-[11px] text-gray-500 font-bold uppercase">{t}</p><p className="text-xl font-extrabold text-pine-900">{money(s.revenue)}</p><p className="text-[11px] text-gray-500">{s.orders} paiement(s)</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4"><Bars data={data.daily} label="Revenus — 30 derniers jours" /><Bars data={data.monthly} label="Revenus — 12 derniers mois" /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2"><h2 className="text-sm font-extrabold text-pine-900">Dernières commandes</h2>
          <Table cols={[{ key: 'order_number', label: 'N°', render: (r: any) => can('orders.view', 'orders.manage') ? <Link className="font-bold text-pine-900 underline" href={`/admin/commandes/${r.id}`}>{r.order_number}</Link> : r.order_number }, { key: 'customer', label: 'Client' }, { key: 'status', label: 'Statut', render: (r: any) => <Pill map={ORDER_STATUS} v={r.status} /> }, { key: 'grand_total', label: 'Total', render: (r: any) => money(r.grand_total) }, { key: 'created_at', label: 'Date', render: (r: any) => dateFr(r.created_at) }]} rows={data.recentOrders} /></div>
        <div className="space-y-2"><h2 className="text-sm font-extrabold text-pine-900">Produits les plus vendus</h2>
          <div className={`${aCard} divide-y`}>{data.topProducts.length === 0 && <p className="p-4 text-xs text-gray-400">Aucune vente.</p>}{data.topProducts.map((p: any) => <div key={p.name} className="p-3 flex justify-between gap-2 text-xs"><span className="line-clamp-1">{p.name}</span><b>{p.qty}</b></div>)}</div>
          <h2 className="text-sm font-extrabold text-pine-900 pt-2">Commandes par statut</h2>
          <div className={`${aCard} p-3 flex flex-wrap gap-2`}>{data.byStatus.map((s: any) => <span key={s.status} className="text-xs"><Pill map={ORDER_STATUS} v={s.status} /> <b>{s.n}</b></span>)}</div></div>
      </div>
    </>
  );
}
