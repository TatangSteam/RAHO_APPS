import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from './formatNumber';

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'CV DUNIA SEHAT SENTOSA INDONESIA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';
const BANK_NAME = 'BCA';
const BANK_ACCOUNT = '1306-9938-88';
const BANK_HOLDER = 'CV DUNIA SEHAT SENTOSA';

export async function generateInvoicePDF(invoice: Invoice) {
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
  doc.text('INVOICE', margin, currentY);
  
  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    DRAFT: [200, 200, 200],
    PENDING_PAYMENT: [255, 152, 0],
    PAID: [76, 175, 80],
    CANCELLED: [244, 67, 54],
    OVERDUE: [244, 67, 54],
  };
  const statusColor = statusColors[invoice.status] || [100, 100, 100];
  doc.setFillColor(...statusColor);
  doc.rect(pageWidth - margin - 40, currentY - 5, 40, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status, pageWidth - margin - 20, currentY - 1, { align: 'center' });
  
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
  doc.text('INVOICE DETAILS', leftX, currentY);
  
  doc.setFont('helvetica', 'normal');
  currentY += 5;
  doc.text(`No. Faktur: ${invoice.invoiceNumber}`, leftX, currentY);
  
  currentY += 4;
  const createdDate = new Date(invoice.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Tanggal: ${createdDate}`, leftX, currentY);
  
  currentY += 4;
  if (invoice.dueDate) {
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Jatuh Tempo: ${dueDate}`, leftX, currentY);
  }
  
  // Right column - Bill to
  currentY -= 8;
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', rightX, currentY);
  
  doc.setFont('helvetica', 'normal');
  currentY += 5;
  doc.text(invoice.memberName, rightX, currentY);
  
  currentY += 4;
  if (invoice.memberNo) {
    doc.text(`Member No: ${invoice.memberNo}`, rightX, currentY);
  }
  
  currentY += 4;
  if (invoice.branchName) {
    doc.text(`Branch: ${invoice.branchName}`, rightX, currentY);
  }
  
  // ============================================================
  // ITEMS TABLE
  // ============================================================
  currentY += 10;
  
  const tableData = invoice.items.map((item, idx) => {
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
    head: [['Kode', 'Qty', 'Deskripsi', 'Harga Satuan', 'Total']],
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
    doc.text('Diskon', summaryLabelX, currentY);
    doc.text(`- Rp ${formatNumberWithDots(invoice.discountAmount)}`, summaryValueX, currentY, { align: 'right' });
    currentY += 5;
    doc.setTextColor(0, 0, 0);
  }
  
  // Tax
  if (invoice.taxAmount && invoice.taxAmount > 0) {
    doc.text('Pajak (PPN)', summaryLabelX, currentY);
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
  doc.text('TOTAL', summaryLabelX, currentY);
  doc.text(`Rp ${formatNumberWithDots(invoice.totalAmount)}`, summaryValueX, currentY, { align: 'right' });
  
  // ============================================================
  // PAYMENT INFORMATION
  // ============================================================
  currentY += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMASI PEMBAYARAN', margin, currentY);
  
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Bank: ${BANK_NAME}`, margin, currentY);
  
  currentY += 3;
  doc.text(`No. Rekening: ${BANK_ACCOUNT}`, margin, currentY);
  
  currentY += 3;
  doc.text(`Atas Nama: ${BANK_HOLDER}`, margin, currentY);
  
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
  }
  
  // ============================================================
  // FOOTER - Signature & Info
  // ============================================================
  const footerY = pageHeight - 25;
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Dibuat oleh:', margin, footerY);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.createdByName, margin, footerY + 4);
  
  if (invoice.verifiedByName) {
    doc.setFont('helvetica', 'normal');
    doc.text('Diverifikasi oleh:', pageWidth / 2, footerY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.verifiedByName, pageWidth / 2, footerY + 4);
  }
  
  // Document info
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, margin, pageHeight - 5);
  doc.text(`Invoice #${invoice.invoiceNumber}`, pageWidth - margin - 40, pageHeight - 5, { align: 'right' });
  
  // Save PDF
  doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
}
