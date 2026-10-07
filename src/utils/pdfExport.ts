import jsPDF from 'jspdf';
import { InvoiceRecord } from '../types/booking';

export function exportInvoicePDF(doc: InvoiceRecord, lang: 'fr' | 'en' = 'fr') {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isFr = lang === 'fr';

  // Theme primary colors
  const primaryColor = doc.docType === 'invoice' ? [2, 132, 199] : doc.docType === 'quote' ? [16, 185, 129] : [139, 92, 246];

  // Document Title by type
  const docTitle =
    doc.docType === 'invoice'
      ? isFr ? 'FACTURE OFFICIELLE' : 'TAX INVOICE'
      : doc.docType === 'quote'
      ? isFr ? 'DEVIS ESTIMATIF' : 'PRICE QUOTATION'
      : isFr ? 'FACTURE PRO FORMA' : 'PRO FORMA INVOICE';

  // 1. Header Box
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, 210, 24, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('OMNIBOOK SOLUTIONS', 14, 15);

  pdf.setFontSize(12);
  pdf.text(docTitle, 210 - 14, 15, { align: 'right' });

  // 2. Company & Client Info
  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(isFr ? 'Émetteur :' : 'Issuer:', 14, 34);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text([
    'OmniBook Hospitality & Clinic SAS',
    '8 Boulevard de la Madeleine, 75009 Paris, France',
    'SIRET : 892 411 928 00014 · TVA : FR 48 892411928',
    'Contact : support@omnibook.app · Tél : +33 1 42 68 00 00',
  ], 14, 40);

  // Client Box
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(120, 30, 76, 32, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(120, 30, 76, 32, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(isFr ? 'Client / Destinataire :' : 'Bill To:', 125, 37);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text([
    doc.customerName,
    doc.customerEmail,
    doc.customerPhone || '',
    doc.customerAddress ? doc.customerAddress.substring(0, 38) : '',
  ], 125, 43);

  // 3. Document Details Metadata Bar
  pdf.setFillColor(241, 245, 249);
  pdf.rect(14, 68, 182, 12, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);

  const numLabel = isFr ? 'N° DOCUMENT' : 'DOCUMENT NO.';
  const dateLabel = isFr ? 'DATE D\'ÉMISSION' : 'ISSUE DATE';
  const dueLabel = doc.docType === 'quote' ? (isFr ? 'VALIDITÉ' : 'VALID UNTIL') : (isFr ? 'ÉCHÉANCE' : 'DUE DATE');
  const domLabel = isFr ? 'SECTEUR' : 'DOMAIN';

  pdf.text(numLabel, 18, 75);
  pdf.text(dateLabel, 70, 75);
  pdf.text(dueLabel, 120, 75);
  pdf.text(domLabel, 165, 75);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.docNumber, 18, 81);
  pdf.text(doc.issueDate, 70, 81);
  pdf.text(doc.validUntilOrDueDate, 120, 81);
  pdf.text(doc.domain.toUpperCase(), 165, 81);

  // 4. Line Items Table
  let curY = 92;
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(14, curY, 182, 8, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(isFr ? 'Désignation de la prestation / séjour' : 'Description', 18, curY + 5.5);
  pdf.text(isFr ? 'Qté' : 'Qty', 130, curY + 5.5, { align: 'center' });
  pdf.text(isFr ? 'P.U. HT' : 'Unit HT', 155, curY + 5.5, { align: 'right' });
  pdf.text(isFr ? 'Total TTC' : 'Total TTC', 190, curY + 5.5, { align: 'right' });

  curY += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 41, 59);

  doc.items.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(14, curY, 182, 8, 'F');
    }
    pdf.setDrawColor(241, 245, 249);
    pdf.line(14, curY + 8, 196, curY + 8);

    pdf.setFontSize(8.5);
    pdf.text(item.description.substring(0, 60), 18, curY + 5.5);
    pdf.text(String(item.quantity), 130, curY + 5.5, { align: 'center' });
    pdf.text(`${item.unitPrice.toFixed(2)} €`, 155, curY + 5.5, { align: 'right' });
    pdf.text(`${item.total.toFixed(2)} €`, 190, curY + 5.5, { align: 'right' });

    curY += 8;
  });

  // 5. Totals & Tax Breakdown Box
  curY += 6;
  const totX = 115;
  const valX = 190;

  pdf.setFontSize(8.5);
  pdf.text(isFr ? 'Sous-total Hors Taxes (HT) :' : 'Subtotal Excl. Tax:', totX, curY);
  pdf.text(`${doc.subtotalHT.toFixed(2)} €`, valX, curY, { align: 'right' });
  curY += 5;

  if (doc.discountAmount > 0) {
    pdf.setTextColor(220, 38, 38);
    const promoDesc = doc.discountCode ? ` (${doc.discountCode})` : '';
    pdf.text(`${isFr ? 'Remise / Promo' : 'Discount'}${promoDesc} :`, totX, curY);
    pdf.text(`- ${doc.discountAmount.toFixed(2)} €`, valX, curY, { align: 'right' });
    curY += 5;
    pdf.setTextColor(30, 41, 59);
  }

  if (doc.vatAmount > 0) {
    pdf.text(isFr ? 'TVA collectée :' : 'VAT Tax:', totX, curY);
    pdf.text(`${doc.vatAmount.toFixed(2)} €`, valX, curY, { align: 'right' });
    curY += 5;
  }

  if (doc.cityTouristTax > 0) {
    pdf.text(isFr ? 'Taxe de séjour forfaitaire :' : 'City Tourist Tax:', totX, curY);
    pdf.text(`${doc.cityTouristTax.toFixed(2)} €`, valX, curY, { align: 'right' });
    curY += 5;
  }

  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.line(totX, curY, valX + 6, curY);
  curY += 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(isFr ? 'TOTAL NET TTC :' : 'TOTAL AMOUNT DUE:', totX, curY);
  pdf.text(`${doc.totalTTC.toFixed(2)} €`, valX, curY, { align: 'right' });
  curY += 6;

  if (doc.depositPaid > 0) {
    pdf.setFontSize(9);
    pdf.setTextColor(16, 185, 129);
    pdf.text(isFr ? 'Acompte déjà versé :' : 'Deposit Paid:', totX, curY);
    pdf.text(`- ${doc.depositPaid.toFixed(2)} €`, valX, curY, { align: 'right' });
    curY += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text(isFr ? 'Reste à régler :' : 'Balance Remaining:', totX, curY);
    pdf.text(`${doc.balanceDue.toFixed(2)} €`, valX, curY, { align: 'right' });
    curY += 6;
  }

  // 6. Stamp / Status Badge
  pdf.setDrawColor(
    doc.status === 'paid' ? 16 : doc.status === 'sent' ? 2 : 139,
    doc.status === 'paid' ? 185 : doc.status === 'sent' ? 132 : 92,
    doc.status === 'paid' ? 129 : doc.status === 'sent' ? 199 : 246
  );
  pdf.setLineWidth(0.8);
  pdf.roundedRect(14, curY - 18, 48, 14, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(
    doc.status === 'paid' ? 16 : doc.status === 'sent' ? 2 : 139,
    doc.status === 'paid' ? 185 : doc.status === 'sent' ? 132 : 92,
    doc.status === 'paid' ? 129 : doc.status === 'sent' ? 199 : 246
  );

  const statusText =
    doc.status === 'paid'
      ? isFr ? '✓ PAYÉ / ACQUITTÉ' : '✓ PAID IN FULL'
      : doc.docType === 'quote'
      ? isFr ? 'DEVIS EN COURS' : 'PROPOSED QUOTE'
      : isFr ? 'EN ATTENTE RÈGLEMENT' : 'PAYMENT PENDING';

  pdf.text(statusText, 38, curY - 9, { align: 'center' });

  // 7. Payment Information & Legal Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);

  const footerY = 270;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(14, footerY, 196, footerY);

  pdf.text([
    isFr ? 'Modalités : Virement bancaire ou Carte Bancaire sécurisée · IBAN : FR76 3000 4000 5000 6000 7000 890 · BIC : BNPAFRPP' : 'Payment terms: Bank wire transfer or secure Card · IBAN: FR76 3000 4000 5000 6000 7000 890 · BIC: BNPAFRPP',
    isFr ? 'Pénalités de retard : 3 fois le taux d\'intérêt légal en vigueur · Indemnité forfaitaire de recouvrement : 40 €.' : 'Late payment interest: 3x legal rate · Fixed recovery compensation: 40 €.',
    isFr ? 'OmniBook AGENTS.md — Système certifié conforme aux normes internationales de gestion hôtelière et clinique.' : 'OmniBook AGENTS.md — Certified multi-sector hospitality and healthcare management standard.',
  ], 14, footerY + 5);

  // Trigger download
  pdf.save(`${doc.docNumber}_${doc.customerName.replace(/\s+/g, '_')}.pdf`);
}
