import Link from 'next/link';
import { qs } from '@/lib/api';

export default function Pagination({ base, params, page, pages }: { base: string; params: Record<string, any>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const link = (p: number) => `${base}${qs({ ...params, page: p > 1 ? p : undefined })}`;
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  const btn = 'min-w-[36px] h-9 px-3 rounded-full text-xs font-bold flex items-center justify-center transition';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
      {page > 1 && <Link href={link(page - 1)} className={`${btn} bg-white border border-gray-200 hover:bg-sage-200`} aria-label="Page précédente"><i className="fa-solid fa-chevron-left text-[10px]"></i></Link>}
      {nums.map((n, i) => n === '…' ? <span key={`e${i}`} className="text-gray-400">…</span>
        : <Link key={n} href={link(n)} aria-current={n === page ? 'page' : undefined} className={`${btn} ${n === page ? 'bg-pine-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-sage-200'}`}>{n}</Link>)}
      {page < pages && <Link href={link(page + 1)} className={`${btn} bg-white border border-gray-200 hover:bg-sage-200`} aria-label="Page suivante"><i className="fa-solid fa-chevron-right text-[10px]"></i></Link>}
    </nav>
  );
}
