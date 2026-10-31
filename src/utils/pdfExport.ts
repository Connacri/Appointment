import jsPDF from 'jspdf';
import { InvoiceRecord } from '../types/booking';
import { EstablishmentProfile, DEFAULT_ESTABLISHMENT_PROFILE } from '../types/establishment';

export function exportInvoicePDF(
  doc: InvoiceRecord,
  lang: 'fr' | 'en' = 'fr',
  establishmentProfile?: EstablishmentProfile
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const profile = establishmentProfile || DEFAULT_ESTABLISHMENT_PROFILE;
  const isFr = lang === 'fr';
  const currencySymbol = doc.currency || profile.defaultCurrency || 'DA';

  const formatAmount = (val: number) => {
    return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`;
  };

  // Primary palette based on document type
  const primaryColor =
    doc.docType === 'invoice'
      ? [30, 58, 138] // Navy Blue / Prestige
      : doc.docType === 'quote'
      ? [5, 150, 105] // Emerald
      : [109, 40, 217]; // Purple / Violet

  // Document Title by type
  const docTitle =
    doc.docType === 'invoice'
      ? isFr ? 'FACTURE OFFICIELLE' : 'TAX INVOICE'
      : doc.docType === 'quote'
      ? isFr ? 'DEVIS ESTIMATIF' : 'PRICE QUOTATION'
      : isFr ? 'FACTURE PRO FORMA' : 'PRO FORMA INVOICE';

  // 1. Top Decorative Accent Banner
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, 210, 6, 'F');

  // 2. Hotel Header: Name, Stars & Logo
  let headerY = 16;

  // Try to render image if base64 PNG or JPEG
  let logoDrawn = false;
  if (profile.logoUrl && (profile.logoUrl.startsWith('data:image/png') || profile.logoUrl.startsWith('data:image/jpeg'))) {
    try {
      pdf.addImage(profile.logoUrl, 'PNG', 14, headerY, 20, 20);
      logoDrawn = true;
    } catch (e) {
      // Fallback to geometric crest
    }
  }

  const textStartX = logoDrawn ? 38 : 14;

  // Hotel Name
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(profile.name.toUpperCase(), textStartX, headerY + 5);

  // Stars + Category
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(217, 119, 6); // Amber
  const starString = '★'.repeat(Math.min(5, Math.max(1, profile.stars || 4)));
  pdf.text(`${starString}  ${profile.typeLabel || 'Établissement Hôtelier'}`, textStartX, headerY + 10);

  // Slogan (if present)
  if (profile.slogan) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`« ${profile.slogan} »`, textStartX, headerY + 14);
  }

  // Document Title badge on the right
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.roundedRect(135, headerY, 61, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(docTitle, 165.5, headerY + 6.8, { align: 'center' });

  // Document Number & Date under the badge
  pdf.setTextColor(71, 85, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(`${isFr ? 'Réf :' : 'Ref:'} ${doc.docNumber}`, 196, headerY + 15, { align: 'right' });
  pdf.text(`${isFr ? 'Date :' : 'Date:'} ${doc.issueDate}`, 196, headerY + 19, { align: 'right' });

  // 3. Sender & Client Address Columns
  const infoY = headerY + 24;

  // Issuer (Left)
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(14, infoY, 86, 32, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(14, infoY, 86, 32, 2, 2, 'S');

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(isFr ? 'ÉMETTEUR / LIEU DE SÉJOUR :' : 'ISSUER / HOTEL DETAILS:', 18, infoY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  const fullAddress = `${profile.address}, ${profile.postalCode || ''} ${profile.city}`;
  pdf.text([
    fullAddress.substring(0, 48),
    `${profile.country} · Tél: ${profile.phone}`,
    `Email: ${profile.email}`,
    profile.website ? `Web: ${profile.website}` : '',
  ], 18, infoY + 12);

  // Client / Destinataire (Right)
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(110, infoY, 86, 32, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(110, infoY, 86, 32, 2, 2, 'S');

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(isFr ? 'DESTINATAIRE / FACTURÉ À :' : 'BILL TO / GUEST:', 114, infoY + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.customerName.substring(0, 42), 114, infoY + 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  pdf.text([
    doc.customerAddress ? doc.customerAddress.substring(0, 44) : (isFr ? 'Adresse client sur dossier' : 'Client address on file'),
    doc.customerEmail || '',
    doc.customerPhone ? `Tél: ${doc.customerPhone}` : '',
  ], 114, infoY + 17);

  // 4. Metadata Strip (Validity, Sector, Currency)
  const metaY = infoY + 36;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(14, metaY, 182, 10, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);

  const dueLabel = doc.docType === 'quote' ? (isFr ? 'VALIDITÉ DU DEVIS' : 'VALIDITY') : (isFr ? 'ÉCHÉANCE RÈGLEMENT' : 'DUE DATE');
  pdf.text(isFr ? 'N° DOSSIER' : 'FILE NO.', 18, metaY + 4);
  pdf.text(isFr ? 'DATE D\'ÉMISSION' : 'ISSUE DATE', 65, metaY + 4);
  pdf.text(dueLabel, 115, metaY + 4);
  pdf.text(isFr ? 'DEVISE' : 'CURRENCY', 170, metaY + 4);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.docNumber, 18, metaY + 8);
  pdf.text(doc.issueDate, 65, metaY + 8);
  pdf.text(doc.validUntilOrDueDate, 115, metaY + 8);
  pdf.text(currencySymbol, 170, metaY + 8);

  // 5. Line Items Table
  let curY = metaY + 14;
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(14, curY, 182, 7.5, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(isFr ? 'DÉSIGNATION DE LA PRESTATION / CHAMBRE' : 'DESCRIPTION / SERVICES', 18, curY + 5);
  pdf.text(isFr ? 'QTÉ' : 'QTY', 125, curY + 5, { align: 'center' });
  pdf.text(isFr ? 'P.U. HT' : 'UNIT HT', 152, curY + 5, { align: 'right' });
  pdf.text(isFr ? 'TOTAL TTC' : 'TOTAL TTC', 190, curY + 5, { align: 'right' });

  curY += 7.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 41, 59);

  doc.items.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(14, curY, 182, 7.5, 'F');
    }
    pdf.setDrawColor(241, 245, 249);
    pdf.line(14, curY + 7.5, 196, curY + 7.5);

    pdf.setFontSize(8);
    pdf.text(item.description.substring(0, 62), 18, curY + 5);
    pdf.text(String(item.quantity), 125, curY + 5, { align: 'center' });
    pdf.text(formatAmount(item.unitPrice), 152, curY + 5, { align: 'right' });
    pdf.text(formatAmount(item.total), 190, curY + 5, { align: 'right' });

    curY += 7.5;
  });

  // 6. Bank Details (Left) & Financial Totals (Right)
  curY += 6;
  const totX = 115;
  const valX = 190;

  // Left Bank Box
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(14, curY, 90, 36, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(14, curY, 90, 36, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text(isFr ? 'MODALITÉS DE RÈGLEMENT PAR VIREMENT :' : 'PAYMENT WIRE TRANSFER INSTRUCTIONS:', 18, curY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text([
    profile.bankName ? `Banque : ${profile.bankName}` : '',
    profile.bankAccountRib ? `RIB/IBAN : ${profile.bankAccountRib}` : '',
    profile.bankSwift ? `BIC/SWIFT : ${profile.bankSwift}` : '',
    isFr ? `Réf virement obligatoire : ${doc.docNumber}` : `Transfer reference: ${doc.docNumber}`,
  ].filter(Boolean), 18, curY + 12);

  // Right Totals Breakdown
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  pdf.text(isFr ? 'Sous-total Hors Taxes (HT) :' : 'Subtotal Excl. Tax:', totX, curY + 4);
  pdf.text(formatAmount(doc.subtotalHT), valX, curY + 4, { align: 'right' });

  let lineOffset = 9;

  if (doc.discountAmount > 0) {
    pdf.setTextColor(220, 38, 38);
    const promoDesc = doc.discountCode ? ` (${doc.discountCode})` : '';
    pdf.text(`${isFr ? 'Remise' : 'Discount'}${promoDesc} :`, totX, curY + lineOffset);
    pdf.text(`- ${formatAmount(doc.discountAmount)}`, valX, curY + lineOffset, { align: 'right' });
    lineOffset += 5;
    pdf.setTextColor(51, 65, 85);
  }

  if (doc.vatAmount > 0) {
    pdf.text(isFr ? 'TVA collectée :' : 'VAT Amount:', totX, curY + lineOffset);
    pdf.text(formatAmount(doc.vatAmount), valX, curY + lineOffset, { align: 'right' });
    lineOffset += 5;
  }

  if (doc.cityTouristTax > 0) {
    pdf.text(isFr ? 'Taxe de séjour :' : 'City Tourist Tax:', totX, curY + lineOffset);
    pdf.text(formatAmount(doc.cityTouristTax), valX, curY + lineOffset, { align: 'right' });
    lineOffset += 5;
  }

  // Total Line Separator
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.line(totX, curY + lineOffset, valX + 6, curY + lineOffset);
  lineOffset += 5;

  // Total TTC
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text(isFr ? 'TOTAL NET TTC :' : 'TOTAL AMOUNT DUE:', totX, curY + lineOffset);
  pdf.text(formatAmount(doc.totalTTC), valX, curY + lineOffset, { align: 'right' });
  lineOffset += 6;

  if (doc.depositPaid > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(5, 150, 105);
    pdf.text(isFr ? 'Acompte déjà versé :' : 'Deposit Paid:', totX, curY + lineOffset);
    pdf.text(`- ${formatAmount(doc.depositPaid)}`, valX, curY + lineOffset, { align: 'right' });
    lineOffset += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 58, 138);
    pdf.text(isFr ? 'NET À PAYER :' : 'BALANCE DUE:', totX, curY + lineOffset);
    pdf.text(formatAmount(doc.balanceDue), valX, curY + lineOffset, { align: 'right' });
    lineOffset += 6;
  }

  // 7. Stamp / Status Badge (Below bank info)
  const stampY = curY + 42;
  const statusIsPaid = doc.status === 'paid';

  pdf.setDrawColor(
    statusIsPaid ? 5 : 30,
    statusIsPaid ? 150 : 58,
    statusIsPaid ? 105 : 138
  );
  pdf.setLineWidth(0.6);
  pdf.roundedRect(14, stampY, 52, 14, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(
    statusIsPaid ? 5 : 30,
    statusIsPaid ? 150 : 58,
    statusIsPaid ? 105 : 138
  );

  const statusLabel =
    statusIsPaid
      ? isFr ? '✓ RÈGLEMENT ACQUITTÉ' : '✓ PAID IN FULL'
      : doc.docType === 'quote'
      ? isFr ? 'DEVIS PROPOSÉ' : 'PROPOSED QUOTATION'
      : isFr ? 'EN ATTENTE PAIEMENT' : 'PAYMENT PENDING';

  pdf.text(statusLabel, 40, stampY + 9, { align: 'center' });

  // 8. Signatures & Cachet
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(130, stampY, 66, 18, 2, 2, 'S');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text(isFr ? 'Cachet & Signature de la Direction' : 'Official Stamp & Authorized Signature', 163, stampY + 5, { align: 'center' });
  pdf.text(`${profile.city}, ${doc.issueDate}`, 163, stampY + 15, { align: 'center' });

  // 9. Fiscal & Legal Footer (Always at bottom)
  const footerY = 268;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(14, footerY, 196, footerY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);

  // Build fiscal line from profile
  const fiscalParts = [
    profile.taxNumber ? `NIF : ${profile.taxNumber}` : '',
    profile.tradeRegisterNumber ? `RC : ${profile.tradeRegisterNumber}` : '',
    profile.statisticalIdNumber ? `NIS : ${profile.statisticalIdNumber}` : '',
    profile.taxArticleNumber ? `Art. Imp. : ${profile.taxArticleNumber}` : '',
  ].filter(Boolean);

  const fiscalString = fiscalParts.join('  ·  ');

  pdf.text([
    fiscalString || `${profile.name} · Établissement Hôtelier Agréé`,
    isFr
      ? 'Pénalités de retard : 3 fois le taux d\'intérêt légal en vigueur · Indemnité forfaitaire de recouvrement : 40 ' + currencySymbol
      : 'Late interest: 3x statutory rate · Recovery indemnity: 40 ' + currencySymbol,
    isFr
      ? `Système certifié OmniBook Hospitality — Document comptable officiel émis pour ${doc.customerName}`
      : `OmniBook Hospitality System — Official accounting invoice issued for ${doc.customerName}`,
  ], 14, footerY + 5);

  // Save the PDF
  pdf.save(`${doc.docNumber}_${doc.customerName.replace(/\s+/g, '_')}.pdf`);
}
