import { assertCaughtError } from '@/lib/caughtError';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceItem } from '@/types/invoice';
import { formatNumberWithDots } from './formatNumber';
import { devLog, devError } from '@/lib/logger';
import { getDefaultInvoicePaymentAccount } from '@/lib/paymentAccounts';

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'PT DUNIA SEHAT SENTOSA JAKARTA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';
const COMPANY_LOGO_PATH = '/asset/LogoInInvoiceAndKuitansi.png';
const BRAND_RED: [number, number, number] = [185, 28, 28];
const LIGHT_RED: [number, number, number] = [254, 226, 226];
const NOTE_YELLOW: [number, number, number] = [255, 251, 234];

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable: { finalY: number };
};

async function loadImageDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    const blob = await response.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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
    const paymentAccount = getDefaultInvoicePaymentAccount(invoice);
    const shouldShowPaymentAccount = !isReceipt && invoice.status !== 'CANCELLED';
    const isInstallment = Boolean(
      invoice.paymentPlanType === 'INSTALLMENT' && invoice.installmentNumber && invoice.installmentTotal
    );
    const formatCurrency = (amount: number) => `Rp ${formatNumberWithDots(amount || 0)}`;
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const ensureSpace = (requiredHeight: number) => {
      if (currentY + requiredHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
    };
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
    const logoDataUrl = await loadImageDataUrl(COMPANY_LOGO_PATH);
    
    // ============================================================
    // HEADER - Company Info
    // ============================================================
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin, currentY, 28, 18);
    }

    const headerTextX = logoDataUrl ? margin + 34 : margin;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_RED);
    doc.text(COMPANY_NAME, headerTextX, currentY + 4);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_LEGAL, headerTextX, currentY + 10);
    
    doc.setFontSize(8);
    doc.text(COMPANY_ADDRESS, headerTextX, currentY + 15);
    
    doc.text(`${COMPANY_CITY} | ${COMPANY_PHONE} | ${COMPANY_EMAIL}`, headerTextX, currentY + 19);
    
    // Decorative line
    currentY += 25;
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    
    // ============================================================
    // INVOICE TITLE & STATUS
    // ============================================================
    currentY += 8;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_RED);
    doc.text(documentTitle, margin, currentY);
    
    // Status badge
    const statusStyles: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
      DRAFT: { fill: [224, 224, 224], text: [66, 66, 66] },
      PENDING_PAYMENT: { fill: [255, 243, 205], text: [133, 100, 4] },
      PAID: { fill: [212, 237, 218], text: [21, 87, 36] },
      CANCELLED: { fill: [248, 215, 218], text: [114, 28, 36] },
      OVERDUE: { fill: [248, 215, 218], text: [114, 28, 36] },
    };
    const statusStyle = statusStyles[invoice.status] || statusStyles.DRAFT;
    const statusText = getStatusText(invoice.status);
    const badgeWidth = Math.max(40, doc.getTextWidth(statusText) + 10);
    doc.setFillColor(...statusStyle.fill);
    doc.roundedRect(pageWidth - margin - badgeWidth, currentY - 6, badgeWidth, 8, 1, 1, 'F');
    doc.setTextColor(...statusStyle.text);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(statusText, pageWidth - margin - (badgeWidth / 2), currentY - 1, { align: 'center' });
    
    // ============================================================
    // INVOICE DETAILS - Two Column Layout
    // ============================================================
    currentY += 10;
    doc.setFillColor(249, 249, 249);
    doc.roundedRect(margin, currentY - 4, contentWidth, 26, 1, 1, 'F');
    currentY += 2;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Left column - Invoice info
    const leftX = margin + 4;
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

      doc.setFillColor(...NOTE_YELLOW);
      doc.setDrawColor(255, 193, 7);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY - 3, contentWidth, 14 + (splitInstallmentLines.length * 4), 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_RED);
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
    const itemsMap = new Map<string, InvoiceItem & { code: string }>();
    
    invoice.items.forEach((item) => {
      const productCode = item.code || `ITEM-${item.id}`;
      const key = `${productCode}|${item.description}|${item.pricePerUnit}`;
      
      const existing = itemsMap.get(key);
      if (existing) {
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
      
      return [(idx + 1).toString(), code, description, qty.toString(), `Rp ${price}`, `Rp ${total}`];
    });
    
    autoTable(doc, {
      startY: currentY,
      head: [['NO', 'KODE BARANG', 'NAMA BARANG / LAYANAN', 'QTY', 'HARGA SATUAN', 'TOTAL']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: LIGHT_RED,
        textColor: 0,
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 8,
        cellPadding: { top: 4, right: 2, bottom: 4, left: 2 },
        overflow: 'linebreak',
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 4, right: 2, bottom: 4, left: 2 },
        textColor: 0,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', overflow: 'visible' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 64, halign: 'left' },
        3: { cellWidth: 10, halign: 'center', overflow: 'visible' },
        4: { cellWidth: 36, halign: 'right', overflow: 'visible' },
        5: { cellWidth: 36, halign: 'right', overflow: 'visible' }
      },
      margin: { left: margin, right: margin },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.1);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
      didDrawPage: (data) => {
        // Footer on each page
        const pageCount = doc.internal.getNumberOfPages();
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
    currentY = (doc as unknown as JsPdfWithAutoTable).lastAutoTable.finalY + 8;
    const sectionTopY = currentY;
    const leftColumnWidth = contentWidth - 98;
    let postTableLeftY = sectionTopY;

    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('CATATAN', margin, postTableLeftY);

      postTableLeftY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(invoice.notes, leftColumnWidth);
      doc.text(splitNotes, margin, postTableLeftY);
      postTableLeftY += splitNotes.length * 4 + 4;
    }

    if (shouldShowPaymentAccount) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('PEMBAYARAN DAPAT DITRANSFER MELALUI REKENING', margin, postTableLeftY);

      const labelX = margin;
      const valueX = margin + 30;
      postTableLeftY += 5;
      doc.setFontSize(8);
      doc.text('Nama Bank', labelX, postTableLeftY);
      doc.text(':', valueX - 3, postTableLeftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.bankName, valueX, postTableLeftY);

      postTableLeftY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('No Rekening', labelX, postTableLeftY);
      doc.text(':', valueX - 3, postTableLeftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.accountNumber, valueX, postTableLeftY);

      postTableLeftY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Atas nama', labelX, postTableLeftY);
      doc.text(':', valueX - 3, postTableLeftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.accountHolder, valueX, postTableLeftY);
      postTableLeftY += 4;
    }

    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);
    
    const summaryWidth = 90;
    const summaryX = pageWidth - margin - summaryWidth;
    const summaryLabelX = summaryX;
    const summaryValueX = pageWidth - margin;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Subtotal
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(summaryX - 4, currentY - 5, summaryWidth + 4, 12);
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
    doc.setFillColor(...BRAND_RED);
    doc.rect(summaryX - 4, currentY - 4, summaryWidth + 4, 12, 'F');
    currentY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(totalLabel, summaryLabelX, currentY);
    doc.text(`Rp ${formatNumberWithDots(invoice.totalAmount)}`, summaryValueX, currentY, { align: 'right' });
    currentY = Math.max(currentY, postTableLeftY);
    
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
    // SIGNATURE & FOOTER - Match preview document
    // ============================================================
    currentY += 18;
    ensureSpace(72);

    const memberSignatureX = margin + 42;
    const adminSignatureX = pageWidth - margin - 42;
    const signatureLineWidth = 58;

    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    const signatureY = currentY + 15;
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

    currentY = signatureY + 43;
    ensureSpace(22);

    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text('Terima kasih atas kepercayaan Anda menggunakan layanan Raho ERP', pageWidth / 2, currentY, { align: 'center' });

    currentY += 5;
    doc.setFontSize(7);
    doc.setTextColor(170, 170, 170);
    doc.text(`Generated: ${new Date().toLocaleString('id-ID')} | ${documentTitle} #${invoice.invoiceNumber}`, pageWidth / 2, currentY, { align: 'center' });
    
    // Save PDF
    const fileName = `${isReceipt ? 'Kwitansi' : 'Invoice'}-${invoice.invoiceNumber}.pdf`;
    devLog('💾 Saving PDF:', fileName);
    doc.save(fileName);
    
    devLog('✅ PDF generated successfully');
    return true;
  } catch (error) {
      assertCaughtError(error);
    devError('❌ Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan coba lagi.');
  }
}
