/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * InvoicePreviewModal
 * Visualisation et impression haute fidélité des Factures, Devis et Pro Formas.
 * Intègre dynamiquement :
 * - Le logo personnalisé de l'hôtel (uploadé ou blason sélectionné)
 * - Les coordonnées complètes de l'établissement
 * - Les mentions fiscales officielles (NIF, RC, NIS, Article d'Imposition)
 * - Les coordonnées bancaires (RIB / IBAN / SWIFT)
 * - Le détail complet des prestations, TVA, remises et acomptes
 * - Mode impression direct (CSS @media print) et export PDF officiel
 */

import React, { useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Building2,
  Calendar,
  Mail,
  Phone,
  Globe,
  MapPin,
  CheckCircle2,
  Clock,
  Landmark,
  ShieldCheck,
  Star,
  FileText,
  Percent,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { InvoiceRecord } from '../types/booking';
import { useApp } from '../context/AppContext';
import { exportInvoicePDF } from '../utils/pdfExport';
import { playClickFeedback, playSuccessFeedback } from '../utils/audioFeedback';

interface InvoicePreviewModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEditEstablishment?: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onEditEstablishment,
}) => {
  const { establishmentProfile, currency } = useApp();
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const profile = establishmentProfile;
  const isInvoice = invoice.docType === 'invoice';
  const isQuote = invoice.docType === 'quote';
  const isProforma = invoice.docType === 'proforma';

  const docTypeName = isInvoice
    ? 'FACTURE OFFICIELLE'
    : isQuote
    ? 'DEVIS ESTIMATIF'
    : 'FACTURE PRO FORMA';

  const docTypeColor = isInvoice
    ? 'from-blue-600 to-indigo-700 text-blue-600'
    : isQuote
    ? 'from-emerald-600 to-teal-700 text-emerald-600'
    : 'from-purple-600 to-indigo-700 text-purple-600';

  const handlePrint = () => {
    playClickFeedback();
    window.print();
  };

  const handleDownloadPDF = (lang: 'fr' | 'en') => {
    playSuccessFeedback();
    exportInvoicePDF(invoice, lang, profile);
  };

  const activeCurrency = invoice.currency || profile.defaultCurrency || currency || 'DA';

  const formatMoney = (val: number) => {
    return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeCurrency}`;
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${docTypeColor}`}>
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Aperçu Document : {invoice.docNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isInvoice
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : isQuote
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  }`}
                >
                  {isInvoice ? 'Facture' : isQuote ? 'Devis' : 'Pro Forma'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Établissement : <strong className="text-slate-700 dark:text-slate-300">{profile.name}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {onEditEstablishment && (
              <button
                type="button"
                onClick={() => {
                  playClickFeedback();
                  onEditEstablishment();
                }}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Modifier les coordonnées & logo de l'hôtel"
              >
                <Settings2 size={13} />
                <span className="hidden sm:inline">Coordonnées Hôtel</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer size={13} />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPDF('fr')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download size={13} />
              <span>PDF Officiel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport containing the Invoice Sheet */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center bg-slate-200/60 dark:bg-slate-950">
          {/* ========================================================================= */}
          {/* THE PRINTABLE INVOICE SHEET (A4 Standard Aspect & Luxury Executive Design) */}
          {/* ========================================================================= */}
          <div
            ref={printAreaRef}
            id="printable-invoice-sheet"
            className="w-full max-w-3xl bg-white text-slate-900 shadow-xl rounded-2xl p-6 sm:p-10 text-xs leading-relaxed border border-slate-200 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:rounded-none"
          >
            {/* Header: Hotel Brand & Document Type Banner */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-6 border-b-2 border-slate-800">
              {/* Hotel Identity Block */}
              <div className="flex items-start gap-4">
                {profile.logoUrl ? (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-slate-200 flex items-center justify-center p-1.5 shrink-0 bg-white shadow-xs overflow-hidden">
                    <img
                      src={profile.logoUrl}
                      alt={profile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Building2 size={36} />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                      {profile.name}
                    </h1>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: profile.stars || 4 }).map((_, i) => (
                      <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-[11px] font-semibold text-slate-600 ml-1">
                      {profile.typeLabel || 'Établissement Hôtelier'}
                    </span>
                  </div>

                  {profile.slogan && (
                    <p className="text-[11px] italic text-slate-500">
                      « {profile.slogan} »
                    </p>
                  )}

                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                    <p className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span>{profile.address}, {profile.postalCode} {profile.city} ({profile.country})</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      <span>{profile.phone} {profile.phoneSecondary ? `· Mob: ${profile.phoneSecondary}` : ''}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      <span>{profile.email} {profile.website ? `· ${profile.website}` : ''}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Header Badge */}
              <div className="text-left sm:text-right space-y-2 shrink-0">
                <div
                  className={`inline-block px-3 py-1.5 rounded-xl font-black text-sm tracking-wider uppercase ${
                    isInvoice
                      ? 'bg-blue-600 text-white'
                      : isQuote
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {docTypeName}
                </div>

                <div className="space-y-0.5 text-[11px]">
                  <p>
                    <span className="text-slate-500">N° Référence :</span>{' '}
                    <strong className="font-mono text-sm text-slate-900">{invoice.docNumber}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Date d'émission :</span>{' '}
                    <strong className="text-slate-800">{invoice.issueDate}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">
                      {isQuote ? 'Valide jusqu\'au :' : 'Échéance règlement :'}
                    </span>{' '}
                    <strong className="text-slate-800">{invoice.validUntilOrDueDate}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Statut :</span>{' '}
                    <span
                      className={`font-bold uppercase ${
                        invoice.status === 'paid'
                          ? 'text-emerald-700'
                          : invoice.status === 'sent'
                          ? 'text-blue-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {invoice.status === 'paid' ? '✓ Règlement Acquitté' : invoice.status === 'sent' ? 'Émis / Envoyé' : 'Brouillon'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Client / Bill To Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-slate-200">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                  Destinataire / Facturé à :
                </span>
                <p className="font-extrabold text-sm text-slate-900">{invoice.customerName}</p>
                {invoice.customerAddress && (
                  <p className="text-[11px] text-slate-600 mt-1">{invoice.customerAddress}</p>
                )}
                {invoice.customerEmail && (
                  <p className="text-[11px] text-slate-600 mt-0.5">{invoice.customerEmail}</p>
                )}
                {invoice.customerPhone && (
                  <p className="text-[11px] text-slate-600 mt-0.5">Tél : {invoice.customerPhone}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px]">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Conditions & Prestations :
                </span>
                <p>
                  <span className="text-slate-500">Secteur :</span>{' '}
                  <strong className="capitalize text-slate-800">{invoice.domain === 'hotel' ? 'Hôtellerie' : 'Resort & Complexe'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Devise de transaction :</span>{' '}
                  <strong className="font-mono text-slate-900">{activeCurrency}</strong>
                </p>
                {invoice.termsAndNotes && (
                  <p className="text-slate-500 italic mt-1">« {invoice.termsAndNotes} »</p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 rounded-l-lg font-bold">Désignation de la prestation / chambre</th>
                      <th className="py-2.5 px-2 text-center font-bold">Qté</th>
                      <th className="py-2.5 px-3 text-right font-bold">P.U. HT</th>
                      <th className="py-2.5 px-2 text-center font-bold">TVA</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right font-bold">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {item.description}
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500">
                          {item.vatRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t-2 border-slate-200">
              {/* Payment Details & Bank Coordinates */}
              <div className="w-full sm:w-1/2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Landmark size={14} className="text-blue-600" />
                  <span>Règlement par Virement Bancaire :</span>
                </div>
                {profile.bankName && (
                  <p>
                    <span className="text-slate-500">Banque :</span>{' '}
                    <strong className="text-slate-800">{profile.bankName}</strong>
                  </p>
                )}
                {profile.bankAccountRib && (
                  <p>
                    <span className="text-slate-500">RIB / IBAN :</span>{' '}
                    <strong className="font-mono text-slate-900">{profile.bankAccountRib}</strong>
                  </p>
                )}
                {profile.bankSwift && (
                  <p>
                    <span className="text-slate-500">BIC / SWIFT :</span>{' '}
                    <strong className="font-mono text-slate-900">{profile.bankSwift}</strong>
                  </p>
                )}
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                  Mentionner la référence <strong>{invoice.docNumber}</strong> lors de l'ordre de virement.
                </p>
              </div>

              {/* Totals Table */}
              <div className="w-full sm:w-5/12 space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Sous-total Hors Taxes (HT) :</span>
                  <span className="font-mono font-bold text-slate-800">{formatMoney(invoice.subtotalHT)}</span>
                </div>

                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Percent size={12} />
                      <span>Remise {invoice.discountCode ? `(${invoice.discountCode})` : ''} :</span>
                    </span>
                    <span className="font-mono">- {formatMoney(invoice.discountAmount)}</span>
                  </div>
                )}

                {invoice.vatAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>TVA collectée :</span>
                    <span className="font-mono text-slate-800">{formatMoney(invoice.vatAmount)}</span>
                  </div>
                )}

                {invoice.cityTouristTax > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Taxe de séjour :</span>
                    <span className="font-mono text-slate-800">{formatMoney(invoice.cityTouristTax)}</span>
                  </div>
                )}

                <div className="flex justify-between py-2.5 px-3 bg-slate-900 text-white rounded-xl font-extrabold text-sm shadow-xs">
                  <span>TOTAL TTC :</span>
                  <span className="font-mono">{formatMoney(invoice.totalTTC)}</span>
                </div>

                {invoice.depositPaid > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700 font-semibold">
                    <span>Acompte déjà versé :</span>
                    <span className="font-mono">- {formatMoney(invoice.depositPaid)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 text-slate-900 font-black text-sm">
                  <span>NET À PAYER :</span>
                  <span className="font-mono text-blue-700">{formatMoney(invoice.balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* Legal, Fiscal & Signatures Footer */}
            <div className="mt-8 pt-6 border-t-2 border-slate-200 space-y-4">
              {/* Fiscal Identification Numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                {profile.taxNumber && (
                  <p>
                    <span className="font-bold text-slate-700">NIF :</span> {profile.taxNumber}
                  </p>
                )}
                {profile.tradeRegisterNumber && (
                  <p>
                    <span className="font-bold text-slate-700">RC :</span> {profile.tradeRegisterNumber}
                  </p>
                )}
                {profile.statisticalIdNumber && (
                  <p>
                    <span className="font-bold text-slate-700">NIS :</span> {profile.statisticalIdNumber}
                  </p>
                )}
                {profile.taxArticleNumber && (
                  <p>
                    <span className="font-bold text-slate-700">Art. Imp. :</span> {profile.taxArticleNumber}
                  </p>
                )}
              </div>

              {/* Stamp and signature area */}
              <div className="flex justify-between items-end pt-2">
                <div className="text-[10px] text-slate-400 max-w-sm space-y-0.5">
                  <p>Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur.</p>
                  <p>Indemnité forfaitaire de recouvrement pour frais de gestion : 40 {activeCurrency}.</p>
                  <p className="font-semibold text-slate-500">
                    Document officiel édité par le logiciel de gestion OmniBook Hospitality.
                  </p>
                </div>

                <div className="w-48 h-24 border-2 border-dashed border-slate-300 rounded-xl p-2 flex flex-col justify-between text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Cachet & Signature de l'Établissement
                  </span>
                  {invoice.status === 'paid' && (
                    <div className="inline-block py-1 px-2 border-2 border-emerald-600 text-emerald-700 font-extrabold text-xs uppercase rotate-[-6deg] rounded-lg tracking-wider mx-auto">
                      ✓ ACQUITTÉ
                    </div>
                  )}
                  <span className="text-[9px] text-slate-400">{profile.city}, le {invoice.issueDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
