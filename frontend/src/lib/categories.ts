/** Libellés/icônes de l'original (clé = slug). Les libellés viennent de la base ; ceci sert de repli et d'ordre d'affichage. */
export const CATEGORY_TABS: { slug: string; label: string; icon: string }[] = [
  { slug: 'electronics', label: 'Électronique', icon: 'fa-tv' },
  { slug: 'fashion', label: 'Mode', icon: 'fa-shirt' },
  { slug: 'home', label: 'Maison', icon: 'fa-house' },
  { slug: 'beauty', label: 'Beauté', icon: 'fa-pump-soap' },
  { slug: 'sports', label: 'Sports', icon: 'fa-basketball' },
  { slug: 'toys', label: 'Jouets', icon: 'fa-child-reaching' },
];

/** Libellés courts de l'original selon l'endroit (repli : nom de la catégorie en base). */
const CIRCLE: Record<string, string> = { electronics: 'Électronique', fashion: 'Mode', home: 'Maison & Déco', beauty: 'Beauté', sports: 'Sports', toys: 'Jouets' };
const TAB: Record<string, string> = { electronics: 'Électronique', fashion: 'Mode', home: 'Maison', beauty: 'Beauté', sports: 'Sports', toys: 'Jouets' };
export const circleLabel = (slug: string, name: string) => CIRCLE[slug] || name;
export const tabLabel = (slug: string, name: string) => TAB[slug] || name;
export const catIcon = (icon?: string | null) => `fa-${icon || 'tag'}`;
