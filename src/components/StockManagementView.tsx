import React, { useState } from 'react';
import {
  Boxes,
  Package,
  Plus,
  Minus,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Download,
  Copy,
  Search,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StockItem } from '../types/booking';

export const StockManagementView: React.FC = () => {
  const {
    stockItems,
    stockMovements,
    addStockMovement,
    updateStockItem,
    deleteStockItem,
    language,
    currency,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'reorder'>('stock');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states for stock operations
  const [movementModal, setMovementModal] = useState<{
    open: boolean;
    type: 'in' | 'out' | 'inventory';
    item: StockItem | null;
  }>({ open: false, type: 'in', item: null });

  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [reasonInput, setReasonInput] = useState<string>('');
  const [roomInput, setRoomInput] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const categories = ['all', 'Linge', 'Produits de bain', 'Minibar', 'Entretien', 'Accueil'];

  const filteredItems = stockItems.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    }
    return true;
  });

  const lowStockItems = stockItems.filter((item) => item.quantity <= item.minThreshold);
  const totalStockValue = stockItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const handleOpenMovement = (item: StockItem, type: 'in' | 'out' | 'inventory') => {
    setMovementModal({ open: true, type, item });
    setQuantityInput(type === 'inventory' ? item.quantity : 1);
    setReasonInput(type === 'in' ? 'Réception fournisseur' : type === 'out' ? 'Sortie manuelle service' : 'Comptage physique inventaire');
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

  const exportMovementsCSV = () => {
    const rows = [
      ['Date', 'Article', 'Quantité', 'Motif', 'Chambre', 'Utilisateur'],
      ...stockMovements.map((m) => [m.timestamp, m.itemName, m.delta, m.reason, m.room || '', m.user]),
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      encodeURIComponent(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'));
    const link = document.createElement('a');
    link.href = csvContent;
    link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const copyReorderList = () => {
    const listText = lowStockItems
      .map((item) => `- ${item.name} (${item.category}): en stock ${item.quantity} ${item.unit} -> Commander: ${Math.max(item.minThreshold * 2 - item.quantity, 1)} ${item.unit}`)
      .join('\n');
    navigator.clipboard.writeText(listText || 'Aucun article à commander.');
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes size={22} className="text-blue-500" />
            <span>
              {language === 'fr'
                ? 'Stock, Économat & Consommables Hôteliers'
                : language === 'ar'
                ? 'المخزون والمستلزمات الفندقية'
                : 'Hotel Stock & Amenities Inventory'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Linge de lit, kits d’accueil de bain, produits minibar et réassorts d’étage'
              : 'Linen rotation, bathroom amenities, minibar inventory & room supplies'}
          </p>
        </div>

        {/* Global Stock Stats */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Valeur Économat</span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalStockValue.toLocaleString()} {currency}
            </span>
          </div>

          {lowStockItems.length > 0 && (
            <div className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl shadow-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase block">Alerte Seuil</span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                  {lowStockItems.length} articles bas
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'stock'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {language === 'fr' ? 'Inventaire en direct' : 'Live Inventory'}
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'movements'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {language === 'fr' ? 'Journal des mouvements' : 'Movement Ledger'}
          </button>
          <button
            onClick={() => setActiveTab('reorder')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'reorder'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {language === 'fr' ? `À réapprovisionner (${lowStockItems.length})` : `To Reorder (${lowStockItems.length})`}
          </button>
        </div>

        {activeTab === 'stock' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Chercher un article..."
                className="pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat === 'all' ? (language === 'fr' ? 'Tous' : 'All') : cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'movements' && (
          <button
            onClick={exportMovementsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <Download size={14} />
            <span>Exporter CSV</span>
          </button>
        )}

        {activeTab === 'reorder' && (
          <button
            onClick={copyReorderList}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Copy size={14} />
            <span>{copyFeedback ? '✓ Liste copiée !' : 'Copier la liste pour commande'}</span>
          </button>
        )}
      </div>

      {/* TAB 1: LIVE INVENTORY */}
      {activeTab === 'stock' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const isLow = item.quantity <= item.minThreshold;
            const progress = Math.min(100, Math.round((item.quantity / Math.max(item.minThreshold * 3, 1)) * 100));

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isLow
                    ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-300 dark:border-rose-900/50 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                      {item.name}
                    </h3>
                  </div>

                  <span
                    className={`text-base font-bold font-mono ${
                      isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {item.quantity} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                  </span>
                </div>

                {/* Progress level bar */}
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLow ? 'bg-rose-500' : progress > 50 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Seuil min: {item.minThreshold} {item.unit}</span>
                    <span>P.U: {item.unitCost.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleOpenMovement(item, 'in')}
                    className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    + Entrée
                  </button>
                  <button
                    onClick={() => handleOpenMovement(item, 'out')}
                    className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    − Sortie
                  </button>
                  <button
                    onClick={() => handleOpenMovement(item, 'inventory')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    Inventaire
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: MOVEMENT LEDGER */}
      {activeTab === 'movements' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Horodatage</th>
                  <th className="p-3">Article</th>
                  <th className="p-3">Variation</th>
                  <th className="p-3">Motif & Justificatif</th>
                  <th className="p-3">Chambre / Étage</th>
                  <th className="p-3">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-slate-400">{m.timestamp}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{m.itemName}</td>
                    <td className="p-3 font-mono font-bold">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
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
        </div>
      )}

      {/* TAB 3: REORDER LIST */}
      {activeTab === 'reorder' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Besoins de réapprovisionnement prioritaires
              </h2>
              <p className="text-xs text-slate-400">
                Articles sous le seuil minimum de sécurité pour assurer le bon fonctionnement du complexe.
              </p>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tous les niveaux de stock sont au-dessus des seuils de sécurité !
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lowStockItems.map((item) => {
                const toOrder = Math.max(item.minThreshold * 2 - item.quantity, 1);
                const estCost = toOrder * item.unitCost;

                return (
                  <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</span>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</h4>
                      <span className="text-xs text-rose-500 font-mono">
                        En stock: {item.quantity} {item.unit} (Seuil critique: {item.minThreshold})
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Quantité recommandée</span>
                        <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                          +{toOrder} {item.unit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Estimation coût</span>
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                          {estCost.toLocaleString()} {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stock Movement Dialog */}
      {movementModal.open && movementModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {movementModal.type === 'in'
                ? `Entrée en Stock : ${movementModal.item.name}`
                : movementModal.type === 'out'
                ? `Sortie de Stock : ${movementModal.item.name}`
                : `Ajustement d’inventaire : ${movementModal.item.name}`}
            </h3>

            <form onSubmit={handleConfirmMovement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {movementModal.type === 'inventory' ? 'Quantité réelle comptée' : 'Quantité (' + movementModal.item.unit + ')'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Motif / Justification</label>
                <input
                  type="text"
                  required
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Ex: Réception commande, Casse, Dotation VIP..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              {movementModal.type === 'out' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Chambre / Destination</label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Ex: CV-101, PL-305..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovementModal({ open: false, type: 'in', item: null })}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
