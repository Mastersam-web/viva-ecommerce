'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/context/StoreContext';
import { money } from '@/lib/api';

export default function ProductView({ product }: { product: any }) {
  const { addToCart, isWished, toggleWishlist, showToast } = useStore();
  const router = useRouter();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const variants: any[] = product.variants || [];
  const [variantId, setVariantId] = useState<number>(variants.find((v) => v.stock > 0)?.id || 0);
  const variant = useMemo(() => variants.find((v) => v.id === variantId), [variants, variantId]);
  const price = variant ? Number(variant.price) : product.price;
  const stock = variants.length ? (variant?.stock ?? 0) : product.stock;
  const images: { url: string; alt?: string }[] = product.images?.length ? product.images : [{ url: product.image || '', alt: product.name }];
  const wished = isWished(product.id);

  const add = (goCheckout = false) => {
    if (variants.length && !variant) return showToast('Veuillez choisir une option');
    if (stock <= 0) return showToast('Ce produit est en rupture de stock');
    const q = Math.min(qty, stock);
    addToCart({ id: product.id, slug: product.slug, name: product.name, price, image: images[0]?.url || null, variantId: variant?.id || 0, variantName: variant?.name || null }, q);
    if (goCheckout) router.push('/commande');
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Galerie */}
      <div className="space-y-3">
        <div className="relative aspect-square rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm">
          {product.badge && product.inStock && <span className="absolute top-4 left-4 bg-accent-coral text-white text-xs font-bold px-3 py-1 rounded-full z-10">{product.badge}</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[img]?.url} alt={images[img]?.alt || product.name} className="w-full h-full object-cover" />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {images.map((im, i) => (
              <button key={i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 ${i === img ? 'border-pine-900' : 'border-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="space-y-5">
        <div className="space-y-2">
          {product.brand && <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">{product.brand}</p>}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-pine-900 tracking-tight">{product.name}</h1>
          <div className="flex items-center text-amber-400 text-sm gap-0.5">
            {Array.from({ length: 5 }, (_, i) => <i key={i} className={`fa-solid fa-star${i < Math.round(product.rating) ? '' : ' text-gray-200'}`}></i>)}
            <span className="text-gray-500 text-xs ml-2 font-medium">{product.rating.toFixed(1)} ({product.reviews} avis)</span>
          </div>
          <p className="text-[11px] text-gray-400">Réf. {variant?.sku || product.sku}</p>
        </div>

        <div className="flex items-end gap-3">
          <span className="text-3xl font-extrabold text-pine-900">{money(price)}</span>
          {!variant && product.oldPrice && <span className="text-base text-gray-400 line-through mb-0.5">{money(product.oldPrice)}</span>}
        </div>

        {product.shortDescription && <p className="text-sm text-gray-600 leading-relaxed font-medium">{product.shortDescription}</p>}

        {variants.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-700">Option</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button key={v.id} disabled={v.stock <= 0} onClick={() => { setVariantId(v.id); setQty(1); }}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition ${v.id === variantId ? 'bg-pine-900 text-white border-pine-900' : 'bg-white text-gray-700 border-gray-200 hover:border-pine-900'} ${v.stock <= 0 ? 'opacity-40 line-through cursor-not-allowed' : ''}`}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={`text-xs font-bold flex items-center gap-1.5 ${stock > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          <i className={`fa-solid ${stock > 0 ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
          {stock > 5 ? 'En stock' : stock > 0 ? `Plus que ${stock} en stock` : 'Rupture de stock'}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center bg-gray-100 rounded-full">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer" className="w-10 h-10 font-bold text-gray-700">-</button>
            <span className="w-8 text-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(Math.max(stock, 1), q + 1))} aria-label="Augmenter" className="w-10 h-10 font-bold text-gray-700">+</button>
          </div>
          <button onClick={() => add(false)} disabled={stock <= 0} className="flex-1 min-w-[160px] bg-pine-900 hover:bg-pine-800 disabled:opacity-40 text-white font-extrabold px-8 py-3 rounded-full transition shadow-lg text-sm">
            <i className="fa-solid fa-bag-shopping mr-2"></i>Ajouter au panier
          </button>
          <button onClick={() => toggleWishlist({ id: product.id, slug: product.slug, name: product.name, price: product.price, image: images[0]?.url || null })} aria-label="Favoris"
            className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-accent-coral transition">
            <i className={`${wished ? 'fa-solid text-accent-coral' : 'fa-regular'} fa-heart`}></i>
          </button>
        </div>
        <button onClick={() => add(true)} disabled={stock <= 0} className="w-full bg-sage-100 hover:bg-sage-200 disabled:opacity-40 text-pine-900 font-extrabold px-8 py-3 rounded-full transition text-sm">Acheter maintenant</button>

        <ul className="grid grid-cols-3 gap-3 pt-3 text-[11px] font-bold text-pine-900 border-t border-gray-100">
          <li className="flex items-center gap-2"><i className="fa-solid fa-truck"></i> Livraison rapide</li>
          <li className="flex items-center gap-2"><i className="fa-solid fa-rotate-left"></i> Retours faciles</li>
          <li className="flex items-center gap-2"><i className="fa-solid fa-shield-halved"></i> Paiement sécurisé</li>
        </ul>
      </div>
    </div>
  );
}
