const PDFDocument = require('pdfkit');
const { env } = require('../config/env');
const { safeJson } = require('./helpers');

const money = (n, cur = env.currency) => `${Number(n).toFixed(2)} ${cur}`;
const GREEN = '#0f382c';

function header(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
  doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold').text('VIVA', 50, 24, { continued: true })
    .fontSize(9).text('   LIVE BETTER');
  doc.fillColor('#fff').fontSize(14).text(title, 0, 28, { align: 'right', width: doc.page.width - 50 });
  doc.fillColor('#000').moveDown(3);
  if (subtitle) doc.fontSize(10).fillColor('#555').text(subtitle, 50, 90);
  doc.fillColor('#000');
}

/** Génère la facture / le bon de commande / le reçu en PDF. kind: invoice | slip | receipt */
function buildOrderPdf(res, { kind, order, items, invoice, payment }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  const titles = { invoice: 'FACTURE', slip: 'BON DE COMMANDE', receipt: 'REÇU DE PAIEMENT' };
  header(doc, titles[kind] || 'DOCUMENT', null);

  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica');
  const y0 = 100;
  doc.text(`Commande : ${order.order_number}`, 50, y0);
  if (invoice) doc.text(`Facture : ${invoice.invoice_number}`, 50, y0 + 14);
  if (payment?.receipt_number && kind === 'receipt') doc.text(`Reçu : ${payment.receipt_number}`, 50, y0 + 14);
  doc.text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-FR')}`, 50, y0 + 28);
  doc.text(`Statut paiement : ${order.payment_status}`, 50, y0 + 42);

  const addr = safeJson(order.shipping_address, {});
  doc.font('Helvetica-Bold').text('Livraison', 330, y0).font('Helvetica');
  doc.text([addr.full_name, addr.line1, addr.line2, `${addr.postal_code || ''} ${addr.city || ''}`, addr.country, addr.phone]
    .filter(Boolean).join('\n'), 330, y0 + 14, { width: 220 });

  let y = 210;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(50, y - 4, 495, 20).fill('#e8f0ec').fillColor('#000');
  doc.text('Produit', 56, y + 1).text('Qté', 330, y + 1).text('P.U.', 380, y + 1).text('Total', 470, y + 1);
  doc.font('Helvetica'); y += 24;
  for (const it of items) {
    if (y > 740) { doc.addPage(); y = 60; }
    doc.text(`${it.name}${it.variant_name ? ` (${it.variant_name})` : ''}`, 56, y, { width: 260 })
      .text(String(it.quantity), 330, y).text(money(it.unit_price, order.currency), 380, y).text(money(it.line_total, order.currency), 470, y);
    y += 22;
  }
  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke(); y += 10;
  const line = (label, val, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, y).text(val, 450, y, { width: 95, align: 'right' });
    y += 16;
  };
  line('Sous-total', money(order.subtotal, order.currency));
  if (Number(order.discount_total) > 0) line(`Remise${order.coupon_code ? ` (${order.coupon_code})` : ''}`, `- ${money(order.discount_total, order.currency)}`);
  line(`Livraison${order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}`, money(order.shipping_total, order.currency));
  if (Number(order.tax_total) > 0) line('TVA / taxes', money(order.tax_total, order.currency));
  line('TOTAL', money(order.grand_total, order.currency), true);

  doc.fontSize(8).fillColor('#777').text('Merci pour votre confiance - VIVA Live Better', 50, 780, { align: 'center', width: 495 });
  doc.end();
}

module.exports = { buildOrderPdf };
