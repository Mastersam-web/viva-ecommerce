const express = require('express');
const { asyncHandler } = require('../utils/http');
const { validate } = require('../middlewares/validate');
const { s } = require('../validators');
const { authenticate, optionalAuth, requirePermission, requireStaff } = require('../middlewares/auth');
const { authLimiter, strictLimiter } = require('../middlewares/security');
const { imageUpload } = require('../middlewares/upload');
const auth = require('../controllers/auth');
const catalog = require('../controllers/catalog');
const cust = require('../controllers/customer');
const aCat = require('../controllers/admin/catalog');
const aSales = require('../controllers/admin/sales');
const aInv = require('../controllers/admin/inventory');
const aSys = require('../controllers/admin/system');
const payments = require('../services/payments');
const { ok, ApiError } = require('../utils/http');

const h = asyncHandler;
const wrap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'function' ? h(v) : v]));
const A = wrap(auth); const C = wrap(catalog); const U = wrap(cust);
const AC = wrap(aCat); const AS = wrap(aSales); const AI = wrap(aInv); const AY = wrap(aSys);
const idp = validate({ params: s.idParam });

const router = express.Router();

/* ============================== Public ============================== */
router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
router.get('/settings', C.settings);
router.get('/categories', C.categories);
router.get('/brands', C.brands);
router.get('/products', C.listProducts);
router.get('/products/:slug', C.getProduct);
router.get('/products/:id/reviews', C.productReviews);
router.get('/content/:name', C.content);
router.get('/posts', C.posts);
router.get('/posts/:slug', C.post);
router.get('/shipping/methods', C.shippingMethods);
router.post('/newsletter', authLimiter, validate({ body: s.newsletter }), C.subscribe);
router.get('/newsletter/unsubscribe', strictLimiter, C.unsubscribe);
router.post('/support/tickets', strictLimiter, optionalAuth, validate({ body: s.ticket }), C.createTicket);
router.post('/cart/quote', authenticate, validate({ body: s.quote }), U.quote);
router.get('/orders/track', strictLimiter, U.trackPublic);

/* ============================== Auth ============================== */
router.post('/auth/register', authLimiter, validate({ body: s.register }), A.register);
router.post('/auth/login', authLimiter, validate({ body: s.login }), A.login);
router.post('/auth/logout', A.logout);
router.get('/auth/me', authenticate, A.me);
router.post('/auth/forgot-password', strictLimiter, validate({ body: s.forgot }), A.forgotPassword);
router.post('/auth/reset-password', authLimiter, validate({ body: s.reset }), A.resetPassword);
router.post('/auth/verify-email', authLimiter, A.verifyEmail);
router.post('/auth/resend-verification', strictLimiter, authenticate, A.resendVerification);
router.put('/account/profile', authenticate, validate({ body: s.profile }), A.updateProfile);
router.put('/account/password', authenticate, authLimiter, validate({ body: s.changePassword }), A.changePassword);
router.post('/account/delete', authenticate, authLimiter, validate({ body: s.deleteAccount }), A.deleteAccount);

/* ============================== Client ============================== */
router.get('/cart', authenticate, U.getCart);
router.put('/cart', authenticate, validate({ body: s.cartItems }), U.putCart);
router.get('/account/addresses', authenticate, U.listAddresses);
router.post('/account/addresses', authenticate, validate({ body: s.address }), U.createAddress);
router.put('/account/addresses/:id', authenticate, validate({ params: s.idParam, body: s.address }), U.updateAddress);
router.delete('/account/addresses/:id', authenticate, idp, U.deleteAddress);

