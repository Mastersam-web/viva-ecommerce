export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmée', cls: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'En préparation', cls: 'bg-indigo-100 text-indigo-800' },
  shipped: { label: 'Expédiée', cls: 'bg-sky-100 text-sky-800' },
  delivering: { label: 'En cours de livraison', cls: 'bg-cyan-100 text-cyan-800' },
  delivered: { label: 'Livrée', cls: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Clôturée', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Annulée', cls: 'bg-red-100 text-red-700' },
  delivery_failed: { label: 'Échec de livraison', cls: 'bg-orange-100 text-orange-800' },
  returned: { label: 'Retournée', cls: 'bg-gray-200 text-gray-700' },
};
export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Non payé', cls: 'bg-gray-100 text-gray-700' },
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Payé', cls: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Échoué', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-200 text-gray-700' },
  refunded: { label: 'Remboursé', cls: 'bg-purple-100 text-purple-800' },
  partially_refunded: { label: 'Remboursé partiellement', cls: 'bg-purple-100 text-purple-800' },
};
export const METHOD: Record<string, string> = { cod: 'Paiement à la livraison', card: 'Carte bancaire', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', wallet: 'Portefeuille électronique' };
export const SHIPMENT_STATUS: Record<string, string> = { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', shipped: 'Expédiée', out_for_delivery: 'En cours de livraison', delivered: 'Livrée', failed: 'Échec de livraison', returned: 'Retournée', cancelled: 'Annulée' };
export const RETURN_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Demandé', cls: 'bg-amber-100 text-amber-800' }, approved: { label: 'Approuvé', cls: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Refusé', cls: 'bg-red-100 text-red-700' }, received: { label: 'Reçu', cls: 'bg-indigo-100 text-indigo-800' },
  refunded: { label: 'Remboursé', cls: 'bg-purple-100 text-purple-800' }, closed: { label: 'Clôturé', cls: 'bg-gray-200 text-gray-700' },
};
export const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Ouverte', cls: 'bg-amber-100 text-amber-800' }, in_progress: { label: 'En cours', cls: 'bg-blue-100 text-blue-800' },
  resolved: { label: 'Résolue', cls: 'bg-emerald-100 text-emerald-800' }, closed: { label: 'Clôturée', cls: 'bg-gray-200 text-gray-700' },
};
