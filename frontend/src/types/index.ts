export interface Product {
  id: number; slug: string; sku: string; name: string; shortDescription?: string;
  category: string; categoryName?: string; brand?: string; brandSlug?: string;
  price: number; oldPrice: number | null; badge: string | null; rating: number; reviews: number;
  image: string | null; stock: number; inStock: boolean; hasVariants?: boolean; featured?: boolean; isNew?: boolean;
}
export interface CartItem { id: number; variantId: number; slug: string; name: string; variantName?: string | null; price: number; image: string; qty: number }
export interface User {
  id: number; first_name: string; last_name: string; email: string; phone: string | null;
  email_verified: boolean; roles: string[]; permissions: string[]; isStaff: boolean; isAdmin: boolean;
}
export interface Category { id: number; slug: string; name: string; icon: string | null; parent_id: number | null; product_count: number }