router.post('/orders', authenticate, validate({ body: s.order }), U.createOrder);
router.get('/orders', authenticate, U.listOrders);
router.get('/orders/:id', authenticate, idp, U.getOrder);
router.post('/orders/:id/cancel-request', authenticate, strictLimiter, validate({ params: s.idParam, body: s.cancel }), U.requestCancel);
router.post('/orders/:id/pay', authenticate, idp, validate({ body: s.payMethod }), U.retryPayment);
router.get('/orders/:id/payment', authenticate, idp, U.paymentContext);
router.post('/orders/:id/payment/card', authenticate, authLimiter, validate({ params: s.idParam, body: s.cardSandbox }), U.payCard);
router.post('/orders/:id/payment/stripe', authenticate, authLimiter, idp, U.payStripe);
router.post('/orders/:id/payment/mobile', authenticate, authLimiter, validate({ params: s.idParam, body: s.mobileInit }), U.payMobile);
router.post('/orders/:id/payment/mobile/sandbox', authenticate, authLimiter, validate({ params: s.idParam, body: s.mobileSandbox }), U.payMobileSandbox);
router.post('/orders/:id/payment/proof', authenticate, authLimiter, validate({ params: s.idParam, body: s.proof }), U.payProof);
router.get('/orders/:id/tracking', authenticate, idp, U.tracking);
router.get('/orders/:id/invoice.pdf', authenticate, idp, U.invoicePdf);
router.get('/orders/:id/receipt.pdf', authenticate, idp, U.receiptPdf);
router.get('/account/invoices', authenticate, U.listInvoices);

router.get('/wishlist', authenticate, U.getWishlist);
router.get('/wishlist/ids', authenticate, U.wishlistIds);
router.post('/wishlist/:id', authenticate, idp, U.addWishlist);
router.delete('/wishlist/:id', authenticate, idp, U.removeWishlist);

router.post('/products/:id/reviews', authenticate, validate({ params: s.idParam, body: s.review }), U.upsertReview);
router.delete('/products/:id/reviews', authenticate, idp, U.deleteReview);
router.get('/account/reviews', authenticate, U.myReviews);

router.post('/returns', authenticate, validate({ body: s.returnReq }), U.createReturn);
router.get('/returns', authenticate, U.myReturns);

router.get('/notifications', authenticate, U.notifications);
router.get('/notifications/unread-count', authenticate, U.unreadCount);
router.post('/notifications/read-all', authenticate, U.readAllNotifications);
router.post('/notifications/:id/read', authenticate, idp, U.readNotification);

router.get('/support/tickets', authenticate, U.myTickets);
router.get('/support/tickets/:id', authenticate, idp, U.myTicket);
router.post('/support/tickets/:id/reply', authenticate, validate({ params: s.idParam, body: s.ticketReply }), U.replyTicket);

/* ============================== Paiements ============================== */
// (webhooks signés : montés dans app.js avec le corps brut)

/* ============================== Administration ============================== */
const admin = express.Router();
admin.use(authenticate, requireStaff);
const P = requirePermission;
admin.get('/dashboard', P('dashboard.view'), AY.dashboard);

admin.post('/upload', P('products.manage', 'content.manage'), imageUpload.array('files', 8), AC.upload);
admin.get('/products', P('products.manage', 'stock.view', 'orders.view'), AC.listProducts);
admin.post('/products', P('products.manage'), validate({ body: s.product }), AC.createProduct);
admin.get('/products/:id', P('products.manage', 'stock.view'), idp, AC.getProduct);
admin.put('/products/:id', P('products.manage'), validate({ params: s.idParam, body: s.product }), AC.updateProduct);
admin.patch('/products/:id/status', P('products.manage'), idp, AC.setProductStatus);
admin.delete('/products/:id', P('products.manage'), idp, AC.deleteProduct);
admin.get('/categories', P('categories.manage', 'products.manage'), AC.listCategories);
admin.post('/categories', P('categories.manage'), validate({ body: s.category }), AC.saveCategory);
admin.put('/categories/:id', P('categories.manage'), validate({ params: s.idParam, body: s.category }), AC.saveCategory);
admin.delete('/categories/:id', P('categories.manage'), idp, AC.deleteCategory);
admin.get('/brands', P('categories.manage', 'products.manage'), AC.listBrands);
admin.post('/brands', P('categories.manage'), validate({ body: s.brand }), AC.saveBrand);
admin.put('/brands/:id', P('categories.manage'), validate({ params: s.idParam, body: s.brand }), AC.saveBrand);
admin.delete('/brands/:id', P('categories.manage'), idp, AC.deleteBrand);

admin.get('/orders', P('orders.view', 'orders.manage'), AS.listOrders);
admin.get('/orders/:id', P('orders.view', 'orders.manage'), idp, AS.getOrder);
admin.patch('/orders/:id/status', P('orders.manage'), validate({ params: s.idParam, body: s.status }), AS.setOrderStatus);
admin.get('/orders/:id/invoice.pdf', P('orders.view', 'orders.manage', 'payments.view'), idp, h(AS.orderDocument('invoice')));
admin.get('/orders/:id/slip.pdf', P('orders.view', 'orders.manage'), idp, h(AS.orderDocument('slip')));
admin.get('/orders/:id/receipt.pdf', P('orders.view', 'payments.view'), idp, h(AS.orderDocument('receipt')));

