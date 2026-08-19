import ExcelJS from 'exceljs';
import { Role } from '@prisma/client';
import { LogisticsService } from '../logistics.service';

describe('homecare usage history Excel export', () => {
  it('creates a valid xlsx workbook with item rows', async () => {
    const service = new LogisticsService();
    jest.spyOn(service, 'getHomecareUsageHistory').mockResolvedValue({
      items: [{
        id: 'usage-item-1',
        usageId: 'usage-1',
        usageCode: 'HBU-001',
        usageDate: '2026-08-19T03:00:00.000Z',
        status: 'COMPLETED',
        branchId: 'branch-1',
        branchCode: 'BTV',
        branchName: 'RAHO Batavia',
        teamId: 'team-1',
        teamCode: 'TEAM-BTV-01',
        teamName: 'Tim Batavia 1',
        bagId: 'bag-1',
        bagCode: 'BAG-BTV-01',
        bagName: 'Tas Batavia 1',
        masterProductId: 'product-1',
        sku: 'IFA-NO-25',
        productName: 'IFA + NO 2,5ml',
        quantity: 2,
        unit: 'Botol',
        treatmentSessionId: 'session-1',
        sessionCode: 'SES-BTV-001',
        memberNo: 'MBR-BTV-001',
        memberName: 'Member Uji',
        usedBy: 'user-1',
        usedByName: 'Nakes Uji',
        notes: 'Pemakaian sesi',
      }],
      total: 1,
      page: 1,
      limit: 5000,
      usageCount: 1,
    });

    const result = await service.exportHomecareUsageHistory({
      userId: 'super-admin-1',
      role: Role.SUPER_ADMIN,
    });

    expect(result.filename).toMatch(/^history-penggunaan-inventori-tim-.*\.xlsx$/);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('Penggunaan Inventori Tim');
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getCell('A1').value).toBe('Tanggal');
    expect(sheet?.getCell('G2').value).toBe('IFA + NO 2,5ml');
    expect(sheet?.getCell('H2').value).toBe(2);
    expect(sheet?.getCell('L2').value).toBe('Member Uji');
  });
});
