import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from './formatNumber';
import { devLog, devError } from '@/lib/logger';

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'CV DUNIA SEHAT SENTOSA INDONESIA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';

export async function generateInvoicePDF(invoice: Invoice) {
  devLog('📥 Starting PDF generation for invoice:', invoice.invoiceNumber);
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const isReceipt = invoice.status === 'PAID';
    const documentTitle = isReceipt ? 'KWITANSI' : 'INVOICE';
    const detailTitle = isReceipt ? 'DETAIL KWITANSI' : 'DETAIL INVOICE';
    const billToTitle = isReceipt ? 'DITERIMA DARI' : 'TAGIHAN UNTUK';
    const numberLabel = isReceipt ? 'No. Kwitansi' : 'No. Faktur';
    const totalLabel = isReceipt ? 'TOTAL DITERIMA' : 'TOTAL PEMBAYARAN';
    const isInstallment = Boolean(
      invoice.paymentPlanType === 'INSTALLMENT' && invoice.installmentNumber && invoice.installmentTotal
    );
    const formatCurrency = (amount: number) => `Rp ${formatNumberWithDots(amount || 0)}`;
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const getStatusText = (status: string) => {
      const textMap: Record<string, string> = {
        DRAFT: 'DRAFT',
        PENDING_PAYMENT: 'MENUNGGU PEMBAYARAN',
        PAID: 'LUNAS',
        OVERDUE: 'JATUH TEMPO',
        CANCELLED: 'DIBATALKAN',
      };
      return textMap[status] || status;
    };
    
    let currentY = margin;
    
    // ============================================================
    // HEADER - Company Info
    // ============================================================
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 118, 210); // Professional blue
    doc.text(COMPANY_NAME, pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_LEGAL, pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 4;
    doc.setFontSize(8);
    doc.text(COMPANY_ADDRESS, pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 3;
    doc.text(`${COMPANY_CITY} | ${COMPANY_PHONE} | ${COMPANY_EMAIL}`, pageWidth / 2, currentY, { align: 'center' });
    
    // Decorative line
    currentY += 5;
    doc.setDrawColor(25, 118, 210);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    
    // ============================================================
    // INVOICE TITLE & STATUS
    // ============================================================
    currentY += 8;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(documentTitle, margin, currentY);
    
    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      DRAFT: [200, 200, 200],
      PENDING_PAYMENT: [255, 152, 0],
      PAID: [76, 175, 80],
      CANCELLED: [244, 67, 54],
      OVERDUE: [244, 67, 54],
    };
    const statusColor = statusColors[invoice.status] || [100, 100, 100];
    const statusText = getStatusText(invoice.status);
    const badgeWidth = Math.max(40, doc.getTextWidth(statusText) + 10);
    doc.setFillColor(...statusColor);
    doc.rect(pageWidth - margin - badgeWidth, currentY - 5, badgeWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(statusText, pageWidth - margin - (badgeWidth / 2), currentY - 1, { align: 'center' });
    
    // ============================================================
    // INVOICE DETAILS - Two Column Layout
    // ============================================================
    currentY += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Left column - Invoice info
    const leftX = margin;
    const rightX = pageWidth / 2 + 5;
    const detailsStartY = currentY;
    let leftY = detailsStartY;
    let rightY = detailsStartY;
    
    doc.setFont('helvetica', 'bold');
    doc.text(detailTitle, leftX, leftY);
    
    doc.setFont('helvetica', 'normal');
    leftY += 5;
    doc.text(`${numberLabel}: ${invoice.invoiceNumber}`, leftX, leftY);
    
    leftY += 4;
    doc.text(`Tanggal: ${formatDate(invoice.createdAt)}`, leftX, leftY);
    
    if (invoice.dueDate) {
      leftY += 4;
      doc.text(`Jatuh Tempo: ${formatDate(invoice.dueDate)}`, leftX, leftY);
    }
    
    // Right column - Bill to
    doc.setFont('helvetica', 'bold');
    doc.text(billToTitle, rightX, rightY);
    
    doc.setFont('helvetica', 'normal');
    rightY += 5;
    doc.text(invoice.memberName || 'Member', rightX, rightY);
    
    rightY += 4;
    doc.text(`Member No: ${invoice.memberNo || '-'}`, rightX, rightY);
    
    if (invoice.branchName) {
      rightY += 4;
      doc.text(`Cabang: ${invoice.branchName}`, rightX, rightY);
    }

    currentY = Math.max(leftY, rightY) + 10;

    if (isInstallment) {
      const installmentLines = [
        `Total pembelian: ${formatCurrency(invoice.totalPurchaseAmount || invoice.totalAmount)}`,
        invoice.carryOverAmount && invoice.carryOverAmount > 0
          ? `Sisa termin sebelumnya: ${formatCurrency(invoice.carryOverAmount)}`
          : '',
        invoice.creditAmount && invoice.creditAmount > 0
          ? `Kredit termin sebelumnya: ${formatCurrency(invoice.creditAmount)}`
          : '',
      ].filter(Boolean).join(' | ');
      const splitInstallmentLines = doc.splitTextToSize(installmentLines, contentWidth - 6);

      doc.setFillColor(255, 251, 234);
      doc.setDrawColor(255, 193, 7);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY - 3, contentWidth, 14 + (splitInstallmentLines.length * 4), 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(25, 118, 210);
      doc.text(`TERMIN ${invoice.installmentNumber} DARI ${invoice.installmentTotal}`, margin + 3, currentY + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(splitInstallmentLines, margin + 3, currentY + 8);
      currentY += 18 + (splitInstallmentLines.length * 4);
    }
    
    // ============================================================
    // ITEMS TABLE
    // ============================================================
    currentY += 10;
    
    // Group items by code + description + pricePerUnit (same as frontend)
    const itemsMap = new Map<string, any>();
    
    invoice.items.forEach((item) => {
      const productCode = item.code || `ITEM-${item.id}`;
      const key = `${productCode}|${item.description}|${item.pricePerUnit}`;
      
      if (itemsMap.has(key)) {
        const existing = itemsMap.get(key);
        existing.quantity += item.quantity;
        existing.totalAmount += item.totalAmount;
      } else {
        itemsMap.set(key, {
          ...item,
          code: productCode,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        });
      }
    });
    
    const groupedItems = Array.from(itemsMap.values());
    
    const tableData = groupedItems.map((item, idx) => {
      const code = item.code || '-';
      const qty = item.quantity;
      const description = item.subDescription 
        ? `${item.description}\n${item.subDescription}`
        : item.description;
      const price = formatNumberWithDots(item.pricePerUnit);
      const total = formatNumberWithDots(item.totalAmount);
      
      return [code, qty.toString(), description, `Rp ${price}`, `Rp ${total}`];
    });
    
    autoTable(doc, {
      startY: currentY,
      head: [['Kode', 'Qty', 'Nama Barang / Layanan', 'Harga Satuan', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [25, 118, 210],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 65 },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Footer on each page
        const pageCount = (doc as any).internal.pages.length - 1;
        if (pageCount > 1) {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`Halaman ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      }
    });
    
    // ============================================================
    // SUMMARY SECTION
    // ============================================================
    currentY = (doc as any).lastAutoTable.finalY + 8;
    
    const summaryX = pageWidth - margin - 70;
    const summaryLabelX = summaryX;
    const summaryValueX = pageWidth - margin;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Subtotal
    doc.text('Subtotal', summaryLabelX, currentY);
    doc.text(`Rp ${formatNumberWithDots(invoice.subtotal)}`, summaryValueX, currentY, { align: 'right' });
    
    currentY += 5;
    
    // Discount
    if (invoice.discountAmount && invoice.discountAmount > 0) {
      doc.setTextColor(220, 53, 69); // Red
      const discountLabel = invoice.discountPercent 
        ? `Diskon (${invoice.discountPercent}%)`
        : 'Diskon';
      doc.text(discountLabel, summaryLabelX, currentY);
      doc.text(`- Rp ${formatNumberWithDots(invoice.discountAmount)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;
      doc.setTextColor(0, 0, 0);
    }
    
    // Tax (only if exists and > 0)
    if (invoice.taxAmount && invoice.taxAmount > 0) {
      const taxLabel = invoice.taxPercent 
        ? `Pajak (${invoice.taxPercent}%)`
        : 'Pajak';
      doc.text(taxLabel, summaryLabelX, currentY);
      doc.text(`Rp ${formatNumberWithDots(invoice.taxAmount)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;
    }
    
    // Total line
    currentY += 2;
    doc.setDrawColor(25, 118, 210);
    doc.setLineWidth(0.5);
    doc.line(summaryLabelX, currentY, summaryValueX, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 118, 210);
    doc.text(totalLabel, summaryLabelX, currentY);
    doc.text(`Rp ${formatNumberWithDots(invoice.totalAmount)}`, summaryValueX, currentY, { align: 'right' });
    
    // ============================================================
    // INCENTIVE INFORMATION (if exists)
    // ============================================================
    if (invoice.incentive) {
      currentY += 12;
      
      // Purple box background
      doc.setFillColor(243, 229, 245); // Light purple
      doc.setDrawColor(156, 39, 176); // Purple border
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY - 3, contentWidth, 20, 2, 2, 'FD');
      
      // Title with emoji
      doc.setTextColor(74, 20, 140); // Dark purple
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('INFORMASI INSENTIF REFERRAL', margin + 3, currentY + 2);
      
      // Incentive amount
      currentY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(106, 27, 154); // Purple
      doc.text('Jumlah Insentif:', margin + 3, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rp ${formatNumberWithDots(invoice.incentive.totalAmount)}`, margin + 50, currentY);
      
      // Referrer info
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.text('Untuk:', margin + 3, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${invoice.incentive.referrerName} (${invoice.incentive.referralCode})`, margin + 50, currentY);
      
      // Note
      currentY += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(106, 27, 154);
      doc.text(`* Insentif referral akan diberikan kepada ${invoice.incentive.referrerName}`, margin + 3, currentY);
      
      currentY += 5;
    }
    
    // ============================================================
    // NOTES
    // ============================================================
    if (invoice.notes) {
      currentY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CATATAN', margin, currentY);
      
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
      doc.text(splitNotes, margin, currentY);
      currentY += splitNotes.length * 4;
    }
    
    // ============================================================
    // FOOTER - Signature & Info
    // ============================================================
    let signatureY = Math.max(currentY + 18, pageHeight - 48);
    if (signatureY > pageHeight - 35) {
      doc.addPage();
      signatureY = margin + 15;
    }

    const memberSignatureX = margin + 42;
    const adminSignatureX = pageWidth - margin - 42;
    const signatureLineWidth = 55;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(margin, signatureY - 8, pageWidth - margin, signatureY - 8);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('MEMBER', memberSignatureX, signatureY, { align: 'center' });
    doc.text('ADMIN', adminSignatureX, signatureY, { align: 'center' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(memberSignatureX - (signatureLineWidth / 2), signatureY + 25, memberSignatureX + (signatureLineWidth / 2), signatureY + 25);
    doc.line(adminSignatureX - (signatureLineWidth / 2), signatureY + 25, adminSignatureX + (signatureLineWidth / 2), signatureY + 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(invoice.memberName || 'Member', memberSignatureX, signatureY + 31, { align: 'center' });
    doc.text(invoice.verifiedByName || invoice.createdByName || 'Admin', adminSignatureX, signatureY + 31, { align: 'center' });

    // Document info
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, margin, pageHeight - 5);
    doc.text(`${documentTitle} #${invoice.invoiceNumber}`, pageWidth - margin - 40, pageHeight - 5, { align: 'right' });
    
    // Save PDF
    const fileName = `${isReceipt ? 'Kwitansi' : 'Invoice'}-${invoice.invoiceNumber}.pdf`;
    devLog('💾 Saving PDF:', fileName);
    doc.save(fileName);
    
    devLog('✅ PDF generated successfully');
    return true;
  } catch (error) {
    devError('❌ Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan coba lagi.');
  }
}
