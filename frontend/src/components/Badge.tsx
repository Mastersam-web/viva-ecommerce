export default function Badge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const m = map[value] || { label: value, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`${m.cls} text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>{m.label}</span>;
}
