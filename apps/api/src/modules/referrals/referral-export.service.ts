/**
 * Referral Export Service
 * 
 * Handles exporting referral incentive reports to Excel and PDF formats
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma, PrismaClient } from '@prisma/client';
import { Response } from 'express';

const prisma = new PrismaClient();

export interface ExportFilters {
  referralId?: string;
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  referrerType?: 'SALES' | 'DOKTER' | 'MEMBER';
}

// ══════════════════════════════════════════════════════════
// HELPER: Fetch Incentive Data
// ══════════════════════════════════════════════════════════

async function fetchIncentiveData(filters: ExportFilters) {
  const where: Prisma.ReferralIncentiveRecordWhereInput = {};

  if (filters.referralId) {
    where.referralCodeId = filters.referralId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const records = await prisma.referralIncentiveRecord.findMany({
    where,
    include: {
      referralCode: {
        include: {
          branch: true,
        },
      },
      member: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      memberPackage: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Apply additional filters
  let filteredRecords = records;

  if (filters.branchId) {
    filteredRecords = filteredRecords.filter(
      (r) => r.referralCode.branchId === filters.branchId
    );
  }

  if (filters.referrerType) {
    filteredRecords = filteredRecords.filter(
      (r) => r.referralCode.referrerType === filters.referrerType
    );
  }

  return filteredRecords;
}

// ══════════════════════════════════════════════════════════
// EXPORT TO EXCEL
// ══════════════════════════════════════════════════════════

export async function exportIncentivesToExcel(
  filters: ExportFilters,
  res: Response
): Promise<void> {
  const records = await fetchIncentiveData(filters);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RAHO ERP';
  workbook.created = new Date();

  // Add worksheet
  const worksheet = workbook.addWorksheet('Laporan Insentif', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Define columns
  worksheet.columns = [
    { header: 'Tanggal', key: 'date', width: 12 },
    { header: 'Kode Referral', key: 'referralCode', width: 15 },
    { header: 'Nama Referrer', key: 'referrerName', width: 25 },
    { header: 'Tipe', key: 'referrerType', width: 12 },
    { header: 'Cabang', key: 'branch', width: 20 },
    { header: 'Member', key: 'memberName', width: 25 },
    { header: 'No. Member', key: 'memberNo', width: 15 },
    { header: 'Paket', key: 'packageName', width: 20 },
    { header: 'Kode Paket', key: 'packageCode', width: 15 },
    { header: 'Nilai Paket', key: 'packageValue', width: 15 },
    { header: 'Tipe Paket', key: 'packageType', width: 12 },
    { header: 'Insentif', key: 'incentiveRate', width: 12 },
    { header: 'Jumlah Insentif', key: 'incentiveAmount', width: 15 },
    { header: 'Catatan', key: 'notes', width: 30 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25;

  // Add data rows
  let totalIncentive = 0;

  records.forEach((record) => {
    const incentiveRate =
      record.incentiveType === 'PERCENTAGE'
        ? `${record.incentiveValue}%`
        : `Rp ${Number(record.incentiveValue).toLocaleString('id-ID')}`;

    worksheet.addRow({
      date: new Date(record.createdAt).toLocaleDateString('id-ID'),
      referralCode: record.referralCode.code,
      referrerName: record.referralCode.referrerName,
      referrerType: record.referralCode.referrerType,
      branch: record.referralCode.branch.name,
      memberName: record.member.user.profile?.fullName || '-',
      memberNo: record.member.memberNo,
      packageName: record.packageName,
      packageCode: record.memberPackage.packageCode,
      packageValue: Number(record.packageValue),
      packageType: record.isFirstPackage ? 'Pertama' : 'Lanjutan',
      incentiveRate,
      incentiveAmount: Number(record.incentiveAmount),
      notes: record.notes || '-',
    });

    totalIncentive += Number(record.incentiveAmount);
  });

  // Format currency columns
  worksheet.getColumn('packageValue').numFmt = '#,##0';
  worksheet.getColumn('incentiveAmount').numFmt = '#,##0';

  // Add total row
  const totalRow = worksheet.addRow({
    date: '',
    referralCode: '',
    referrerName: '',
    referrerType: '',
    branch: '',
    memberName: '',
    memberNo: '',
    packageName: '',
    packageCode: '',
    packageValue: '',
    packageType: '',
    incentiveRate: 'TOTAL',
    incentiveAmount: totalIncentive,
    notes: '',
  });

  totalRow.font = { bold: true, size: 12 };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };

  // Add borders to all cells
  worksheet.eachRow((row, _rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Add summary info at the top
  worksheet.insertRow(1, []);
  worksheet.insertRow(1, ['Periode:', filters.startDate && filters.endDate 
    ? `${filters.startDate.toLocaleDateString('id-ID')} - ${filters.endDate.toLocaleDateString('id-ID')}`
    : 'Semua'
  ]);
  worksheet.insertRow(1, ['Total Transaksi:', records.length]);
  worksheet.insertRow(1, ['Laporan Insentif Referral']);
  
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(2).font = { bold: true };
  worksheet.getRow(3).font = { bold: true };

  // Merge cells for title
  worksheet.mergeCells('A1:N1');
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // Set response headers
  const filename = `Laporan_Insentif_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
}

// ══════════════════════════════════════════════════════════
// EXPORT TO PDF
// ══════════════════════════════════════════════════════════

export async function exportIncentivesToPDF(
  filters: ExportFilters,
  res: Response
): Promise<void> {
  const records = await fetchIncentiveData(filters);

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
  });

  // Set response headers
  const filename = `Laporan_Insentif_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Pipe to response
  doc.pipe(res);

  // Add title
  doc.fontSize(18).font('Helvetica-Bold').text('Laporan Insentif Referral', {
    align: 'center',
  });

  doc.moveDown(0.5);

  // Add summary info
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Transaksi: ${records.length}`, { align: 'left' });
  
  if (filters.startDate && filters.endDate) {
    doc.text(
      `Periode: ${filters.startDate.toLocaleDateString('id-ID')} - ${filters.endDate.toLocaleDateString('id-ID')}`,
      { align: 'left' }
    );
  }

  doc.moveDown(1);

  // Table setup
  const tableTop = doc.y;
  const rowHeight = 20;
  const colWidths = [60, 80, 60, 100, 80, 60, 80, 80];
  const colPositions = [30];
  
  for (let i = 0; i < colWidths.length - 1; i++) {
    colPositions.push(colPositions[i] + colWidths[i]);
  }

  // Draw table header
  doc.fontSize(8).font('Helvetica-Bold');
  
  const headers = [
    'Tanggal',
    'Kode Referral',
    'Tipe',
    'Member',
    'Paket',
    'Nilai Paket',
    'Insentif',
    'Jumlah',
  ];

  // Header background
  doc.rect(30, tableTop, 800 - 60, rowHeight).fill('#4F46E5');
  
  doc.fillColor('white');
  headers.forEach((header, i) => {
    doc.text(header, colPositions[i] + 5, tableTop + 5, {
      width: colWidths[i] - 10,
      align: 'left',
    });
  });

  doc.fillColor('black');

  // Draw table rows
  let currentY = tableTop + rowHeight;
  let totalIncentive = 0;
  let pageRecords = 0;
  const maxRecordsPerPage = 20;

  records.forEach((record, index) => {
    // Check if we need a new page
    if (pageRecords >= maxRecordsPerPage) {
      doc.addPage();
      currentY = 30;
      pageRecords = 0;
    }

    const rowData = [
      new Date(record.createdAt).toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: '2-digit' 
      }),
      record.referralCode.code,
      record.referralCode.referrerType,
      record.member.user.profile?.fullName?.substring(0, 15) || '-',
      record.packageName.substring(0, 12),
      `Rp ${(Number(record.packageValue) / 1000).toFixed(0)}K`,
      record.incentiveType === 'PERCENTAGE'
        ? `${record.incentiveValue}%`
        : `${(Number(record.incentiveValue) / 1000).toFixed(0)}K`,
      `Rp ${(Number(record.incentiveAmount) / 1000).toFixed(0)}K`,
    ];

    // Alternate row colors
    if (index % 2 === 0) {
      doc.rect(30, currentY, 800 - 60, rowHeight).fill('#F9FAFB');
    }

    doc.fillColor('black').fontSize(7).font('Helvetica');
    
    rowData.forEach((data, i) => {
      doc.text(data, colPositions[i] + 5, currentY + 5, {
        width: colWidths[i] - 10,
        align: i >= 5 ? 'right' : 'left',
      });
    });

    // Draw row border
    doc.rect(30, currentY, 800 - 60, rowHeight).stroke('#E5E7EB');

    currentY += rowHeight;
    totalIncentive += Number(record.incentiveAmount);
    pageRecords++;
  });

  // Draw total row
  if (pageRecords >= maxRecordsPerPage - 2) {
    doc.addPage();
    currentY = 30;
  }

  doc.rect(30, currentY, 800 - 60, rowHeight).fill('#F3F4F6');
  doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
  doc.text('TOTAL INSENTIF', colPositions[6] + 5, currentY + 5);
  doc.text(
    `Rp ${totalIncentive.toLocaleString('id-ID')}`,
    colPositions[7] + 5,
    currentY + 5,
    { width: colWidths[7] - 10, align: 'right' }
  );

  // Add footer
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).font('Helvetica');
    doc.text(
      `Halaman ${i + 1} dari ${pageCount} | Dicetak: ${new Date().toLocaleString('id-ID')}`,
      30,
      doc.page.height - 30,
      { align: 'center' }
    );
  }

  // Finalize PDF
  doc.end();
}

// ══════════════════════════════════════════════════════════
// EXPORT SUMMARY REPORT (Per Referral)
// ══════════════════════════════════════════════════════════

export async function exportReferralSummaryExcel(
  filters: ExportFilters,
  res: Response
): Promise<void> {
  // Fetch all referral codes with their stats
  const where: Prisma.ReferralCodeWhereInput = { isActive: true };
  
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  
  if (filters.referrerType) {
    where.referrerType = filters.referrerType;
  }

  const referrals = await prisma.referralCode.findMany({
    where,
    include: {
      branch: true,
      _count: {
        select: {
          members: true,
          incentiveRecords: true,
        },
      },
    },
    orderBy: {
      totalIncentiveEarned: 'desc',
    },
  });

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Ringkasan Insentif');

  // Define columns
  worksheet.columns = [
    { header: 'Kode Referral', key: 'code', width: 15 },
    { header: 'Nama Referrer', key: 'name', width: 25 },
    { header: 'Tipe', key: 'type', width: 12 },
    { header: 'Cabang', key: 'branch', width: 20 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Total Referral', key: 'totalReferrals', width: 15 },
    { header: 'Total Transaksi', key: 'totalTransactions', width: 15 },
    { header: 'Total Insentif', key: 'totalIncentive', width: 18 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25;

  // Add data
  let grandTotal = 0;

  referrals.forEach((referral) => {
    worksheet.addRow({
      code: referral.code,
      name: referral.referrerName,
      type: referral.referrerType,
      branch: referral.branch.name,
      phone: referral.phone || '-',
      email: referral.email || '-',
      totalReferrals: referral.totalReferrals,
      totalTransactions: referral._count.incentiveRecords,
      totalIncentive: Number(referral.totalIncentiveEarned),
    });

    grandTotal += Number(referral.totalIncentiveEarned);
  });

  // Format currency
  worksheet.getColumn('totalIncentive').numFmt = '#,##0';

  // Add total row
  const totalRow = worksheet.addRow({
    code: '',
    name: '',
    type: '',
    branch: '',
    phone: '',
    email: '',
    totalReferrals: '',
    totalTransactions: 'GRAND TOTAL',
    totalIncentive: grandTotal,
    firstIncentive: '',
    nextIncentive: '',
  });

  totalRow.font = { bold: true, size: 12 };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };

  // Add borders
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Add title
  worksheet.insertRow(1, []);
  worksheet.insertRow(1, ['Tanggal:', new Date().toLocaleDateString('id-ID')]);
  worksheet.insertRow(1, ['Ringkasan Insentif Per Referral']);
  
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.mergeCells('A1:K1');
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // Set response
  const filename = `Ringkasan_Insentif_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}