admin.get('/payments', P('payments.view', 'payments.manage'), AS.listPayments);
admin.get('/payments/transactions', P('payments.view', 'payments.manage'), AS.allTransactions);
admin.get('/payments/:id/transactions', P('payments.view', 'payments.manage'), idp, AS.paymentTransactions);
admin.post('/payments/:id/confirm', P('payments.manage'), idp, AS.confirmPayment);
admin.post('/payments/:id/reject', P('payments.manage'), validate({ params: s.idParam, body: s.rejectPayment }), AS.rejectPayment);
admin.get('/payment-config', P('payments.manage', 'settings.manage'), AS.getPaymentConfig);
admin.put('/payment-config', P('payments.manage', 'settings.manage'), validate({ body: s.paymentConfig }), AS.savePaymentConfig);
admin.post('/refunds', P('payments.manage'), validate({ body: s.refund }), AS.refund);
admin.get('/refunds', P('payments.view', 'payments.manage'), AS.listRefunds);

admin.get('/shipping/zones', P('shipments.manage', 'settings.manage'), AS.zones);
admin.post('/shipping/zones', P('shipments.manage', 'settings.manage'), validate({ body: s.zone }), AS.saveZone);
admin.put('/shipping/zones/:id', P('shipments.manage', 'settings.manage'), validate({ params: s.idParam, body: s.zone }), AS.saveZone);
admin.delete('/shipping/zones/:id', P('shipments.manage', 'settings.manage'), idp, AS.deleteZone);
admin.post('/shipping/methods', P('shipments.manage', 'settings.manage'), validate({ body: s.method }), AS.saveMethod);
admin.put('/shipping/methods/:id', P('shipments.manage', 'settings.manage'), validate({ params: s.idParam, body: s.method }), AS.saveMethod);
admin.delete('/shipping/methods/:id', P('shipments.manage', 'settings.manage'), idp, AS.deleteMethod);
admin.get('/shipments', P('shipments.manage', 'deliveries.own', 'orders.view'), AS.listShipments);
admin.get('/couriers', P('shipments.manage'), AS.couriers);
admin.patch('/shipments/:id/courier', P('shipments.manage'), validate({ params: s.idParam, body: s.assignCourier }), AS.assignCourier);
admin.patch('/shipments/:id/status', P('shipments.manage', 'deliveries.own'), validate({ params: s.idParam, body: s.shipmentUpdate }), AS.updateShipment);

admin.get('/returns', P('returns.manage', 'orders.manage'), AS.listReturns);
admin.patch('/returns/:id', P('returns.manage', 'orders.manage'), validate({ params: s.idParam, body: s.returnDecision }), AS.decideReturn);

admin.get('/coupons', P('coupons.manage'), AS.listCoupons);
admin.post('/coupons', P('coupons.manage'), validate({ body: s.coupon }), AS.saveCoupon);
admin.put('/coupons/:id', P('coupons.manage'), validate({ params: s.idParam, body: s.coupon }), AS.saveCoupon);
admin.delete('/coupons/:id', P('coupons.manage'), idp, AS.deleteCoupon);

admin.get('/reviews', P('reviews.moderate'), AS.listReviews);
admin.patch('/reviews/:id', P('reviews.moderate'), validate({ params: s.idParam, body: s.reviewModeration }), AS.moderateReview);
admin.delete('/reviews/:id', P('reviews.moderate'), idp, AS.deleteReview);

admin.get('/stock', P('stock.view', 'stock.manage'), AI.levels);
admin.get('/stock/alerts', P('stock.view', 'stock.manage', 'dashboard.view'), AI.alerts);
admin.get('/stock/movements', P('stock.view', 'stock.manage'), AI.movements);
admin.post('/stock/move', P('stock.manage'), validate({ body: s.stockMove }), AI.move);
admin.post('/stock/inventory', P('stock.manage'), validate({ body: s.stockCount }), AI.inventoryCount);
admin.patch('/stock/:id/threshold', P('stock.manage'), idp, AI.setThreshold);

