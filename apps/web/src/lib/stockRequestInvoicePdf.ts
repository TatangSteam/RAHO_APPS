import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumberWithDots } from './formatNumber';
import { devLog, devError } from '@/lib/logger';
import type { StockRequest } from '@/app/(staff)/inventory/stock-requests/types';
import { getDefaultStockRequestPaymentAccount } from '@/lib/paymentAccounts';

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'PT DUNIA SEHAT SENTOSA JAKARTA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';
const COMPANY_LOGO_PATH = '/asset/LogoInInvoiceAndKuitansi.png';
const BRAND_RED: [number, number, number] = [185, 28, 28];

type AutoTableDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type StockRequestInvoiceItem = NonNullable<NonNullable<StockRequest['invoice']>['items']>[number];

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

function formatQuantityWithUnit(quantity: number, unit?: string | null) {
  const displayQuantity = String(quantity).trim();
  const displayUnit = String(unit || '').trim();

  return displayUnit ? `${displayQuantity} ${displayUnit}` : displayQuantity;
}

function getInvoiceItemUnit(request: StockRequest, item: StockRequestInvoiceItem) {
  return item.unit || request.items.find((requestItem) => (
    requestItem.masterProductId === item.masterProductId
  ))?.unit;
}

function getPaymentAccount(request: StockRequest) {
  const invoice = request.invoice;
  const fallback = getDefaultStockRequestPaymentAccount(request.branchType, request.branchName);

  return {
    label: invoice?.paymentAccountLabel || fallback.label,
    bankName: invoice?.paymentBankName || fallback.bankName,
    accountNumber: invoice?.paymentAccountNumber || fallback.accountNumber,
    accountHolder: invoice?.paymentAccountHolder || fallback.accountHolder,
  };
}

