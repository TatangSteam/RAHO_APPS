# Invoice Services - Modular Architecture

## Overview
Invoice service telah dimodularisasi menjadi 4 specialized services untuk meningkatkan maintainability dan separation of concerns.

## Service Structure

### 1. InvoiceCreationService (`invoice-creation.service.ts`)
**Tanggung Jawab**: Pembuatan dan update invoice
- `createInvoice()` - Membuat invoice baru (status DRAFT)
- `updateInvoice()` - Update invoice yang masih DRAFT
- `generateInvoiceNumber()` - Generate nomor invoice dengan auto-increment

**Key Features**:
- Kalkulasi otomatis subtotal, discount, tax, dan total
- Support multiple item types (PACKAGE, ADDON, NON_THERAPY)
- Generate deskripsi detail untuk setiap item
- Auto-generate invoice number dengan format: INV-{BRANCH}-{YYMM}-{SEQ}

### 2. InvoiceRetrievalService (`invoice-retrieval.service.ts`)
**Tanggung Jawab**: Pengambilan data invoice
- `getInvoiceById()` - Get invoice by ID
- `getInvoiceByPackageId()` - Get invoice by package ID
- `getMemberInvoices()` - Get semua invoice member
- `formatInvoice()` - Format invoice untuk API response

**Key Features**:
- Include semua relasi (member, branch, items, payments)
- Format data untuk konsistensi API response
- Convert Decimal ke Number untuk JSON serialization

### 3. InvoicePaymentService (`invoice-payment.service.ts`)
**Tanggung Jawab**: Proses pembayaran invoice
- `finalizeInvoice()` - Finalize invoice (DRAFT → PENDING_PAYMENT)
- `recordPayment()` - Record pembayaran dan update status

**Key Features**:
- Support partial payment
- Auto-update status ke PAID jika sudah lunas
- Track total paid amount
- Validasi status invoice sebelum payment

### 4. InvoiceCancellationService (`invoice-cancellation.service.ts`)
**Tanggung Jawab**: Pembatalan invoice
- `cancelInvoice()` - Cancel invoice dengan reason

**Key Features**:
- Validasi invoice tidak bisa dicancel jika sudah PAID
- Append cancellation reason ke notes
- Update status dan timestamp

## Main Service (invoices.service.ts)
Main service bertindak sebagai **orchestrator** yang:
- Menginstansiasi semua specialized services
- Delegate calls ke service yang sesuai
- Maintain backward compatibility dengan existing code

## Usage Example

```typescript
import { invoiceService } from './invoices.service';

// Create invoice
const invoice = await invoiceService.createInvoice({
  memberId: 'xxx',
  items: [
    { itemType: 'PACKAGE', itemId: 'pkg-id', quantity: 1 }
  ],
  discountPercent: 10,
  taxPercent: 0,
}, userId);

// Get invoice
const invoice = await invoiceService.getInvoiceById(invoiceId);

// Record payment
await invoiceService.recordPayment(invoiceId, {
  amount: 1000000,
  paymentMethod: 'CASH',
}, userId);

// Cancel invoice
await invoiceService.cancelInvoice(invoiceId, {
  reason: 'Member request'
});
```

## Benefits
1. **Separation of Concerns**: Setiap service fokus pada satu tanggung jawab
2. **Easier Testing**: Service lebih kecil dan mudah di-test
3. **Better Maintainability**: Perubahan pada satu area tidak affect area lain
4. **Code Reusability**: Service bisa digunakan independently
5. **Clearer Code Organization**: Lebih mudah navigate dan understand

## Migration Notes
- ✅ No breaking changes - semua existing code tetap berfungsi
- ✅ Main service maintain same interface
- ✅ All methods delegated ke specialized services
- ✅ Backward compatible dengan existing controllers

## File Structure
```
invoices/
├── invoices.service.ts              # Main orchestrator (100 lines)
├── services/
│   ├── invoice-creation.service.ts      # 200 lines
│   ├── invoice-retrieval.service.ts     # 150 lines
│   ├── invoice-payment.service.ts       # 100 lines
│   ├── invoice-cancellation.service.ts  # 50 lines
│   └── README.md                        # Documentation
```

## Next Steps
- Consider adding invoice search/filter service
- Add invoice reporting service
- Add invoice notification service
