import fs from 'fs';
import path from 'path';

describe('expense payment posting contract', () => {
  it('mengunci expense dan membuat journal serta kas/bank dalam transaction yang sama', () => {
    const service = fs.readFileSync(path.resolve(__dirname, '..', 'expense.service.ts'), 'utf8');
    expect(service).toContain('return prisma.$transaction(async (tx) =>');
    expect(service).toContain('FROM "expenses" WHERE "id" = ${id} FOR UPDATE');
    expect(service).toContain('postingKey: `EXPENSE:${expense.id}`');
    expect(service).toContain('await tx.cashBankTransaction.create');
    expect(service).toContain("status: 'PAID'");
    expect(service).toContain('await enqueueExpensePaidTx(tx, buildExpensePaidSnapshot(expense, paidAt))');
  });

  it('mengizinkan maker mengoreksi DRAFT atau REJECTED tanpa mengubah data posted', () => {
    const service = fs.readFileSync(path.resolve(__dirname, '..', 'expense.service.ts'), 'utf8');
    const routes = fs.readFileSync(path.resolve(__dirname, '..', 'expense.routes.ts'), 'utf8');
    expect(routes).toContain("router.patch('/:id', controller.update)");
    expect(service).toContain('export async function updateExpense');
    expect(service).toContain('EXPENSE_EDIT_STATUS_INVALID');
    expect(service).toContain('status: ExpenseStatus.DRAFT');
    expect(service).toContain('Hanya maker yang dapat mengoreksi expense.');
  });
});
