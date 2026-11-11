import { PageHeader, card, Shell } from './ui';
import { getContent } from '@/lib/cms';

export default async function ContentPage({ name, badge, title, fallback }: { name: string; badge: string; title: string; fallback?: string }) {
  const html = (await getContent(name)) || fallback || '<p>Contenu à venir.</p>';
  return (
    <Shell>
      <PageHeader badge={badge} title={title} />
      <div className={`${card} p-6 sm:p-10 max-w-4xl`}><div className="prose-viva" dangerouslySetInnerHTML={{ __html: html }} /></div>
    </Shell>
  );
}
