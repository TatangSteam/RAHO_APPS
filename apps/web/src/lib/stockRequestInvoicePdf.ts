import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumberWithDots } from './formatNumber';
import type { StockRequest, StockRequestInvoice } from '@/app/(staff)/inventory/stock-requests/types';

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'CV DUNIA SEHAT SENTOSA INDONESIA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';
const BANK_NAME = 'BCA';
const BANK_ACCOUNT = '1306-9938-88';
const BANK_HOLDER = 'CV DUNIA SEHAT SENTOSA';

export async function generateStockRequestInvoicePDF(request: StockRequest) {
  const invoice = request.invoice;
  if (!invoice) {
    throw new Error('Invoice tidak ditemukan');
  }

  console.log('📥 Starting PDF generation for stock request invoice:', invoice.invoiceNumber);

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
    doc.text('INVOICE PERMINTAAN STOK', margin, currentY);

    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      PENDING: [255, 152, 0],
      PAID: [76, 175, 80],
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
      const qty = item.quantity;
      const sku = item.sku || '-';
      const description = item.productName + (item.description ? `\n${item.description}` : '');
      const price = formatNumberWithDots(item.pricePerUnit);
      const total = formatNumberWithDots(item.subtotal);

      return [qty.toString(), sku, description, `Rp ${price}`, `Rp ${total}`];
    }) || [];

    autoTable(doc, {
      startY: currentY,
      head: [['Qty', 'Kode', 'Nama Produk / Keterangan', 'Harga Satuan', 'Subtotal']],
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
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 60 },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' }
      },
      margin: { left: margin, right: margin },
    });

    // ============================================================
    // SUMMARY SECTION
    // ============================================================
    currentY = (doc as any).lastAutoTable.finalY + 8;

    const summaryX = pageWidth - margin - 70;
    const summaryValueX = pageWidth - margin;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Subtotal
    doc.text('Subtotal', summaryX, currentY);
    doc.text(`Rp ${formatNumberWithDots(invoice.subtotal)}`, summaryValueX, currentY, { align: 'right' });

    // Total line
    currentY += 5;
    doc.setDrawColor(25, 118, 210);
    doc.setLineWidth(0.5);
    doc.line(summaryX, currentY, summaryValueX, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 118, 210);
    doc.text('TOTAL PEMBAYARAN', summaryX, currentY);
    doc.text(`Rp ${formatNumberWithDots(invoice.totalAmount)}`, summaryValueX, currentY, { align: 'right' });

    // ============================================================
    // PAYMENT INFORMATION
    // ============================================================
    currentY += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMASI PEMBAYARAN', margin, currentY);

    // Payment info box
    currentY += 3;
    doc.setFillColor(249, 250, 251); // Light gray background
    doc.setDrawColor(229, 231, 235); // Border
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, 'FD');

    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Bank: ${BANK_NAME}`, margin + 5, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`No. Rekening: ${BANK_ACCOUNT}`, margin + 5, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Atas Nama: ${BANK_HOLDER}`, margin + 5, currentY);

    // ============================================================
    // PAYMENT STATUS (if paid)
    // ============================================================
    if (invoice.paidAt) {
      currentY += 15;
      doc.setFillColor(220, 252, 231); // Light green background
      doc.setDrawColor(34, 197, 94); // Green border
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY - 3, contentWidth, 12, 2, 2, 'FD');

      doc.setTextColor(22, 101, 52); // Dark green
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('✓ PEMBAYARAN TELAH DIKONFIRMASI', margin + 5, currentY + 3);

      const paidDate = new Date(invoice.paidAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.setFont('helvetica', 'normal');
      doc.text(`Tanggal: ${paidDate}`, pageWidth - margin - 5, currentY + 3, { align: 'right' });
    }

    // ============================================================
    // NOTES
    // ============================================================
    if (request.notes) {
      currentY += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CATATAN', margin, currentY);

      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(request.notes, contentWidth);
      doc.text(splitNotes, margin, currentY);
    }

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
    console.log('💾 Saving PDF:', fileName);
    doc.save(fileName);

    console.log('✅ PDF generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan coba lagi.');
  }
}
