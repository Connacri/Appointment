import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Download,
  Filter,
  DollarSign,
  Tag,
  CheckCircle,
  Clock,
  Printer,
  Sparkles,
  Eye,
  Trash2,
  Percent,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialInvoices, initialPromos } from '../data/mockData';
import { InvoiceRecord, DocumentType, InvoiceItem } from '../types/booking';
import { exportInvoicePDF } from '../utils/pdfExport';

export const BillingInvoicingView: React.FC = () => {
  const { language, activeSector, currentDomain } = useApp();

  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    const saved = localStorage.getItem('omnibook_invoices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialInvoices;
  });

  const [filterDocType, setFilterDocType] = useState<DocumentType | 'all'>('all');
  const [filterDomain, setFilterDomain] = useState<'current' | 'all'>('current');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State for creating a new Document
  const [newDocType, setNewDocType] = useState<DocumentType>('invoice');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newSelectedPromo, setNewSelectedPromo] = useState('');
  const [newItems, setNewItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description:
        currentDomain === 'clinic'
          ? 'Consultation médicale spécialisée'
          : currentDomain === 'restaurant'
          ? 'Menu dégustation & accords mets-vins'
          : currentDomain === 'residence'
          ? 'Location meublée avec services'
          : currentDomain === 'administration'
          ? 'Frais de dossier et timbres administratifs'
          : currentDomain === 'wellness'
          ? 'Soin thermal, massage & hydrothérapie'
          : 'Prestation principale / Séjour hôtelier',
      quantity: 1,
      unitPrice: currentDomain === 'clinic' ? 75 : 120,
      vatRate: currentDomain === 'clinic' || currentDomain === 'administration' ? 0 : 10,
      total: currentDomain === 'clinic' ? 75 : 120,
    },
  ]);
  const [newDeposit, setNewDeposit] = useState<number>(0);

  // Filtered documents strictly respecting domain separation when chosen
  const filteredDocs = invoices.filter((doc) => {
    if (filterDocType !== 'all' && doc.docType !== filterDocType) return false;
    if (filterDomain === 'current' && doc.domain !== currentDomain) return false;
    return true;
  });

  // Calculate new document financials
  const subtotalHT = newItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice) / (1 + it.vatRate / 100), 0);
  const matchedPromo = initialPromos.find((p) => p.code === newSelectedPromo);
  let discountAmount = 0;
  if (matchedPromo) {
    if (matchedPromo.type === 'percent') {
      discountAmount = (subtotalHT * matchedPromo.value) / 100;
    } else {
      discountAmount = matchedPromo.value;
    }
  }

  const vatAmount = newItems.reduce((acc, it) => {
    const lineHT = (it.quantity * it.unitPrice) / (1 + it.vatRate / 100);
    return acc + lineHT * (it.vatRate / 100);
  }, 0);

  const totalTTC = Math.max(0, subtotalHT - discountAmount + vatAmount);
  const balanceDue = Math.max(0, totalTTC - newDeposit);

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    const prefix = newDocType === 'invoice' ? 'FAC' : newDocType === 'quote' ? 'DEV' : 'PRO';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const docNumber = `${prefix}-2026-${randNum}`;

    const newDoc: InvoiceRecord = {
      id: `inv_${Date.now()}`,
      docNumber,
      docType: newDocType,
      domain: currentDomain,
      customerName: newCustomerName,
      customerEmail: newCustomerEmail || 'client@example.com',
      customerPhone: newCustomerPhone,
      customerAddress: newCustomerAddress,
      issueDate: new Date().toISOString().split('T')[0],
      validUntilOrDueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      items: newItems,
      subtotalHT: Math.round(subtotalHT * 100) / 100,
      discountType: matchedPromo ? 'promo_code' : 'none',
      discountCode: matchedPromo?.code,
      discountValue: matchedPromo?.value || 0,
      discountAmount: Math.round(discountAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      cityTouristTax: 0,
      totalTTC: Math.round(totalTTC * 100) / 100,
      depositPaid: newDeposit,
      balanceDue: Math.round(balanceDue * 100) / 100,
      status: newDocType === 'invoice' && newDeposit >= totalTTC ? 'paid' : 'sent',
      termsAndNotes: 'Document généré selon les normes comptables internationales OmniBook.',
    };

    const updated = [newDoc, ...invoices];
    setInvoices(updated);
    localStorage.setItem('omnibook_invoices', JSON.stringify(updated));
    setIsCreateModalOpen(false);

    // Reset Form
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    setNewSelectedPromo('');
    setNewDeposit(0);
  };

  const getDocTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'invoice':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {language === 'fr' ? 'Facture' : 'Invoice'}
          </span>
        );
      case 'quote':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {language === 'fr' ? 'Devis' : 'Quote'}
          </span>
        );
      case 'proforma':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            {language === 'fr' ? 'Pro Forma' : 'Pro Forma'}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {language === 'fr'
                ? 'Gestion de la Facturation, Devis & Pro Forma'
                : 'Invoicing, Quotations & Pro Forma Management'}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
              Certifié NF525 & USALI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Émission de devis, factures d\'acompte, soldes, application de promotions et export PDF officiel'
              : 'Issue estimates, invoices, pro forma receipts, apply promo discounts and export certified PDF folios'}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors self-start md:self-auto"
        >
          <Plus size={16} />
          <span>
            {language === 'fr' ? '+ Nouveau Devis / Facture' : '+ New Quote / Invoice'}
          </span>
        </button>
      </div>

      {/* Promotions & Offers Highlights Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-900/10 via-emerald-900/10 to-purple-900/10 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Tag size={20} className="text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs block">
              {language === 'fr' ? 'Offres & Codes Promo Actifs :' : 'Active Promotional Offers:'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'fr'
                ? 'Ces remises s\'appliquent directement lors de la création d\'un devis ou d\'une facture.'
                : 'These discounts can be applied directly when building quotes or invoices.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {initialPromos.map((pr) => (
            <div
              key={pr.code}
              className="px-2.5 py-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {pr.code}
              </span>
              <span className="text-[10px] text-slate-400">
                ({pr.type === 'percent' ? `-${pr.value}%` : `-${pr.value}€`})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
        {/* Document Type Tabs */}
        <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setFilterDocType('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterDocType === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Tous ({invoices.length})
          </button>
          <button
            onClick={() => setFilterDocType('invoice')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterDocType === 'invoice'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Factures
          </button>
          <button
            onClick={() => setFilterDocType('quote')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterDocType === 'quote'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Devis
          </button>
          <button
            onClick={() => setFilterDocType('proforma')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterDocType === 'proforma'
                ? 'bg-purple-600 text-white'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Pro Forma
          </button>
        </div>

        {/* Domain Scope Filter: never mix domains unless user explicitly clicks All */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start md:self-auto">
          <span className="text-[11px] text-slate-400 px-1 font-normal">Domaine :</span>
          <button
            onClick={() => setFilterDomain('current')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterDomain === 'current'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {currentDomain.toUpperCase()} (Actif)
          </button>
          <button
            onClick={() => setFilterDomain('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterDomain === 'all'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tous les domaines
          </button>
        </div>
      </div>

      {/* Invoices & Quotes Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-slate-850 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">N° Document</th>
                <th className="py-3 px-4">Domaine</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Client / Usager</th>
                <th className="py-3 px-4">Date Émission</th>
                <th className="py-3 px-4">Échéance / Validité</th>
                <th className="py-3 px-4 text-right">Total TTC</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    {doc.docNumber}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase font-mono">
                      {doc.domain}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getDocTypeBadge(doc.docType)}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {doc.customerName}
                    </div>
                    <div className="text-[11px] text-slate-400">{doc.customerEmail}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{doc.issueDate}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{doc.validUntilOrDueDate}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {doc.totalTTC.toFixed(2)} €
                    {doc.discountAmount > 0 && (
                      <span className="block text-[10px] text-rose-500 font-normal">
                        (-{doc.discountAmount}€ promo)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : doc.status === 'sent'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {doc.status === 'paid' ? 'Payé' : doc.status === 'sent' ? 'Envoyé' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => exportInvoicePDF(doc, 'fr')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded font-medium flex items-center gap-1 transition-colors"
                        title="Télécharger PDF (FR)"
                      >
                        <Download size={13} />
                        <span>PDF (FR)</span>
                      </button>
                      <button
                        onClick={() => exportInvoicePDF(doc, 'en')}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium text-slate-700 dark:text-slate-200 transition-colors"
                        title="Download PDF in English (EN)"
                      >
                        EN
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Document */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                Émettre un Devis, Facture ou Pro Forma
              </span>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Document Type */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Type de document comptable :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDocType('invoice')}
                    className={`py-2 rounded-lg border font-semibold ${
                      newDocType === 'invoice'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Facture
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDocType('quote')}
                    className={`py-2 rounded-lg border font-semibold ${
                      newDocType === 'quote'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Devis (Quote)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDocType('proforma')}
                    className={`py-2 rounded-lg border font-semibold ${
                      newDocType === 'proforma'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Facture Pro Forma
                  </button>
                </div>
              </div>

              {/* Client Details */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Coordonnées du client :
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom complet ou Société *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="email"
                    placeholder="E-mail (pour envoi PDF)"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    className="h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Adresse de facturation (ex: 15 Rue de la Paix, Paris)"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Line Items */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Lignes de prestations :</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewItems([
                        ...newItems,
                        { id: String(Date.now()), description: 'Option / Service supplémentaire', quantity: 1, unitPrice: 50, vatRate: 10, total: 50 },
                      ])
                    }
                    className="text-blue-600 dark:text-blue-400 font-semibold"
                  >
                    + Ajouter une ligne
                  </button>
                </div>

                {newItems.map((it, idx) => (
                  <div key={it.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={it.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewItems(newItems.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                      }}
                      className="col-span-6 h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px]"
                    />
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value) || 1;
                        setNewItems(newItems.map((item, i) => (i === idx ? { ...item, quantity: q, total: q * item.unitPrice } : item)));
                      }}
                      className="col-span-2 h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-center"
                    />
                    <input
                      type="number"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) => {
                        const p = Number(e.target.value) || 0;
                        setNewItems(newItems.map((item, i) => (i === idx ? { ...item, unitPrice: p, total: item.quantity * p } : item)));
                      }}
                      className="col-span-3 h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-right font-mono"
                    />
                    {newItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                        className="col-span-1 text-rose-500 hover:text-rose-700 text-center"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Promo Code & Discount Selection */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Appliquer une Promotion ou Réduction :
                </label>
                <select
                  value={newSelectedPromo}
                  onChange={(e) => setNewSelectedPromo(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                >
                  <option value="">Aucune réduction</option>
                  {initialPromos.map((pr) => (
                    <option key={pr.code} value={pr.code}>
                      Code {pr.code} : {pr.title[language] || pr.title.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Financial Recap Box */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Sous-total HT :</span>
                  <span>{subtotalHT.toFixed(2)} €</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Remise ({newSelectedPromo}) :</span>
                    <span>- {discountAmount.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>TVA estimée :</span>
                  <span>{vatAmount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1">
                  <span>TOTAL NET TTC :</span>
                  <span>{totalTTC.toFixed(2)} €</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Générer le Document & Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
