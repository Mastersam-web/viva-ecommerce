import { dateFr } from '@/lib/api';
import { SHIPMENT_STATUS, ORDER_STATUS } from '@/lib/labels';

export default function Timeline({ events }: { events: { status: string; note?: string | null; location?: string | null; created_at: string }[] }) {
  if (!events?.length) return <p className="text-xs text-gray-500">Aucun événement de suivi pour le moment.</p>;
  const list = [...events].reverse();
  return (
    <ol className="relative border-l-2 border-sage-200 ml-2 space-y-4">
      {list.map((e, i) => (
        <li key={i} className="pl-5 relative">
          <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${i === 0 ? 'bg-pine-900 ring-4 ring-sage-100' : 'bg-sage-300'}`}></span>
          <p className="text-xs font-bold text-gray-900">{SHIPMENT_STATUS[e.status] || ORDER_STATUS[e.status]?.label || e.status}</p>
          {(e.note || e.location) && <p className="text-xs text-gray-600">{[e.note, e.location].filter(Boolean).join(' - ')}</p>}
          <p className="text-[11px] text-gray-400">{dateFr(e.created_at, true)}</p>
        </li>
      ))}
    </ol>
  );
}
