import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Plus,
  Minus,
  AlertTriangle,
  Download,
  Copy,
  Search,
  CheckCircle2,
  Trash2,
  Send,
  Mail,
  MessageCircle,
  Phone,
  Truck,
  Edit3,
  PackagePlus,
  Building2,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type {
  PurchaseOrderItem,
  PurchaseOrderRecord,
  StockItem,
  StockSupplier,
  SupplierChannel,
} from '../types/booking';
import {
  buildRecommendedOrderItems,
  buildSupplierDispatchUrl,
  formatSupplierOrderMessage,
} from '../utils/stockProcurement';

export const StockManagementView: React.FC = () => {
  const {
    stockItems,
    stockMovements,
    addStockMovement,
    addStockItem,
    seedStandardStockCatalog,
    updateStockItem,
    deleteStockItem,
    suppliers,
    saveSupplier,
    deleteSupplier,
    purchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    markPurchaseOrderReceived,
    focusedStockTab,
    setFocusedStockTab,
    establishmentProfile,
    language,
    currency,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'reorder' | 'suppliers'>('stock');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync deep-link tab from TopBar / Task notifications
  useEffect(() => {
    if (!focusedStockTab) return;
    setActiveTab(focusedStockTab);
    setFocusedStockTab(null);
  }, [focusedStockTab, setFocusedStockTab]);

  // Stock Movement Modal
  const [movementModal, setMovementModal] = useState<{
    open: boolean;
    type: 'in' | 'out' | 'inventory';
    item: StockItem | null;
  }>({ open: false, type: 'in', item: null });
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [reasonInput, setReasonInput] = useState<string>('');
  const [roomInput, setRoomInput] = useState<string>('');

  // New / Edit Stock Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    name: string;
    category: string;
    unit: string;
    quantity: number;
    minThreshold: number;
    unitCost: number;
    preferredSupplierId: string;
  }>({
    name: '',
    category: 'Produits de bain',
    unit: 'pce',
    quantity: 50,
    minThreshold: 15,
    unitCost: 150,
    preferredSupplierId: '',
  });

  // Purchase Order Editor State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [poSupplierId, setPoSupplierId] = useState<string>('');
  const [poSupplierName, setPoSupplierName] = useState<string>('');
  const [poSupplierPhone, setPoSupplierPhone] = useState<string>('');
  const [poSupplierEmail, setPoSupplierEmail] = useState<string>('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>(() => buildRecommendedOrderItems(stockItems));
  const [poNote, setPoNote] = useState<string>('');
  const [poCustomMessage, setPoCustomMessage] = useState<string>('');
  const [isCustomMessageEdited, setIsCustomMessageEdited] = useState(false);
  const [addItemPickerId, setAddItemPickerId] = useState<string>('');
  const [lastCreatedPoId, setLastCreatedPoId] = useState<string | null>(null);
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null);

  // Supplier Form State
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supCategory, setSupCategory] = useState('Produits de bain & Accueil');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supChannel, setSupChannel] = useState<SupplierChannel>('whatsapp');
  const [supNotes, setSupNotes] = useState('');

  const categories = useMemo(() => {
    const base = ['Linge', 'Produits de bain', 'Minibar', 'Entretien', 'Accueil'];
    const dynamic = stockItems.map((i) => i.category).filter(Boolean);
    return ['all', ...Array.from(new Set([...base, ...dynamic]))];
  }, [stockItems]);

  const filteredItems = useMemo(
    () =>
      stockItems.filter((item) => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            (item.name ?? '').toLowerCase().includes(q) ||
            (item.category ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [stockItems, selectedCategory, searchQuery]
  );

  const lowStockItems = useMemo(
    () => stockItems.filter((item) => item.quantity <= item.minThreshold),
    [stockItems]
  );
  const rupturedItems = useMemo(
    () => stockItems.filter((item) => item.quantity === 0),
    [stockItems]
  );
  const totalStockValue = useMemo(
    () => stockItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    [stockItems]
  );

  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const handleOpenMovement = (item: StockItem, type: 'in' | 'out' | 'inventory') => {
    setMovementModal({ open: true, type, item });
    setQuantityInput(type === 'inventory' ? item.quantity : 1);
    setReasonInput(
      type === 'in'
        ? 'Réception fournisseur'
        : type === 'out'
        ? 'Sortie manuelle service'
        : 'Comptage physique inventaire'
    );
    setRoomInput('');
  };

  const handleConfirmMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModal.item) return;
    const { item, type } = movementModal;
    if (type === 'in') {
      addStockMovement(item.id, quantityInput, reasonInput || 'Entrée stock');
    } else if (type === 'out') {
      addStockMovement(item.id, -quantityInput, reasonInput || 'Sortie stock', roomInput);
    } else if (type === 'inventory') {
      const delta = quantityInput - item.quantity;
      if (delta !== 0) {
        addStockMovement(item.id, delta, 'Ajustement inventaire physique');
      }
    }
    setMovementModal({ open: false, type: 'in', item: null });
  };

  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      category: 'Produits de bain',
      unit: 'pce',
      quantity: 50,
      minThreshold: 15,
      unitCost: 150,
      preferredSupplierId: suppliers[0]?.id || '',
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: StockItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      unitCost: item.unitCost,
      preferredSupplierId: item.preferredSupplierId || '',
    });
    setItemModalOpen(true);
  };

  const handleSaveStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;
    const payload = {
      name: itemForm.name.trim(),
      category: itemForm.category.trim() || 'Accueil',
      unit: itemForm.unit.trim() || 'pce',
      quantity: Math.max(0, Number(itemForm.quantity) || 0),
      minThreshold: Math.max(0, Number(itemForm.minThreshold) || 0),
      unitCost: Math.max(0, Number(itemForm.unitCost) || 0),
      preferredSupplierId: itemForm.preferredSupplierId || undefined,
    };
    if (editingItem) {
      updateStockItem({ ...editingItem, ...payload });
    } else {
      addStockItem(payload);
    }
    setItemModalOpen(false);
  };

  const exportMovementsCSV = () => {
    const rows = [
      ['Date', 'Article', 'Quantité', 'Motif', 'Chambre', 'Utilisateur'],
      ...stockMovements.map((m) => [m.timestamp, m.itemName, m.delta, m.reason, m.room || '', m.user]),
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      encodeURIComponent(
        rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
      );
    const link = document.createElement('a');
    link.href = csvContent;
    link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Load recommended low-stock order into PO editor
  const loadLowStockIntoOrderEditor = () => {
    const rec = buildRecommendedOrderItems(stockItems);
    setEditingOrderId(null);
    setLastCreatedPoId(null);
    setPoItems(rec);
    // Auto-pick preferred supplier from first low-stock item if configured
    const firstPreferredId = lowStockItems.find((i) => i.preferredSupplierId)?.preferredSupplierId || suppliers[0]?.id || '';
    if (firstPreferredId && suppliersById.has(firstPreferredId)) {
      const sup = suppliersById.get(firstPreferredId)!;
      setPoSupplierId(sup.id);
      setPoSupplierName(sup.name);
      setPoSupplierPhone(sup.phone || '');
      setPoSupplierEmail(sup.email || '');
    }
    setIsCustomMessageEdited(false);
    setActiveTab('reorder');
  };

  const handleSelectSupplierForPo = (supId: string) => {
    setPoSupplierId(supId);
    const found = suppliersById.get(supId);
    if (found) {
      setPoSupplierName(found.name);
      setPoSupplierPhone(found.phone || '');
      setPoSupplierEmail(found.email || '');
    }
  };

  const handleAddStockLineToPo = () => {
    if (!addItemPickerId) return;
    const item = stockItems.find((s) => s.id === addItemPickerId);
    if (!item) return;
    setPoItems((prev) => {
      if (prev.some((line) => line.itemId === item.id)) {
        return prev.map((line) =>
          line.itemId === item.id ? { ...line, orderQty: line.orderQty + 5 } : line
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          currentQty: item.quantity,
          minThreshold: item.minThreshold,
          orderQty: Math.max(item.minThreshold * 2 - item.quantity, 5),
          unitCost: item.unitCost,
        },
      ];
    });
    setAddItemPickerId('');
  };

  const activeOrderPreviewMessage = useMemo(() => {
    if (isCustomMessageEdited) return poCustomMessage;
    const draftNumber =
      editingOrderId
        ? purchaseOrders.find((p) => p.id === editingOrderId)?.orderNumber || 'CMD-EDIT'
        : `CMD-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    return formatSupplierOrderMessage({
      order: {
        orderNumber: draftNumber,
        supplierName: poSupplierName.trim() || t('Fournisseur', 'Supplier', 'المورد'),
        items: poItems,
        note: poNote,
        createdAt: new Date().toISOString(),
      },
      establishmentName: establishmentProfile.name || undefined,
      currency,
      language,
    });
  }, [
    isCustomMessageEdited,
    poCustomMessage,
    editingOrderId,
    purchaseOrders,
    poSupplierName,
    poItems,
    poNote,
    establishmentProfile.name,
    currency,
    language,
  ]);

  const poTotalEstimate = useMemo(
    () => poItems.reduce((sum, it) => sum + Math.max(0, it.orderQty) * (it.unitCost || 0), 0),
    [poItems]
  );

  const persistOrder = (targetStatus: 'draft' | 'confirmed'): PurchaseOrderRecord | null => {
    const cleanItems = poItems.filter((i) => i.orderQty > 0);
    if (cleanItems.length === 0) return null;
    const supplierLabel = poSupplierName.trim() || t('Fournisseur à préciser', 'Unspecified supplier', 'مورد عام');
    const nowIso = new Date().toISOString();

    if (editingOrderId) {
      const existing = purchaseOrders.find((p) => p.id === editingOrderId);
      if (existing) {
        const updated: PurchaseOrderRecord = {
          ...existing,
          supplierId: poSupplierId || undefined,
          supplierName: supplierLabel,
          supplierPhone: poSupplierPhone.trim() || undefined,
          supplierEmail: poSupplierEmail.trim() || undefined,
          note: poNote.trim() || undefined,
          items: cleanItems,
          status: targetStatus,
          confirmedAt: targetStatus === 'confirmed' ? existing.confirmedAt || nowIso : existing.confirmedAt,
        };
        updatePurchaseOrder(updated);
        setLastCreatedPoId(updated.id);
        setEditingOrderId(updated.id);
        return updated;
      }
    }

    const created = createPurchaseOrder({
      supplierId: poSupplierId || undefined,
      supplierName: supplierLabel,
      supplierPhone: poSupplierPhone.trim() || undefined,
      supplierEmail: poSupplierEmail.trim() || undefined,
      note: poNote.trim() || undefined,
      items: cleanItems,
      status: targetStatus,
      confirmedAt: targetStatus === 'confirmed' ? nowIso : undefined,
    });
    setLastCreatedPoId(created.id);
    setEditingOrderId(created.id);
    return created;
  };

  const activeSavedPo = useMemo(
    () => purchaseOrders.find((p) => p.id === (editingOrderId || lastCreatedPoId)) || null,
    [purchaseOrders, editingOrderId, lastCreatedPoId]
  );

  const loadOrderIntoEditor = (po: PurchaseOrderRecord) => {
    setEditingOrderId(po.id);
    setLastCreatedPoId(po.id);
    setPoSupplierId(po.supplierId || '');
    setPoSupplierName(po.supplierName);
    setPoSupplierPhone(po.supplierPhone || '');
    setPoSupplierEmail(po.supplierEmail || '');
    setPoItems(po.items.map((item) => ({ ...item })));
    setPoNote(po.note || '');
    setIsCustomMessageEdited(false);
  };

  const handleResetEditor = () => {
    setEditingOrderId(null);
    setLastCreatedPoId(null);
    setPoItems(buildRecommendedOrderItems(stockItems));
    setPoNote('');
    setIsCustomMessageEdited(false);
  };

  const markOrderDispatched = (po: PurchaseOrderRecord, channel: SupplierChannel | 'copy') => {
    updatePurchaseOrder({
      ...po,
      status: po.status === 'received' ? 'received' : 'sent',
      confirmedAt: po.confirmedAt || new Date().toISOString(),
      sentAt: new Date().toISOString(),
      sentVia: channel,
    });
  };

  const handleCopyPoMessage = async (po: PurchaseOrderRecord | null, msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      const feedbackKey = po?.id || 'draft';
      setCopyFeedbackId(feedbackKey);
      setTimeout(() => setCopyFeedbackId(null), 2200);
      if (po) {
        markOrderDispatched(po, 'copy');
      }
    } catch {
      // Ignore clipboard permission failure
    }
  };

  const handleSaveSupplierForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    saveSupplier({
      id: editingSupplierId || undefined,
      name: supName,
      category: supCategory,
      contactName: supContact,
      phone: supPhone,
      email: supEmail,
      preferredChannel: supChannel,
      notes: supNotes,
    });
    setEditingSupplierId(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupEmail('');
    setSupNotes('');
    setSupChannel('whatsapp');
  };

  const startEditSupplier = (sup: StockSupplier) => {
    setEditingSupplierId(sup.id);
    setSupName(sup.name);
    setSupCategory(sup.category);
    setSupContact(sup.contactName || '');
    setSupPhone(sup.phone || '');
    setSupEmail(sup.email || '');
    setSupChannel(sup.preferredChannel);
    setSupNotes(sup.notes || '');
  };

  const pendingOrdersCount = purchaseOrders.filter(
    (p) => p.status === 'draft' || p.status === 'confirmed'
  ).length;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes size={18} className="text-blue-500 shrink-0" />
            <span>
              {t('Stock, Économat & Commandes Fournisseurs', 'Hotel Stock, Supplies & Procurement', 'المخزون والمستلزمات وطلبات الموردين')}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t(
              'Déduction automatique par réalimentation chambre, alertes de rupture et envoi direct WhatsApp / Email',
              'Automatic deduction on room replenishment, low-stock alerts & direct supplier dispatch',
              'خصم تلقائي عند تزويد الغرف مع تنبيهات النفاد وإرسال الطلبات مباشرة للموردين'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              {t('Valeur Économat', 'Stock Value', 'قيمة المخزون')}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalStockValue.toLocaleString()} {currency}
            </span>
          </div>

          {lowStockItems.length > 0 && (
            <button
              type="button"
              onClick={loadLowStockIntoOrderEditor}
              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
            >
              <AlertTriangle size={14} className="text-rose-500 shrink-0" />
              <div className="text-start">
                <span className="text-[10px] font-bold text-rose-500 uppercase block">
                  {rupturedItems.length > 0
                    ? t('Rupture / Seuil bas', 'Out / Low Stock', 'نفاد / منخفض')
                    : t('Seuil Bas', 'Low Stock', 'مخزون منخفض')}
                </span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                  {lowStockItems.length} {t('à commander', 'to order', 'للطلب')}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Rupture / Low-Stock Alert Banner */}
      {lowStockItems.length > 0 && activeTab !== 'reorder' && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/25 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-200">
                {rupturedItems.length > 0
                  ? t(
                      `${rupturedItems.length} rupture(s) de stock et ${lowStockItems.length} article(s) sous le seuil critique`,
                      `${rupturedItems.length} out-of-stock item(s) and ${lowStockItems.length} below minimum threshold`,
                      `${rupturedItems.length} صنف منعدم و ${lowStockItems.length} تحت الحد الأدنى`
                    )
                  : t(
                      `${lowStockItems.length} article(s) sous le seuil minimum de sécurité`,
                      `${lowStockItems.length} item(s) below safety threshold`,
                      `${lowStockItems.length} أصناف تحت حد الأمان`
                    )}
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 truncate">
                {lowStockItems
                  .slice(0, 5)
                  .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadLowStockIntoOrderEditor}
            className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Send size={14} />
            <span>{t('Préparer & Lancer commande', 'Prepare & Launch Order', 'تحضير وإرسال طلب الشراء')}</span>
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-xs overflow-x-auto max-w-full">
          {(
            [
              ['stock', t('Inventaire', 'Inventory', 'المخزون')],
              ['movements', t('Mouvements', 'Ledger', 'الحركات')],
              [
                'reorder',
                `${t('Commandes', 'Orders', 'الطلبات')} (${lowStockItems.length}${pendingOrdersCount > 0 ? ` · ${pendingOrdersCount}` : ''})`,
              ],
              ['suppliers', `${t('Fournisseurs', 'Suppliers', 'الموردون')} (${suppliers.length})`],
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tabId
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'stock' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => seedStandardStockCatalog()}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <PackagePlus size={14} className="text-blue-500" />
              <span>{t('Dotation standard (25)', 'Standard Catalog (25)', 'القائمة القياسية (25)')}</span>
            </button>
            <button
              type="button"
              onClick={openCreateItemModal}
              className="min-h-[40px] px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('Nouvel article', 'New Item', 'صنف جديد')}</span>
            </button>
          </div>
        )}

        {activeTab === 'movements' && (
          <button
            type="button"
            onClick={exportMovementsCSV}
            className="min-h-[40px] flex items-center gap-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download size={14} />
            <span>{t('Exporter CSV', 'Export CSV', 'تصدير CSV')}</span>
          </button>
        )}
      </div>

      {/* TAB 1: LIVE INVENTORY */}
      {activeTab === 'stock' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Chercher un article...', 'Search item...', 'ابحث عن صنف...')}
                className="w-full min-h-[40px] ps-8 pe-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[38px] px-2.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat === 'all' ? t('Tous', 'All', 'الكل') : cat}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <Boxes size={34} className="mx-auto text-slate-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  {stockItems.length === 0
                    ? t('Aucun article en stock pour le moment', 'No stock items configured yet', 'لا توجد أصناف في المخزون حالياً')
                    : t('Aucun article ne correspond à ce filtre', 'No items match your filter', 'لا توجد أصناف مطابقة')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'Chargez les 25 consommables hôteliers standard ou créez vos propres articles.',
                    'Load the 25 standard hotel consumables or create custom stock items.',
                    'قم بتحميل 25 مستهلك فندقي قياسي أو أنشئ أصنافك الخاصة.'
                  )}
                </p>
              </div>
              {stockItems.length === 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => seedStandardStockCatalog()}
                    className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {t('Charger les 25 articles standard', 'Load 25 standard items', 'تحميل 25 صنفاً قياسياً')}
                  </button>
                  <button
                    type="button"
                    onClick={openCreateItemModal}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {t('Créer un article manuellement', 'Add custom item', 'إضافة صنف يدوياً')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
              {filteredItems.map((item) => {
                const isRupture = item.quantity === 0;
                const isLow = item.quantity <= item.minThreshold;
                const progress = Math.min(
                  100,
                  Math.round((item.quantity / Math.max(item.minThreshold * 3, 1)) * 100)
                );
                const prefSup = item.preferredSupplierId
                  ? suppliersById.get(item.preferredSupplierId)
                  : undefined;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition ${
                      isLow
                        ? 'bg-rose-50/30 dark:bg-rose-950/15 border-rose-300 dark:border-rose-900/50 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {item.category}
                          {prefSup ? ` · ${prefSup.name}` : ''}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                          {item.name}
                        </h3>
                      </div>

                      <div className="text-end shrink-0">
                        <span
                          className={`text-base font-bold font-mono tabular-nums ${
                            isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {item.quantity}{' '}
                          <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                        </span>
                        {isRupture && (
                          <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            {t('RUPTURE', 'OUT OF STOCK', 'نفد')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-rose-500' : progress > 50 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                        <span>
                          {t('Seuil min', 'Min', 'الحد')}: {item.minThreshold} {item.unit}
                        </span>
                        <span>
                          {t('P.U', 'Unit', 'السعر')}: {item.unitCost.toLocaleString()} {currency}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          aria-label={t('Modifier article', 'Edit item', 'تعديل')}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteStockItem(item.id)}
                          aria-label={t('Supprimer article', 'Delete item', 'حذف')}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenMovement(item, 'in')}
                          className="min-h-[36px] px-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          + {t('Entrée', 'In', 'إدخال')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenMovement(item, 'out')}
                          className="min-h-[36px] px-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          − {t('Sortie', 'Out', 'إخراج')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenMovement(item, 'inventory')}
                          className="min-h-[36px] px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          {t('Inventaire', 'Count', 'جرد')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MOVEMENT LEDGER */}
      {activeTab === 'movements' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {stockMovements.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {t('Aucun mouvement enregistré pour le moment.', 'No stock movements recorded yet.', 'لا توجد حركات مسجلة بعد.')}
            </div>
          ) : (
            <>
              {/* Mobile list */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {stockMovements.map((m) => (
                  <div key={m.id} className="p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate">{m.itemName}</span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          m.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {m.reason}
                      {m.room ? ` · ${m.room}` : ''}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>{m.timestamp}</span>
                      <span>{m.user}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 text-start">{t('Horodatage', 'Timestamp', 'الوقت')}</th>
                      <th className="p-3 text-start">{t('Article', 'Item', 'الصنف')}</th>
                      <th className="p-3 text-start">{t('Variation', 'Delta', 'التغيير')}</th>
                      <th className="p-3 text-start">{t('Motif & Justificatif', 'Reason', 'السبب')}</th>
                      <th className="p-3 text-start">{t('Chambre', 'Room', 'الغرفة')}</th>
                      <th className="p-3 text-start">{t('Opérateur', 'Operator', 'الموظف')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {stockMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono tabular-nums text-slate-400">{m.timestamp}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white">{m.itemName}</td>
                        <td className="p-3 font-mono font-bold tabular-nums">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                              m.delta > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {m.delta > 0 ? `+${m.delta}` : m.delta}
                          </span>
                        </td>
                        <td className="p-3">{m.reason}</td>
                        <td className="p-3 font-mono">{m.room || '—'}</td>
                        <td className="p-3 text-slate-400">{m.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: REORDER & PURCHASE ORDERS WORKFLOW */}
      {activeTab === 'reorder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left 7 cols: Purchase Order Builder & Editor */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingOrderId
                    ? t('Éditer & Confirmer la commande', 'Edit & Confirm Purchase Order', 'تعديل وتأكيد طلب الشراء')
                    : t('Préparer une commande fournisseur', 'Prepare Supplier Purchase Order', 'تحضير طلب شراء للمورد')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'Ajustez les quantités, confirmez la commande puis envoyez directement via WhatsApp, Email ou SMS.',
                    'Adjust quantities, confirm the order, then send directly via WhatsApp, Email, or SMS.',
                    'عدّل الكميات وأكّد الطلب ثم أرسله مباشرة عبر واتساب أو البريد أو SMS.'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadLowStockIntoOrderEditor}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Charger seuils bas', 'Load low stock', 'تحميل النواقص')}
                </button>
                {editingOrderId && (
                  <button
                    type="button"
                    onClick={handleResetEditor}
                    className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {t('Nouvelle commande', 'New order', 'طلب جديد')}
                  </button>
                )}
              </div>
            </div>

            {/* Supplier Selector & Contact Override */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {t('Fournisseur configuré', 'Configured Supplier', 'مورد محفوظ')}
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={poSupplierId}
                    onChange={(e) => handleSelectSupplierForPo(e.target.value)}
                    className="flex-1 min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="">{t('— Saisie libre / Autre —', '— Custom / Manual —', '— إدخال يدوي —')}</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} ({sup.preferredChannel.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActiveTab('suppliers')}
                    title={t('Configurer les fournisseurs', 'Configure suppliers', 'إعداد الموردين')}
                    className="min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    <Building2 size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {t('Nom fournisseur', 'Supplier Name', 'اسم المورد')}
                </label>
                <input
                  type="text"
                  value={poSupplierName}
                  onChange={(e) => setPoSupplierName(e.target.value)}
                  placeholder={t('Ex: Hygiène Plus Oran', 'e.g. Hygiene Supply Co.', 'مثال: شركة التوريد الفندقي')}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {t('Téléphone / WhatsApp (avec indicatif)', 'Phone / WhatsApp (with country code)', 'رقم الهاتف / واتساب')}
                </label>
                <input
                  type="tel"
                  value={poSupplierPhone}
                  onChange={(e) => setPoSupplierPhone(e.target.value)}
                  placeholder="+213 550 00 00 00"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  {t('Email fournisseur', 'Supplier Email', 'البريد الإلكتروني')}
                </label>
                <input
                  type="email"
                  value={poSupplierEmail}
                  onChange={(e) => setPoSupplierEmail(e.target.value)}
                  placeholder="commandes@fournisseur.dz"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Add item to PO */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={addItemPickerId}
                onChange={(e) => setAddItemPickerId(e.target.value)}
                className="flex-1 min-w-[180px] min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              >
                <option value="">{t('+ Ajouter un article du stock...', '+ Add stock item...', '+ إضافة صنف من المخزون...')}</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addItemPickerId}
                onClick={handleAddStockLineToPo}
                className="min-h-[40px] px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-xs font-bold cursor-pointer"
              >
                {t('Ajouter ligne', 'Add Line', 'إضافة')}
              </button>
            </div>

            {/* Order Items Editable List */}
            {poItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center space-y-1.5">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 opacity-80" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t(
                    'Aucun article sélectionné. Tous les stocks sont au-dessus du seuil ou ajoutez un article ci-dessus.',
                    'No items selected. Stock levels are healthy or add an item above.',
                    'لا توجد أصناف محددة للطلب حالياً.'
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {poItems.map((line) => (
                  <div
                    key={line.itemId}
                    className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {line.itemName}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {t('Stock actuel', 'In stock', 'المتوفر')}: {line.currentQty} {line.unit} ({t('seuil', 'min', 'الحد')}: {line.minThreshold})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPoItems((prev) =>
                              prev.map((it) =>
                                it.itemId === line.itemId
                                  ? { ...it, orderQty: Math.max(0, it.orderQty - 1) }
                                  : it
                              )
                            )
                          }
                          className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={line.orderQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setPoItems((prev) =>
                              prev.map((it) => (it.itemId === line.itemId ? { ...it, orderQty: val } : it))
                            );
                          }}
                          className="w-16 min-h-[38px] text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPoItems((prev) =>
                              prev.map((it) =>
                                it.itemId === line.itemId ? { ...it, orderQty: it.orderQty + 1 } : it
                              )
                            )
                          }
                          className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="text-end min-w-[78px] font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                        {(line.orderQty * line.unitCost).toLocaleString()} {currency}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPoItems((prev) => prev.filter((it) => it.itemId !== line.itemId))
                        }
                        aria-label={t('Retirer', 'Remove', 'إزالة')}
                        className="min-h-[38px] min-w-[38px] rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery Note & Summary Total */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
              <input
                type="text"
                value={poNote}
                onChange={(e) => setPoNote(e.target.value)}
                placeholder={t('Note livraison (ex: Livraison souhaitée demain matin)...', 'Delivery note...', 'ملاحظة التوصيل...')}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
              <div className="flex items-center justify-between px-3 min-h-[40px] rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('Total estimé', 'Estimated Total', 'الإجمالي التقديري')}
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {poTotalEstimate.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {t('Aperçu du message envoyé au fournisseur', 'Supplier Message Preview', 'معاينة رسالة المورد')}
                </label>
                {isCustomMessageEdited && (
                  <button
                    type="button"
                    onClick={() => setIsCustomMessageEdited(false)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {t('Régénérer automatiquement', 'Reset auto preview', 'إعادة التوليد تلقائياً')}
                  </button>
                )}
              </div>
              <textarea
                rows={6}
                value={activeOrderPreviewMessage}
                onChange={(e) => {
                  setIsCustomMessageEdited(true);
                  setPoCustomMessage(e.target.value);
                }}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Workflow Actions: Save Draft -> Confirm -> Direct Send */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={poItems.every((i) => i.orderQty <= 0)}
                onClick={() => persistOrder('draft')}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('Enregistrer brouillon', 'Save Draft', 'حفظ كمسودة')}
              </button>

              <button
                type="button"
                disabled={poItems.every((i) => i.orderQty <= 0)}
                onClick={() => persistOrder('confirmed')}
                className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={15} />
                <span>{t('Confirmer la commande', 'Confirm Order', 'تأكيد الطلب')}</span>
              </button>
            </div>

            {/* Direct Supplier Dispatch Bar (shown whenever PO has items; automatically saves & marks confirmed/sent) */}
            {poItems.some((i) => i.orderQty > 0) && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {t(
                    'Envoi direct au fournisseur (après confirmation)',
                    'Direct Supplier Dispatch',
                    'إرسال مباشر للمورد'
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const waUrl = buildSupplierDispatchUrl({
                      channel: 'whatsapp',
                      phone: poSupplierPhone,
                      subject: activeSavedPo?.orderNumber || 'Commande',
                      message: activeOrderPreviewMessage,
                    });
                    const mailUrl = buildSupplierDispatchUrl({
                      channel: 'email',
                      email: poSupplierEmail,
                      subject: `${t('Bon de commande', 'Purchase Order', 'طلب شراء')} ${activeSavedPo?.orderNumber || ''}`.trim(),
                      message: activeOrderPreviewMessage,
                    });
                    const smsUrl = buildSupplierDispatchUrl({
                      channel: 'sms',
                      phone: poSupplierPhone,
                      subject: 'Commande',
                      message: activeOrderPreviewMessage,
                    });

                    return (
                      <>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              const po = activeSavedPo || persistOrder('confirmed');
                              if (po) markOrderDispatched(po, 'whatsapp');
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                          >
                            <MessageCircle size={15} />
                            <span>{t('Envoyer via WhatsApp', 'Send via WhatsApp', 'إرسال عبر واتساب')}</span>
                          </a>
                        )}

                        {mailUrl ? (
                          <a
                            href={mailUrl}
                            onClick={() => {
                              const po = activeSavedPo || persistOrder('confirmed');
                              if (po) markOrderDispatched(po, 'email');
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <Mail size={15} />
                            <span>{t('Envoyer par Email', 'Send via Email', 'إرسال عبر البريد')}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {t('Ajoutez un email pour l’envoi Email', 'Add email for Email dispatch', 'أضف بريداً للإرسال')}
                          </span>
                        )}

                        {smsUrl && (
                          <a
                            href={smsUrl}
                            onClick={() => {
                              const po = activeSavedPo || persistOrder('confirmed');
                              if (po) markOrderDispatched(po, 'sms');
                            }}
                            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <Phone size={14} />
                            <span>SMS</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const po = activeSavedPo || persistOrder('confirmed');
                            void handleCopyPoMessage(po, activeOrderPreviewMessage);
                          }}
                          className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy size={14} />
                          <span>
                            {copyFeedbackId === (activeSavedPo?.id || 'draft')
                              ? t('Copié !', 'Copied!', 'تم النسخ!')
                              : t('Copier le bon', 'Copy Order', 'نسخ الطلب')}
                          </span>
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Purchase Orders History */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck size={16} className="text-blue-500" />
                <span>{t('Historique des commandes', 'Purchase Orders', 'سجل الطلبات')}</span>
              </h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">{purchaseOrders.length}</span>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'Aucune commande enregistrée. Préparez et confirmez une commande à gauche.',
                  'No purchase orders yet. Prepare and confirm an order on the left.',
                  'لا توجد طلبات شراء مسجلة بعد.'
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[65vh] overflow-y-auto">
                {purchaseOrders.map((po) => {
                  const totalCost = po.items.reduce(
                    (sum, it) => sum + it.orderQty * (it.unitCost || 0),
                    0
                  );
                  const msgText = formatSupplierOrderMessage({
                    order: po,
                    establishmentName: establishmentProfile.name || undefined,
                    currency,
                    language,
                  });
                  const waUrl = buildSupplierDispatchUrl({
                    channel: 'whatsapp',
                    phone: po.supplierPhone,
                    subject: po.orderNumber,
                    message: msgText,
                  });

                  const statusLabel =
                    po.status === 'draft'
                      ? t('Brouillon', 'Draft', 'مسودة')
                      : po.status === 'confirmed'
                      ? t('Confirmée', 'Confirmed', 'مؤكد')
                      : po.status === 'sent'
                      ? `${t('Envoyée', 'Sent', 'مرسل')}${po.sentVia ? ` (${po.sentVia})` : ''}`
                      : t('Réceptionnée', 'Received', 'مستلم');

                  const statusClass =
                    po.status === 'received'
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : po.status === 'sent'
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                      : po.status === 'confirmed'
                      ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

                  return (
                    <div
                      key={po.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {po.orderNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5">
                            {po.supplierName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {po.createdAt.slice(0, 10)} · {po.items.length} {t('réf.', 'items', 'أصناف')} ·{' '}
                            {totalCost.toLocaleString()} {currency}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deletePurchaseOrder(po.id)}
                          aria-label={t('Supprimer', 'Delete', 'حذف')}
                          className="min-h-[32px] min-w-[32px] rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {po.status !== 'received' && (
                          <button
                            type="button"
                            onClick={() => loadOrderIntoEditor(po)}
                            className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {t('Éditer', 'Edit', 'تعديل')}
                          </button>
                        )}

                        {po.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() =>
                              updatePurchaseOrder({
                                ...po,
                                status: 'confirmed',
                                confirmedAt: new Date().toISOString(),
                              })
                            }
                            className="min-h-[34px] px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {t('Confirmer', 'Confirm', 'تأكيد')}
                          </button>
                        )}

                        {(po.status === 'confirmed' || po.status === 'sent') && waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markOrderDispatched(po, 'whatsapp')}
                            className="min-h-[34px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle size={12} />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {(po.status === 'confirmed' || po.status === 'sent') && (
                          <button
                            type="button"
                            onClick={() => markPurchaseOrderReceived(po.id)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} />
                            <span>{t('Réceptionner en stock', 'Receive into Stock', 'استلام للمخزون')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIERS CONFIGURATION */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Supplier Form */}
          <form
            onSubmit={handleSaveSupplierForm}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3"
          >
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingSupplierId
                ? t('Modifier le fournisseur', 'Edit Supplier', 'تعديل بيانات المورد')
                : t('Configurer un fournisseur', 'Configure Supplier', 'إضافة مورد جديد')}
            </h2>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('Raison sociale / Nom *', 'Supplier Name *', 'اسم المورد *')}
              </label>
              <input
                type="text"
                required
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder={t('Ex: Oran Hôtel Distribution', 'e.g. Atlas Hospitality Supply', 'مثال: شركة التوريد الفندقي')}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {t('Catégorie fournie', 'Category', 'التخصص')}
                </label>
                <input
                  type="text"
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {t('Canal d’envoi préféré', 'Preferred Dispatch Channel', 'قناة الإرسال المفضلة')}
                </label>
                <select
                  value={supChannel}
                  onChange={(e) => setSupChannel(e.target.value as SupplierChannel)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {t('Téléphone / WhatsApp', 'Phone / WhatsApp', 'الهاتف / واتساب')}
                </label>
                <input
                  type="tel"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+213 550 12 34 56"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {t('Email commandes', 'Orders Email', 'البريد الإلكتروني')}
                </label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="orders@supplier.com"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('Contact commercial', 'Contact Person', 'اسم المسؤول')}
              </label>
              <input
                type="text"
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
                placeholder={t('Ex: M. Brahimi', 'e.g. Mr. Karim', 'مثال: السيد كريم')}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {t('Conditions / Notes', 'Terms / Notes', 'ملاحظات')}
              </label>
              <input
                type="text"
                value={supNotes}
                onChange={(e) => setSupNotes(e.target.value)}
                placeholder={t('Délai livraison 24h, franco à partir de...', '24h delivery...', 'التوصيل خلال 24 ساعة...')}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {editingSupplierId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplierId(null);
                    setSupName('');
                    setSupContact('');
                    setSupPhone('');
                    setSupEmail('');
                    setSupNotes('');
                  }}
                  className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Annuler', 'Cancel', 'إلغاء')}
                </button>
              )}
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                {editingSupplierId
                  ? t('Mettre à jour', 'Update Supplier', 'تحديث')
                  : t('Enregistrer fournisseur', 'Save Supplier', 'حفظ المورد')}
              </button>
            </div>
          </form>

          {/* Suppliers List */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('Fournisseurs enregistrés', 'Configured Suppliers', 'قائمة الموردين')}
              </h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">{suppliers.length}</span>
            </div>

            {suppliers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <Building2 size={28} className="mx-auto text-slate-400" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('Aucun fournisseur configuré', 'No suppliers configured', 'لا يوجد موردون مسجلون')}
                </p>
                <p>
                  {t(
                    'Ajoutez vos fournisseurs (WhatsApp, Email, SMS) pour lancer vos réapprovisionnements en 1 clic.',
                    'Add suppliers with WhatsApp, Email, or SMS contacts for 1-click purchase orders.',
                    'أضف مورديك مع رقم الواتساب أو البريد لإرسال الطلبات بنقرة واحدة.'
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{sup.name}</span>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          {sup.preferredChannel.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {sup.category}
                        {sup.contactName ? ` · ${sup.contactName}` : ''}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-wrap gap-3 mt-0.5">
                        {sup.phone && <span>{sup.phone}</span>}
                        {sup.email && <span>{sup.email}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectSupplierForPo(sup.id);
                          setActiveTab('reorder');
                        }}
                        className="min-h-[36px] px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
                      >
                        {t('Commander', 'Order', 'طلب')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditSupplier(sup)}
                        className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        {t('Éditer', 'Edit', 'تعديل')}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSupplier(sup.id)}
                        aria-label={t('Supprimer', 'Delete', 'حذف')}
                        className="min-h-[36px] min-w-[36px] rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Movement Dialog */}
      {movementModal.open && movementModal.item && (
        <div
          onClick={() => setMovementModal({ open: false, type: 'in', item: null })}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs pms-modal-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 pms-modal"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {movementModal.type === 'in'
                  ? `${t('Entrée en Stock', 'Stock In', 'إدخال مخزون')} : ${movementModal.item.name}`
                  : movementModal.type === 'out'
                  ? `${t('Sortie de Stock', 'Stock Out', 'إخراج مخزون')} : ${movementModal.item.name}`
                  : `${t('Inventaire', 'Inventory Count', 'جرد')} : ${movementModal.item.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setMovementModal({ open: false, type: 'in', item: null })}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmMovement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {movementModal.type === 'inventory'
                    ? t('Quantité réelle comptée', 'Actual Counted Quantity', 'الكمية الفعلية')
                    : `${t('Quantité', 'Quantity', 'الكمية')} (${movementModal.item.unit})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="numeric"
                  required
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Motif / Justification', 'Reason', 'السبب')}
                </label>
                <input
                  type="text"
                  required
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {movementModal.type === 'out' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Chambre / Destination', 'Room / Destination', 'الغرفة / الوجهة')}
                  </label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Ex: CV-101, PL-305..."
                    className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovementModal({ open: false, type: 'in', item: null })}
                  className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Annuler', 'Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  {t('Enregistrer', 'Save', 'حفظ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Stock Item Modal */}
      {itemModalOpen && (
        <div
          onClick={() => setItemModalOpen(false)}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs pms-modal-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 pms-modal"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingItem
                  ? t('Modifier l’article', 'Edit Stock Item', 'تعديل الصنف')
                  : t('Nouvel article en stock', 'Add Stock Item', 'إضافة صنف جديد')}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStockItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Désignation *', 'Item Name *', 'اسم الصنف *')}
                </label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('Ex: Savon d’accueil 25g', 'e.g. Guest Soap 25g', 'مثال: صابون ترحيبي')}
                  className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Catégorie', 'Category', 'الفئة')}
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Linge">Linge</option>
                    <option value="Produits de bain">Produits de bain</option>
                    <option value="Minibar">Minibar</option>
                    <option value="Entretien">Entretien</option>
                    <option value="Accueil">Accueil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Unité', 'Unit', 'الوحدة')}
                  </label>
                  <input
                    type="text"
                    required
                    value={itemForm.unit}
                    onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="pce, flacon, btl, rlx..."
                    className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {t('Quantité', 'Quantity', 'الكمية')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                    className="w-full min-h-[42px] px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {t('Seuil alerte', 'Min Alert', 'حد التنبيه')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={itemForm.minThreshold}
                    onChange={(e) => setItemForm((f) => ({ ...f, minThreshold: Number(e.target.value) }))}
                    className="w-full min-h-[42px] px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {t('Prix unit.', 'Unit Cost', 'السعر')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={itemForm.unitCost}
                    onChange={(e) => setItemForm((f) => ({ ...f, unitCost: Number(e.target.value) }))}
                    className="w-full min-h-[42px] px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {suppliers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Fournisseur préféré', 'Preferred Supplier', 'المورد المفضل')}
                  </label>
                  <select
                    value={itemForm.preferredSupplierId}
                    onChange={(e) => setItemForm((f) => ({ ...f, preferredSupplierId: e.target.value }))}
                    className="w-full min-h-[42px] px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="">{t('Aucun fournisseur assigné', 'None assigned', 'بدون مورد')}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Annuler', 'Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {t('Enregistrer', 'Save', 'حفظ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
