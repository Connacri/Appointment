import React, { useEffect, useRef, useState } from 'react';
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
  Building2,
  Settings2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialInvoices, initialPromos } from '../data/mockData';
import { InvoiceRecord, DocumentType, InvoiceItem } from '../types/booking';
import { exportInvoicePDF } from '../utils/pdfExport';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { playClickFeedback } from '../utils/audioFeedback';

export const BillingInvoicingView: React.FC = () => {
  const { language, activeSector, currentDomain, establishmentProfile, setIsEstablishmentModalOpen, currency } = useApp();
  const activeCurrency = establishmentProfile.defaultCurrency || currency || 'DA';

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
        currentDomain === 'resort'
          ? 'Séjour Villa Resort & Expérience Premium'
          : 'Prestation d\'Hébergement / Séjour hôtelier',
      quantity: 1,
      unitPrice: currentDomain === 'resort' ? 320 : 120,
      vatRate: 10,
      total: currentDomain === 'resort' ? 320 : 120,
    },
  ]);
  const [newDeposit, setNewDeposit] = useState<number>(0);

  // Filtered documents strictly respecting domain separation when chosen
  const filteredDocs = invoices.filter((doc) => {
    if (filterDocType !== 'all' && doc.docType !== filterDocType) return false;
    if (filterDomain === 'current' && doc.domain !== currentDomain) return false;
    return true;
  });

  const scopedInvoices = filteredDocs.filter(doc => doc.docType === 'invoice');
  const paidInvoices = scopedInvoices.filter(doc => doc.status === 'paid');
  const pendingInvoices = scopedInvoices.filter(doc => ['sent', 'overdue', 'accepted'].includes(doc.status));
  const sumByCurrency = (docs: InvoiceRecord[], field: 'totalTTC' | 'depositPaid' | 'balanceDue') => {
    const totals = docs.reduce((result, doc) => {
      const code = doc.currency || activeCurrency;
      result[code] = (result[code] || 0) + (doc[field] || 0);
      return result;
    }, {} as Record<string, number>);
    return Object.entries(totals).map(([code, amount]) => {
      const normalized = code === 'DA' ? 'DZD' : code;
      try {
        return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : language === 'ar' ? 'ar-DZ' : 'en', {
          style: 'currency', currency: normalized, maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        return `${Math.round(amount).toLocaleString()} ${code}`;
      }
    }).join(' · ') || `0 ${activeCurrency}`;
  };
  const invoicedTotal = sumByCurrency(scopedInvoices, 'totalTTC');
  const collectedTotal = sumByCurrency(scopedInvoices, 'depositPaid');
  const dueTotal = sumByCurrency(scopedInvoices, 'balanceDue');
  const monthlyDocumentCounts = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      label: new Intl.DateTimeFormat(language === 'fr' ? 'fr-DZ' : language === 'ar' ? 'ar-DZ' : 'en', { month: 'short' }).format(date),
      count: filteredDocs.filter(doc => doc.issueDate?.slice(0, 7) === key).length,
    };
  });
  const maxMonthlyDocuments = Math.max(1, ...monthlyDocumentCounts.map(item => item.count));

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

  // Dialog: focus handoff, Escape to close and body scroll lock while open.
  const createDialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateModalOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    createDialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateModalOpen]);

  const fieldClass =
    'h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';
  const fieldLabelClass = 'mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

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
      currency: activeCurrency,
      totalTTC: Math.round(totalTTC * 100) / 100,
      depositPaid: newDeposit,
      balanceDue: Math.round(balanceDue * 100) / 100,
      status: newDocType === 'invoice' && newDeposit >= totalTTC ? 'paid' : 'sent',
      termsAndNotes: 'Document généré selon les normes comptables internationales Appointment.',
    };

    const updated = [newDoc, ...invoices];
    setInvoices(updated);
    localStorage.setItem('omnibook_invoices', JSON.stringify(updated));
    setIsCreateModalOpen(false);

    // Reset Form
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerPhone('');
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
    <div className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {language === 'fr'
                ? 'Facturation, Devis & Pro Forma'
                : 'Invoicing & Quotations'}
            </h1>
            <span className="hidden sm:inline text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              · NF525 & USALI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            {language === 'fr'
              ? 'Émission de devis, factures, acomptes et export PDF officiel'
              : 'Issue estimates, invoices, pro forma receipts, and export official folios'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClickFeedback();
              setIsEstablishmentModalOpen(true);
            }}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Coordonnées & logo de l'établissement"
          >
            {establishmentProfile.logoUrl ? (
              <img
                src={establishmentProfile.logoUrl}
                alt="Logo"
                className="w-4 h-4 object-contain rounded shrink-0"
              />
            ) : (
              <Building2 size={14} className="text-blue-600" />
            )}
            <span className="truncate max-w-[120px] sm:max-w-[180px]">
              {establishmentProfile.name || 'Établissement'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">
              {language === 'fr' ? '+ Nouveau Document' : '+ New Document'}
            </span>
            <span className="sm:hidden">{language === 'fr' ? 'Nouveau' : 'New'}</span>
          </button>
        </div>
      </div>

      {/* Promotions & Offers Highlights Banner (Desktop only or compact) */}
      <div className="hidden sm:flex p-3 bg-gradient-to-r from-blue-900/10 via-emerald-900/10 to-purple-900/10 border border-slate-200 dark:border-slate-800 rounded-xl items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
            {language === 'fr' ? 'Codes Promo applicables :' : 'Promo Codes:'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {initialPromos.map((pr) => (
            <div
              key={pr.code}
              className="px-2 py-0.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] flex items-center gap-1 shadow-2xs"
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

      {/* Analytics overview — derived only from the currently scoped documents */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {[
            { label: language === 'fr' ? 'Factures émises' : language === 'ar' ? 'الفواتير الصادرة' : 'Issued invoices', value: scopedInvoices.length, detail: language === 'fr' ? 'Documents comptables' : 'Accounting documents', icon: FileText, tone: 'blue' },
            { label: language === 'fr' ? 'Montant facturé' : language === 'ar' ? 'إجمالي الفواتير' : 'Invoiced amount', value: invoicedTotal, detail: language === 'fr' ? 'Total TTC, par devise' : 'Gross total, by currency', icon: CreditCard, tone: 'purple' },
            { label: language === 'fr' ? 'Encaissé' : language === 'ar' ? 'المحصل' : 'Collected', value: collectedTotal, detail: language === 'fr' ? 'Acomptes et paiements enregistrés' : 'Recorded deposits and payments', icon: CheckCircle, tone: 'green' },
            { label: language === 'fr' ? 'Reste à encaisser' : language === 'ar' ? 'المتبقي للتحصيل' : 'Outstanding', value: dueTotal, detail: language === 'fr' ? `${pendingInvoices.length} facture(s) non soldée(s)` : `${pendingInvoices.length} unpaid invoice(s)`, icon: Clock, tone: 'amber' },
          ].map((item) => (
            <div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className={`rounded-lg p-2 ${item.tone === 'green' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : item.tone === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' : item.tone === 'purple' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'}`}>
                  <item.icon size={17} />
                </span>
              </div>
              <div className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{item.value}</div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{language === 'fr' ? 'Activité documentaire' : language === 'ar' ? 'نشاط المستندات' : 'Document activity'}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{language === 'fr' ? 'Nombre de devis, factures et pro forma par mois (6 derniers mois)' : 'Quotes, invoices and pro forma documents per month (last 6 months)'}</p>
          </div>
          {filteredDocs.length ? (
            <div className="flex h-36 items-end gap-2 sm:gap-4">
              {monthlyDocumentCounts.map(item => (
                <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold tabular-nums text-slate-500">{item.count}</span>
                  <div className="flex h-24 w-full items-end overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-800">
                    <div className="w-full rounded-t-md bg-blue-500 transition-all" style={{ height: `${item.count ? Math.max(5, item.count / maxMonthlyDocuments * 100) : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-xs text-slate-500">{language === 'fr' ? 'Aucun document correspondant aux filtres.' : 'No documents match the selected filters.'}</p>
          )}
        </div>
      </section>

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
              {filteredDocs.map((doc) => {
                const docCurr = doc.currency || activeCurrency;
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-850/60 transition-colors group cursor-pointer"
                    onClick={() => {
                      playClickFeedback();
                      setSelectedInvoice(doc);
                    }}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
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
                      {doc.totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {docCurr}
                      {doc.discountAmount > 0 && (
                        <span className="block text-[10px] text-rose-500 font-normal">
                          (-{doc.discountAmount} {docCurr} promo)
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
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            playClickFeedback();
                            setSelectedInvoice(doc);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Aperçu & Impression du document officiel"
                        >
                          <Eye size={13} />
                          <span>Aperçu</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickFeedback();
                            exportInvoicePDF(doc, 'fr', establishmentProfile);
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Télécharger PDF officiel (FR)"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickFeedback();
                            exportInvoicePDF(doc, 'en', establishmentProfile);
                          }}
                          className="px-2 py-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Download PDF in English (EN)"
                        >
                          EN
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Document */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/60 p-0 pms-modal-backdrop backdrop-blur-xs sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <form
            ref={createDialogRef}
            onSubmit={handleCreateDocument}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-create-title"
            tabIndex={-1}
            className="pms-dialog-panel pms-modal pms-sheet my-0 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white text-xs shadow-2xl outline-none dark:bg-slate-900 sm:my-auto sm:max-h-[90dvh] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 pb-3 pt-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:pb-4 sm:pt-5">
              <div className="min-w-0">
                <h2 id="billing-create-title" className="text-sm font-bold leading-tight text-slate-900 dark:text-white sm:text-base">
                  Émettre un Devis, Facture ou Pro Forma
                </h2>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Renseignez le client et les prestations, puis enregistrez le document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Fermer la fenêtre"
                className="-me-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              {/* Document Type */}
              <div>
                <span
                  id="billing-doc-type-label"
                  className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                >
                  Type de document comptable
                </span>
                <div role="group" aria-labelledby="billing-doc-type-label" className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    aria-pressed={newDocType === 'invoice'}
                    onClick={() => setNewDocType('invoice')}
                    className={`min-h-11 rounded-xl border px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                      newDocType === 'invoice'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    Facture
                  </button>
                  <button
                    type="button"
                    aria-pressed={newDocType === 'quote'}
                    onClick={() => setNewDocType('quote')}
                    className={`min-h-11 rounded-xl border px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                      newDocType === 'quote'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    Devis
                  </button>
                  <button
                    type="button"
                    aria-pressed={newDocType === 'proforma'}
                    onClick={() => setNewDocType('proforma')}
                    className={`min-h-11 rounded-xl border px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      newDocType === 'proforma'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    Pro forma
                  </button>
                </div>
              </div>

              {/* Client Details */}
              <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <span className="block font-bold text-slate-900 dark:text-white">Coordonnées du client</span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="billing-customer-name" className={fieldLabelClass}>
                      Nom ou société *
                    </label>
                    <input
                      id="billing-customer-name"
                      type="text"
                      required
                      autoComplete="organization"
                      placeholder="Nom complet ou société"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-customer-email" className={fieldLabelClass}>
                      E-mail
                    </label>
                    <input
                      id="billing-customer-email"
                      type="email"
                      autoComplete="email"
                      placeholder="client@exemple.com"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-customer-phone" className={fieldLabelClass}>
                      Téléphone
                    </label>
                    <input
                      id="billing-customer-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+213 00 00 00 00"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-customer-address" className={fieldLabelClass}>
                      Adresse de facturation
                    </label>
                    <input
                      id="billing-customer-address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="15 Rue de la Paix, Paris"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">Lignes de prestations</span>
                  <button
                    type="button"
                    onClick={() => {
                      playClickFeedback();
                      setNewItems([
                        ...newItems,
                        { id: String(Date.now()), description: 'Option / Service supplémentaire', quantity: 1, unitPrice: 50, vatRate: 10, total: 50 },
                      ]);
                    }}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:text-blue-400 dark:hover:bg-blue-950/40 sm:min-h-9"
                  >
                    <Plus size={14} />
                    Ajouter une ligne
                  </button>
                </div>

                <div className="hidden items-center gap-1.5 pb-0.5 sm:grid sm:grid-cols-12">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:col-span-4">
                    Description
                  </span>
                  <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:col-span-2">
                    Qté
                  </span>
                  <span className="text-end text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:col-span-3">
                    P.U. ({activeCurrency})
                  </span>
                  <span className="text-end text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:col-span-2">
                    Total
                  </span>
                  <span className="sm:col-span-1" />
                </div>

                {newItems.map((it, idx) => (
                  <div
                    key={it.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-12 sm:items-center sm:gap-1.5">
                      <div className="col-span-2 sm:col-span-4">
                        <label htmlFor={`line-description-${it.id}`} className={`${fieldLabelClass} sm:sr-only`}>
                          Description
                        </label>
                        <input
                          id={`line-description-${it.id}`}
                          type="text"
                          value={it.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewItems(newItems.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                          }}
                          className={`${fieldClass} sm:h-9 sm:rounded-lg sm:text-[11px]`}
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label htmlFor={`line-quantity-${it.id}`} className={`${fieldLabelClass} sm:sr-only`}>
                          Qté
                        </label>
                        <input
                          id={`line-quantity-${it.id}`}
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={it.quantity}
                          onChange={(e) => {
                            const q = Number(e.target.value) || 1;
                            setNewItems(newItems.map((item, i) => (i === idx ? { ...item, quantity: q, total: q * item.unitPrice } : item)));
                          }}
                          className={`${fieldClass} text-center tabular-nums sm:h-9 sm:rounded-lg sm:text-[11px]`}
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <label htmlFor={`line-unit-price-${it.id}`} className={`${fieldLabelClass} sm:sr-only`}>
                          P.U. ({activeCurrency})
                        </label>
                        <input
                          id={`line-unit-price-${it.id}`}
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={it.unitPrice}
                          onChange={(e) => {
                            const p = Number(e.target.value) || 0;
                            setNewItems(newItems.map((item, i) => (i === idx ? { ...item, unitPrice: p, total: item.quantity * p } : item)));
                          }}
                          className={`${fieldClass} text-end tabular-nums sm:h-9 sm:rounded-lg sm:text-[11px]`}
                        />
                      </div>
                      <div className={`${newItems.length > 1 ? 'col-span-1' : 'col-span-2'} sm:col-span-2`}>
                        <span className={`${fieldLabelClass} sm:sr-only`}>Total</span>
                        <div className="flex h-11 items-center justify-end rounded-xl bg-slate-100 px-2 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:h-9 sm:justify-start sm:bg-transparent sm:px-0 sm:text-[11px]">
                          {(it.quantity * it.unitPrice).toFixed(2)}
                        </div>
                      </div>
                      {newItems.length > 1 && (
                        <div className="col-span-1 sm:col-span-1">
                          <button
                            type="button"
                            onClick={() => {
                              playClickFeedback();
                              setNewItems(newItems.filter((_, i) => i !== idx));
                            }}
                            aria-label={`Supprimer la ligne ${idx + 1}`}
                            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 sm:h-9 sm:w-9 sm:border-0"
                          >
                            <Trash2 size={15} />
                            <span className="sm:hidden">Supprimer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Promo Code & Discount Selection */}
              <div className="space-y-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <label htmlFor="billing-promo" className={fieldLabelClass}>
                  Promotion ou réduction
                </label>
                <select
                  id="billing-promo"
                  value={newSelectedPromo}
                  onChange={(e) => setNewSelectedPromo(e.target.value)}
                  className={fieldClass}
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
              <div className="space-y-1.5 rounded-xl bg-slate-100 p-3 tabular-nums dark:bg-slate-800 sm:p-4">
                <div className="flex items-baseline justify-between gap-3 text-slate-500 dark:text-slate-400">
                  <span>Sous-total HT</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {subtotalHT.toFixed(2)} {activeCurrency}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-baseline justify-between gap-3 text-rose-600 dark:text-rose-400">
                    <span>Remise ({newSelectedPromo})</span>
                    <span className="font-medium">- {discountAmount.toFixed(2)} {activeCurrency}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 text-slate-500 dark:text-slate-400">
                  <span>TVA estimée</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {vatAmount.toFixed(2)} {activeCurrency}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                  <span>Total net TTC</span>
                  <span>{totalTTC.toFixed(2)} {activeCurrency}</span>
                </div>
              </div>
            </div>

            {/* Sticky actions */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-3 pt-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:pb-4">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-xs sm:hidden">
                <span className="text-slate-500 dark:text-slate-400">Total TTC</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {totalTTC.toFixed(2)} {activeCurrency}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 sm:w-auto"
                >
                  Créer et enregistrer
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* High-Fidelity Official Document Preview & Print Modal */}
      <InvoicePreviewModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onEditEstablishment={() => setIsEstablishmentModalOpen(true)}
      />
    </div>
  );
};
