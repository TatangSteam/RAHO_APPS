import fs from 'fs';
import path from 'path';

describe('opening stock atomic posting contract', () => {
  it('membuat journal dan FIFO cost layer dalam transaction client yang sama', () => {
    const root = path.resolve(__dirname, '..', '..');
    const openingService = fs.readFileSync(path.join(root, 'opening-balance', 'opening-balance.service.ts'), 'utf8');
    const inventoryService = fs.readFileSync(path.join(root, 'inventory', 'services', 'inventory-ledger.service.ts'), 'utf8');

    expect(openingService).toContain('return prisma.$transaction(async (tx) =>');
    expect(openingService).toContain('postJournal({');
    expect(openingService).toContain('receiveOpeningInventoryInTransaction(userId');
    expect(openingService).toMatch(/receiveOpeningInventoryInTransaction[\s\S]*?, tx\)/);
    expect(inventoryService).toContain('type: InventoryPostingType.OPENING');
    expect(inventoryService).toContain('await tx.inventoryCostLayer.create');
  });
});
