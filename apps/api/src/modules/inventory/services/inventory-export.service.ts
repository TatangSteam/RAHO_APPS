import { Prisma, PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

export class InventoryExportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get inventory data for export
   */
  async getInventoryDataForExport(branchId?: string) {
    const where: Prisma.InventoryItemWhereInput = {};
    
    if (branchId) {
      where.branchId = branchId;
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        masterProduct: true,
        branch: true,
      },
      orderBy: [
        { branch: { branchCode: 'asc' } },
        { masterProduct: { category: 'asc' } },
        { masterProduct: { name: 'asc' } },
      ],
    });

    return inventoryItems.map((item) => {
      const product = item.masterProduct;
      const branch = item.branch;
      
      // Calculate usage stock
      const stock = Number(item.stock);
      const conversionFactor = Number(product.conversionFactor);
      const usageStock = stock * conversionFactor;
      
      // Calculate min threshold in usage unit
      const minThreshold = Number(item.minThreshold);
      const minThresholdUsage = minThreshold * conversionFactor;
      
      // Check if low stock
      const isLowStock = stock <= minThreshold;
      
      return {
        'Kode Cabang': branch.branchCode,
        'Nama Cabang': branch.name,
        'Nama Produk': product.name,
        'Kategori': product.category,
        'Deskripsi': product.description || '-',
        'Satuan Penyimpanan': product.baseUnit,
        'Stok (Penyimpanan)': stock.toFixed(2),
        'Min. Threshold (Penyimpanan)': minThreshold.toFixed(2),
        'Satuan Penggunaan': product.usageUnit,
        'Stok (Penggunaan)': usageStock.toFixed(2),
        'Min. Threshold (Penggunaan)': minThresholdUsage.toFixed(2),
        'Faktor Konversi': conversionFactor.toFixed(2),
        'Status': isLowStock ? 'Stok Rendah' : 'Normal',
        'Lokasi Penyimpanan': item.storageLocation || '-',
        'Terakhir Diupdate': item.updatedAt.toLocaleDateString('id-ID'),
      };
    });
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(branchId?: string): Promise<string> {
    const data = await this.getInventoryDataForExport(branchId);
    
    if (data.length === 0) {
      return '';
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma or newline
            const escaped = String(value).replace(/"/g, '""');
            return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  /**
   * Export to Excel format - EXACT COPY of member export that works
   */
  async exportToExcel(branchId?: string): Promise<Buffer> {
    const data = await this.getInventoryDataForExport(branchId);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Inventori');

    if (data.length === 0) {
      return Buffer.from('');
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => row[header] || '');
      worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50); // Max width 50
    });

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

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Generate buffer - EXACT SAME as member export
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
