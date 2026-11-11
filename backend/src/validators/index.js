const { z } = require('zod');

const trim = (s) => z.string().trim().min(1, 'Champ requis').max(s);
const email = z.string().trim().toLowerCase().email('Email invalide').max(190);
const password = z.string().min(8, '8 caractères minimum').max(100)
  .regex(/[a-z]/, 'Doit contenir une minuscule').regex(/[A-Z]/, 'Doit contenir une majuscule').regex(/[0-9]/, 'Doit contenir un chiffre');
const phone = z.string().trim().max(40).regex(/^[0-9+()\-.\s]{6,40}$/, 'Téléphone invalide');
const id = z.coerce.number().int().positive();
const money = z.coerce.number().min(0).max(100000000);
const bool = z.union([z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1')]).transform((v) => (v === true || v === 1 || v === '1' ? 1 : 0));
const dateStr = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Date invalide');
const optStr = (max) => z.string().trim().max(max).optional().nullable().transform((v) => (v === '' ? null : v ?? null));

const address = z.object({
  label: optStr(60), full_name: trim(150), phone: phone.optional().nullable(), line1: trim(255), line2: optStr(255),
  city: trim(100), state: optStr(100), postal_code: optStr(20), country: z.string().trim().length(2).toUpperCase().default('FR'),
  is_default: bool.optional(),
});

const cartItem = z.object({ productId: id, variantId: z.coerce.number().int().min(0).default(0), quantity: z.coerce.number().int().min(1).max(999) });

module.exports.s = {
  register: z.object({ first_name: trim(100), last_name: trim(100), email, phone: phone.optional().nullable(), password }),
  login: z.object({ email, password: z.string().min(1).max(100) }),
  forgot: z.object({ email }),
  reset: z.object({ token: z.string().min(20).max(200), password }),
  profile: z.object({ first_name: trim(100), last_name: trim(100), phone: phone.optional().nullable() }),
  changePassword: z.object({ current_password: z.string().min(1), new_password: password }),
  deleteAccount: z.object({ password: z.string().min(1) }),
  address,
  cartItems: z.object({ items: z.array(cartItem).max(100) }),
  quote: z.object({ items: z.array(cartItem).min(1).max(100), couponCode: z.string().trim().max(40).optional().nullable(), shippingMethodId: z.coerce.number().int().optional().nullable(), country: z.string().trim().length(2).toUpperCase().optional() }),
  order: z.object({
    items: z.array(cartItem).min(1).max(100),
    addressId: id.optional(), address: address.optional(),
    shippingMethodId: id, paymentMethod: z.enum(['cod', 'card', 'mobile_money', 'bank_transfer']),
    couponCode: z.string().trim().max(40).optional().nullable(), notes: optStr(500), idempotencyKey: z.string().trim().max(80).optional(),
  }).refine((o) => o.addressId || o.address, { message: 'Adresse de livraison requise', path: ['address'] }),
  review: z.object({ rating: z.coerce.number().int().min(1).max(5), title: optStr(150), comment: optStr(3000) }),
  returnReq: z.object({ orderId: id, orderItemId: id, quantity: z.coerce.number().int().min(1).max(999).default(1), reason: trim(255), details: optStr(3000) }),
  ticket: z.object({ name: trim(150), email, subject: trim(255), message: trim(5000), type: z.enum(['contact', 'complaint', 'return', 'refund']).default('contact'), orderNumber: optStr(40) }),
  ticketReply: z.object({ message: trim(5000) }),
  newsletter: z.object({ email }),
  newsletterSend: z.object({ subject: trim(150), content: z.string().trim().min(10).max(20000) }),
  cardSandbox: z.object({ scenario: z.enum(['success', 'declined', 'insufficient', 'expired']), last4: z.string().regex(/^\d{0,4}$/).optional() }),
  mobileInit: z.object({ operator: trim(40), phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Numéro de téléphone invalide') }),
  mobileSandbox: z.object({ outcome: z.enum(['success', 'failure']) }),
  proof: z.object({ reference: trim(120), phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Numéro de téléphone invalide').optional(), operator: optStr(40), note: optStr(255) }),
  rejectPayment: z.object({ reason: trim(255) }),
  payMethod: z.object({ paymentMethod: z.enum(['cod', 'card', 'mobile_money', 'bank_transfer']) }),
  paymentConfig: z.object({
    cod: z.object({ enabled: z.boolean(), label: trim(60), description: optStr(300) }).partial(),
    card: z.object({ enabled: z.boolean(), label: trim(60), description: optStr(300) }).partial(),
    mobile_money: z.object({ enabled: z.boolean(), label: trim(60), description: optStr(300), operators: z.array(z.object({ code: z.string().regex(/^[a-z0-9_]{2,30}$/), name: trim(60), number: z.string().trim().max(40).default(''), account_name: z.string().trim().max(100).default(''), instructions: z.string().trim().max(500).default('') })).max(12) }).partial(),
    bank_transfer: z.object({ enabled: z.boolean(), label: trim(60), description: optStr(300), details: z.string().trim().max(1000) }).partial(),
  }).partial(),
  cancel: z.object({ reason: optStr(255) }),
  idParam: z.object({ id }),
  // admin
  product: z.object({
    sku: trim(80), name: trim(200), slug: optStr(190), short_description: optStr(500), description: optStr(20000),
    category_id: id.optional().nullable(), brand_id: id.optional().nullable(),
    price: money, sale_price: money.optional().nullable(), sale_starts_at: dateStr.optional().nullable(), sale_ends_at: dateStr.optional().nullable(),
    weight_kg: z.coerce.number().min(0).optional().nullable(), length_cm: z.coerce.number().min(0).optional().nullable(),
    width_cm: z.coerce.number().min(0).optional().nullable(), height_cm: z.coerce.number().min(0).optional().nullable(),
    specs: z.union([z.record(z.string()), z.string()]).optional().nullable(),
    status: z.enum(['active', 'draft', 'archived']).default('active'), is_featured: bool.optional(),
    quantity: z.coerce.number().int().min(0).optional(), low_stock_threshold: z.coerce.number().int().min(0).optional(),
    images: z.array(z.object({ url: z.string().max(500), alt: optStr(255), is_primary: bool.optional() })).max(12).optional(),
    variants: z.array(z.object({ id: id.optional(), sku: trim(80), name: trim(150), attributes: z.record(z.string()).optional().nullable(), price_override: money.optional().nullable(), is_active: bool.optional(), quantity: z.coerce.number().int().min(0).optional() })).max(60).optional(),
  }),
  category: z.object({ name: trim(150), slug: optStr(120), parent_id: id.optional().nullable(), icon: optStr(60), description: optStr(2000), sort_order: z.coerce.number().int().default(0), is_active: bool.optional() }),
  brand: z.object({ name: trim(150), slug: optStr(120), is_active: bool.optional() }),
  supplier: z.object({ name: trim(190), contact_name: optStr(150), email: email.optional().nullable().or(z.literal('').transform(() => null)), phone: optStr(40), address: optStr(255), notes: optStr(3000), is_active: bool.optional() }),
  coupon: z.object({
    code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/, 'Lettres, chiffres, - et _ uniquement'), description: optStr(255),
    type: z.enum(['percent', 'fixed']), value: z.coerce.number().positive(), min_order: money.default(0), max_discount: money.optional().nullable(),
    starts_at: dateStr.optional().nullable(), ends_at: dateStr.optional().nullable(), usage_limit: z.coerce.number().int().min(1).optional().nullable(),
    per_user_limit: z.coerce.number().int().min(1).optional().nullable(), applies_to: z.enum(['all', 'products', 'categories']).default('all'),
    targets: z.array(id).optional(), is_active: bool.optional(),
  }).refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'Un pourcentage ne peut dépasser 100', path: ['value'] }),
  zone: z.object({ name: trim(120), countries: trim(1000), is_active: bool.optional() }),
  method: z.object({ zone_id: id, code: trim(40), name: trim(120), fee: money, free_over: money.optional().nullable(), min_days: z.coerce.number().int().min(0).default(2), max_days: z.coerce.number().int().min(0).default(5), is_active: bool.optional() }),
  user: z.object({ first_name: trim(100), last_name: trim(100), email, phone: phone.optional().nullable(), password: password.optional(), is_active: bool.optional(), roles: z.array(id).optional() }),
  role: z.object({ code: z.string().trim().toLowerCase().regex(/^[a-z_]{2,40}$/), name: trim(100), description: optStr(255), permissions: z.array(id).default([]) }),
  post: z.object({ title: trim(255), slug: optStr(190), excerpt: optStr(500), content: optStr(100000), cover_url: optStr(500), status: z.enum(['draft', 'published']).default('draft') }),
  stockMove: z.object({ productId: id, variantId: z.coerce.number().int().min(0).default(0), type: z.enum(['in', 'out']), quantity: z.coerce.number().int().min(1).max(1000000), note: optStr(255) }),
  stockCount: z.object({ productId: id, variantId: z.coerce.number().int().min(0).default(0), counted: z.coerce.number().int().min(0), note: optStr(255) }),
  purchaseOrder: z.object({ supplier_id: id, expected_at: dateStr.optional().nullable(), notes: optStr(2000), items: z.array(z.object({ productId: id, variantId: z.coerce.number().int().min(0).default(0), quantity: z.coerce.number().int().min(1), unit_cost: money })).min(1) }),
  receivePO: z.object({ items: z.array(z.object({ itemId: id, quantity: z.coerce.number().int().min(1) })).min(1) }),
  status: z.object({ status: z.string().min(2).max(30), note: optStr(255) }),
  shipmentUpdate: z.object({ status: z.enum(['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'failed', 'returned']), note: optStr(255), location: optStr(150), failure_reason: optStr(255) }),
  assignCourier: z.object({ courier_id: id.nullable() }),
  refund: z.object({ paymentId: id, amount: money.optional(), reason: optStr(255) }),
  returnDecision: z.object({ status: z.enum(['approved', 'rejected', 'received', 'refunded', 'closed']), admin_note: optStr(500), restock: bool.optional(), refund_amount: money.optional() }),
  reviewModeration: z.object({ status: z.enum(['published', 'hidden']) }),
  ticketUpdate: z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), message: optStr(5000) }),
  contentPut: z.object({ value: z.string().max(200000) }),
  settingsPut: z.record(z.string().max(5000)),
};
