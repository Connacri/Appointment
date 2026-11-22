import type {
  Language,
  PurchaseOrderItem,
  PurchaseOrderRecord,
  StockItem,
  SupplierChannel,
} from '../types/booking';

export interface StockDeductionLine {
  itemId: string;
  quantity: number;
}

export interface StockDeductionResult {
  updatedStockItems: StockItem[];
  appliedLines: Array<{ item: StockItem; deductedQty: number; prevQty: number; nextQty: number }>;
  lowStockTriggered: StockItem[];
  rupturedItems: StockItem[];
}

/**
 * Pure atomic batch deduction for room replenishment / consumables usage.
 * Deducts each positive quantity (clamped at 0) and identifies items at or below minThreshold.
 */
export function applyStockDeductions(
  stockItems: StockItem[],
  deductions: StockDeductionLine[]
): StockDeductionResult {
  const byId = new Map<string, number>();
  for (const line of deductions) {
    const qty = Math.max(0, Number(line.quantity) || 0);
    if (!line.itemId || qty <= 0) continue;
    byId.set(line.itemId, (byId.get(line.itemId) || 0) + qty);
  }

  const appliedLines: StockDeductionResult['appliedLines'] = [];
  const lowStockTriggered: StockItem[] = [];
  const rupturedItems: StockItem[] = [];

  const updatedStockItems = stockItems.map((item) => {
    const deduct = byId.get(item.id);
    if (!deduct) return item;
    const prevQty = item.quantity;
    const nextQty = Math.max(0, prevQty - deduct);
    const actualDeduct = prevQty - nextQty > 0 ? prevQty - nextQty : deduct;
    const updatedItem: StockItem = { ...item, quantity: nextQty };

    appliedLines.push({
      item: updatedItem,
      deductedQty: actualDeduct,
      prevQty,
      nextQty,
    });

    if (nextQty <= updatedItem.minThreshold) {
      lowStockTriggered.push(updatedItem);
    }
    if (nextQty === 0) {
      rupturedItems.push(updatedItem);
    }
    return updatedItem;
  });

  return {
    updatedStockItems,
    appliedLines,
    lowStockTriggered,
    rupturedItems,
  };
}

export function buildRecommendedOrderItems(stockItems: StockItem[]): PurchaseOrderItem[] {
  return stockItems
    .filter((item) => item.quantity <= item.minThreshold)
    .map((item) => {
      const targetLevel = Math.max(item.minThreshold * 2, item.minThreshold + 5, 10);
      const orderQty = Math.max(1, targetLevel - item.quantity);
      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        currentQty: item.quantity,
        minThreshold: item.minThreshold,
        orderQty,
        unitCost: item.unitCost,
      };
    });
}

export function normalizePhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits.replace(/\D/g, '');
}

export function formatSupplierOrderMessage(params: {
  order: Pick<PurchaseOrderRecord, 'orderNumber' | 'supplierName' | 'items' | 'note' | 'createdAt'>;
  establishmentName?: string;
  currency?: string;
  language: Language;
}): string {
  const { order, establishmentName, currency = 'DA', language } = params;
  const isFr = language === 'fr';
  const isAr = language === 'ar';

  const headerTitle = isFr
    ? `BON DE COMMANDE ${order.orderNumber}`
    : isAr
    ? `طلب شراء رقم ${order.orderNumber}`
    : `PURCHASE ORDER ${order.orderNumber}`;

  const hotelLine = establishmentName
    ? `${isFr ? 'Établissement' : isAr ? 'المنشأة' : 'Property'}: ${establishmentName}`
    : '';
  const supplierLine = `${isFr ? 'Fournisseur' : isAr ? 'المورد' : 'Supplier'}: ${order.supplierName}`;
  const dateLine = `${isFr ? 'Date' : isAr ? 'التاريخ' : 'Date'}: ${order.createdAt.slice(0, 10)}`;

  const itemsLines = order.items
    .filter((it) => it.orderQty > 0)
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.itemName} — ${it.orderQty} ${it.unit}${
          it.unitCost > 0 ? ` (${(it.orderQty * it.unitCost).toLocaleString()} ${currency})` : ''
        }`
    );

  const totalEst = order.items.reduce((sum, it) => sum + Math.max(0, it.orderQty) * (it.unitCost || 0), 0);
  const totalLine =
    totalEst > 0
      ? `${isFr ? 'Total estimé' : isAr ? 'التكلفة التقديرية' : 'Estimated total'}: ${totalEst.toLocaleString()} ${currency}`
      : '';
  const noteLine = order.note?.trim()
    ? `${isFr ? 'Note' : isAr ? 'ملاحظة' : 'Note'}: ${order.note.trim()}`
    : '';
  const footerLine = isFr
    ? 'Merci de confirmer la disponibilité et le délai de livraison.'
    : isAr
    ? 'يرجى تأكيد التوفر وموعد التسليم.'
    : 'Please confirm availability and delivery schedule.';

  return [
    headerTitle,
    hotelLine,
    supplierLine,
    dateLine,
    '',
    ...itemsLines,
    totalLine ? `\n${totalLine}` : '',
    noteLine,
    '',
    footerLine,
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

export function buildSupplierDispatchUrl(params: {
  channel: SupplierChannel;
  phone?: string;
  email?: string;
  subject: string;
  message: string;
}): string | null {
  const { channel, phone, email, subject, message } = params;
  if (channel === 'whatsapp') {
    const digits = normalizePhoneForWhatsApp(phone);
    if (digits) {
      return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }
  if (channel === 'email') {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) return null;
    return `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
  if (channel === 'sms') {
    const digits = (phone || '').replace(/[^\d+]/g, '');
    if (!digits) return null;
    return `sms:${digits}?body=${encodeURIComponent(message)}`;
  }
  return null;
}
