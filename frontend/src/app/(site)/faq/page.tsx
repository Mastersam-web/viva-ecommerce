import type { Metadata } from 'next';
import Link from 'next/link';
import Faq from '@/components/Faq';
import { PageHeader, Shell } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'FAQ - Aide', description: 'Réponses aux questions fréquentes : commandes, livraison, paiement et retours.', alternates: { canonical: '/faq' } };
export const revalidate = 30;

export default async function FaqPage() {
  let items: { q: string; a: string }[] = [];
  try { items = JSON.parse((await getContent('faq')) || '[]'); } catch { /* contenu invalide */ }
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) };
  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader badge="Aide" title="Questions fréquentes" text="Une question ? Retrouvez ici nos réponses." />
      <Faq items={items} />
      <p className="mt-8 text-sm text-gray-600">Vous ne trouvez pas votre réponse ? <Link href="/contact" className="font-bold text-pine-900 hover:underline">Contactez-nous</Link>.</p>
    </Shell>
  );
}