export async function generateStockRequestInvoicePDF(request: StockRequest) {
  const invoice = request.invoice;
  if (!invoice) {
    throw new Error('Invoice tidak ditemukan');
  }

  devLog('📥 Starting PDF generation for stock request invoice:', invoice.invoiceNumber);

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin;

    // ============================================================
    // HEADER - Company Info
    // ============================================================
    const logoDataUrl = await loadImageDataUrl(COMPANY_LOGO_PATH);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin, currentY - 2, 28, 20);
    }

    const headerTextX = logoDataUrl ? margin + 34 : pageWidth / 2;
    const headerTextOptions = logoDataUrl ? undefined : { align: 'center' as const };

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_RED);
    doc.text(COMPANY_NAME, headerTextX, currentY, headerTextOptions);

    currentY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_LEGAL, headerTextX, currentY, headerTextOptions);

    currentY += 4;
    doc.setFontSize(8);
    doc.text(COMPANY_ADDRESS, headerTextX, currentY, headerTextOptions);

    currentY += 3;
    doc.text(`${COMPANY_CITY} | ${COMPANY_PHONE} | ${COMPANY_EMAIL}`, headerTextX, currentY, headerTextOptions);

    // Decorative line
    currentY += 5;
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
    doc.text('INVOICE PERMINTAAN STOK', margin, currentY);

    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      PENDING: [255, 152, 0],
      PAID: [76, 175, 80],
      DEBT: [249, 115, 22],
      CANCELLED: [244, 67, 54],
      WAITING_PAYMENT: [156, 39, 176],
    };
    const statusColor = statusColors[invoice.status] || [100, 100, 100];
    doc.setFillColor(...statusColor);
    doc.rect(pageWidth - margin - 45, currentY - 5, 45, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const statusLabel = invoice.status === 'PAID' ? 'LUNAS' : 
                        invoice.status === 'DEBT' ? 'UTANG' :
                        invoice.status === 'PENDING' ? 'BELUM BAYAR' : 
                        invoice.status === 'WAITING_PAYMENT' ? 'MENUNGGU' : invoice.status;
    doc.text(statusLabel, pageWidth - margin - 22.5, currentY - 1, { align: 'center' });

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

    doc.setFont('helvetica', 'bold');
    doc.text('DETAIL INVOICE', leftX, currentY);

    doc.setFont('helvetica', 'normal');
    currentY += 5;
    doc.text(`No. Invoice: ${invoice.invoiceNumber}`, leftX, currentY);

    currentY += 4;
    doc.text(`Kode Request: ${request.requestCode}`, leftX, currentY);

    currentY += 4;
    const createdDate = invoice.createdAt 
      ? new Date(invoice.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
    doc.text(`Tanggal: ${createdDate}`, leftX, currentY);

    // Right column - Bill to
    currentY -= 8;
    doc.setFont('helvetica', 'bold');
    doc.text('TAGIHAN UNTUK', rightX, currentY);

    doc.setFont('helvetica', 'normal');
    currentY += 5;
    doc.text(request.branchName, rightX, currentY);

    currentY += 4;
    doc.text(`Tipe: ${request.branchType}`, rightX, currentY);

    // ============================================================
    // ITEMS TABLE
    // ============================================================
    currentY += 12;

    const tableData = invoice.items?.map((item) => {
      const qty = formatQuantityWithUnit(item.quantity, getInvoiceItemUnit(request, item));
      const sku = item.sku || '-';
      const description = item.productName + (item.description ? `\n${item.description}` : '');

      return [sku, qty, description];
    }) || [];

    autoTable(doc, {
      startY: currentY,
      head: [['Kode Barang', 'Qty', 'Nama Produk / Keterangan']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: BRAND_RED,
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
        0: { cellWidth: 40, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
    });

    // ============================================================
    // NOTES, PAYMENT ACCOUNT, AND SUMMARY
    // ============================================================
    const tableEndY = (doc as AutoTableDocument).lastAutoTable?.finalY ?? currentY;
    const sectionTopY = tableEndY + 6;
    const summaryX = pageWidth - margin - 70;
    const summaryValueX = pageWidth - margin;
    const leftColumnWidth = summaryX - margin - 8;
    const invoiceNotes = invoice.notes || request.notes;
    const shouldShowPaymentAccount = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
    const paymentAccount = getPaymentAccount(request);
    let leftY = sectionTopY;

    if (invoiceNotes) {
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CATATAN', margin, leftY);

      leftY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(invoiceNotes, leftColumnWidth) as string[];
      doc.text(splitNotes, margin, leftY);
      leftY += splitNotes.length * 4 + 3;
    }

    if (shouldShowPaymentAccount) {
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('PEMBAYARAN DAPAT DITRANSFER MELALUI REKENING', margin, leftY);

      const labelX = margin;
      const valueX = margin + 30;
      leftY += 5;
      doc.setFontSize(8);
      doc.text('Nama Bank', labelX, leftY);
      doc.text(':', valueX - 3, leftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.bankName, valueX, leftY);

      leftY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('No Rekening', labelX, leftY);
      doc.text(':', valueX - 3, leftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.accountNumber, valueX, leftY);

      leftY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Atas nama', labelX, leftY);
      doc.text(':', valueX - 3, leftY);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentAccount.accountHolder, valueX, leftY);
      leftY += 4;
    }

    let summaryY = sectionTopY;
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.5);
    doc.line(summaryX, summaryY, summaryValueX, summaryY);

    summaryY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_RED);
    doc.text('TOTAL PEMBAYARAN', summaryX, summaryY);
    doc.text(`Rp ${formatNumberWithDots(invoice.totalAmount)}`, summaryValueX, summaryY, { align: 'right' });

    currentY = Math.max(leftY, summaryY);

    // ============================================================
    // SIGNATURES
    // ============================================================
    if (currentY + 55 > pageHeight - 25) {
      doc.addPage();
      currentY = margin;
    }

    currentY += 18;
    const signatureWidth = 70;
    const adminBranchCenterX = margin + (signatureWidth / 2);
    const adminManagerCenterX = pageWidth - margin - (signatureWidth / 2);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Admin Cabang', adminBranchCenterX, currentY, { align: 'center' });
    doc.text('Admin Manager', adminManagerCenterX, currentY, { align: 'center' });

    currentY += 30;
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin + signatureWidth, currentY);
    doc.line(pageWidth - margin - signatureWidth, currentY, pageWidth - margin, currentY);

    // ============================================================
    // FOOTER
    // ============================================================
    const footerY = pageHeight - 15;

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, margin, footerY);
    doc.text(`Invoice #${invoice.invoiceNumber}`, pageWidth - margin, footerY, { align: 'right' });

    // Thank you message
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Terima kasih atas kerjasamanya!', pageWidth / 2, footerY - 5, { align: 'center' });

    // Save PDF
    const fileName = `Invoice-${invoice.invoiceNumber}.pdf`;
    devLog('💾 Saving PDF:', fileName);
    doc.save(fileName);

    devLog('✅ PDF generated successfully');
    return true;
  } catch (error) {
    devError('❌ Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan coba lagi.');
  }
}