admin.get('/suppliers', P('suppliers.manage', 'stock.manage'), AI.listSuppliers);
admin.get('/suppliers/:id', P('suppliers.manage', 'stock.manage'), idp, AI.getSupplier);
admin.post('/suppliers', P('suppliers.manage'), validate({ body: s.supplier }), AI.saveSupplier);
admin.put('/suppliers/:id', P('suppliers.manage'), validate({ params: s.idParam, body: s.supplier }), AI.saveSupplier);
admin.delete('/suppliers/:id', P('suppliers.manage'), idp, AI.deleteSupplier);
admin.post('/suppliers/:id/products', P('suppliers.manage'), idp, AI.linkProduct);
admin.delete('/suppliers/:id/products/:productId', P('suppliers.manage'), AI.unlinkProduct);
admin.get('/purchase-orders', P('suppliers.manage', 'stock.manage'), AI.listPOs);
admin.get('/purchase-orders/:id', P('suppliers.manage', 'stock.manage'), idp, AI.getPO);
admin.post('/purchase-orders', P('suppliers.manage', 'stock.manage'), validate({ body: s.purchaseOrder }), AI.createPO);
admin.post('/purchase-orders/:id/receive', P('stock.manage'), validate({ params: s.idParam, body: s.receivePO }), AI.receivePO);
admin.post('/purchase-orders/:id/cancel', P('suppliers.manage', 'stock.manage'), idp, AI.cancelPO);

admin.get('/customers', P('customers.view', 'users.manage', 'support.manage'), AY.listCustomers);
admin.get('/customers/:id', P('customers.view', 'users.manage', 'support.manage'), idp, AY.getCustomer);
admin.get('/users', P('users.manage'), AY.listUsers);
admin.get('/users/:id', P('users.manage'), idp, AY.getUser);
admin.post('/users', P('users.manage'), validate({ body: s.user }), AY.saveUser);
admin.put('/users/:id', P('users.manage'), validate({ params: s.idParam, body: s.user }), AY.saveUser);
admin.post('/users/:id/reset-access', P('users.manage'), idp, AY.resetAccess);
admin.get('/roles', P('roles.manage', 'users.manage'), AY.listRoles);
admin.post('/roles', P('roles.manage'), validate({ body: s.role }), AY.saveRole);
admin.put('/roles/:id', P('roles.manage'), validate({ params: s.idParam, body: s.role }), AY.saveRole);
admin.delete('/roles/:id', P('roles.manage'), idp, AY.deleteRole);

admin.get('/reports', P('reports.view'), AY.reportTypes);
admin.get('/reports/:type', P('reports.view'), AY.report);
admin.get('/settings', P('settings.manage'), AY.getSettings);
admin.put('/settings', P('settings.manage'), validate({ body: s.settingsPut }), AY.putSettings);
admin.get('/content', P('content.manage'), AY.listContent);
admin.get('/content/:name', P('content.manage'), AY.getContent);
admin.put('/content/:name', P('content.manage'), validate({ body: s.contentPut }), AY.putContent);
admin.get('/posts', P('content.manage'), AY.listPosts);
admin.get('/posts/:id', P('content.manage'), idp, AY.getPost);
admin.post('/posts', P('content.manage'), validate({ body: s.post }), AY.savePost);
admin.put('/posts/:id', P('content.manage'), validate({ params: s.idParam, body: s.post }), AY.savePost);
admin.delete('/posts/:id', P('content.manage'), idp, AY.deletePost);
admin.get('/support/tickets', P('support.manage'), AY.listTickets);
admin.get('/support/tickets/:id', P('support.manage'), idp, AY.getTicket);
admin.patch('/support/tickets/:id', P('support.manage'), validate({ params: s.idParam, body: s.ticketUpdate }), AY.updateTicket);
admin.get('/newsletter', P('support.manage', 'content.manage'), AY.newsletter);
admin.post('/newsletter/send', P('content.manage'), validate({ body: s.newsletterSend }), AY.sendNewsletter);
admin.delete('/newsletter/:id', P('support.manage', 'content.manage'), idp, AY.deleteSubscriber);
admin.get('/audit-logs', P('audit.view'), AY.auditLogs);

router.use('/admin', admin);
module.exports = router;
