# Invoice Components

Professional invoice management components for RAHO system.

## Components

### InvoiceView
Displays a single invoice in a professional, print-ready format.

**Features:**
- Professional header with company branding
- Clear invoice details (number, date, due date)
- Bill-to information
- Itemized table with product codes, quantities, descriptions, and prices
- Financial summary (subtotal, discount, tax, total)
- Payment information (bank details)
- Notes section
- Signature/approval section
- Print and PDF download functionality
- Status badges with color coding
- Responsive design for mobile viewing

**Usage:**
```tsx
import InvoiceView from '@/components/invoices/InvoiceView';

<InvoiceView 
  invoice={invoiceData}
  onClose={() => setShowInvoice(false)}
/>
```

**Props:**
- `invoice: Invoice` - Invoice data object
- `onClose?: () => void` - Callback when closing the view

### InvoiceList
Displays a list of invoices with filtering and sorting capabilities.

**Features:**
- Tabular display of all invoices
- Filter by status (Draft, Pending Payment, Paid, Overdue, Cancelled)
- Status badges with color coding
- Quick view button to open invoice details
- Responsive table design
- Empty state handling
- Refresh functionality

**Usage:**
```tsx
import InvoiceList from '@/components/invoices/InvoiceList';

<InvoiceList 
  invoices={invoiceArray}
  loading={isLoading}
  onRefresh={handleRefresh}
/>
```

**Props:**
- `invoices: Invoice[]` - Array of invoice objects
- `loading?: boolean` - Loading state indicator
- `onRefresh?: () => void` - Callback for refresh button

## Styling

Both components use CSS modules for scoped styling:
- `InvoiceView.module.css` - Invoice detail view styles
- `InvoiceList.module.css` - Invoice list styles

### Color Scheme
- **Primary Blue**: #1976d2 - Headers, highlights, primary actions
- **Status Colors**:
  - Draft: Gray (#e0e0e0)
  - Pending Payment: Yellow (#fff3cd)
  - Paid: Green (#d4edda)
  - Overdue/Cancelled: Red (#f8d7da)

### Print Styles
Both components include print-optimized CSS:
- Hides toolbar and controls
- Optimizes spacing and margins
- Ensures proper page breaks
- Professional A4 formatting

## Invoice Data Structure

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberNo?: string;
  branchId: string;
  branchName: string;
  
  // Financial
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  taxPercent?: number;
  taxAmount?: number;
  totalAmount: number;
  
  // Status
  status: 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';
  dueDate?: string;
  paidAt?: string;
  cancelledAt?: string;
  
  // Payment
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  paymentNotes?: string;
  
  // Metadata
  notes?: string;
  createdBy: string;
  createdByName: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

interface InvoiceItem {
  id: string;
  itemType: 'PACKAGE' | 'ADDON' | 'NON_THERAPY';
  itemId: string;
  code?: string;
  description: string;
  subDescription?: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
}
```

## PDF Generation

The `generateInvoicePDF()` function in `pdfGenerator.ts` creates professional PDF invoices with:
- Company header with branding
- Invoice details and bill-to information
- Itemized table
- Financial summary
- Payment information
- Signature section
- Page numbers for multi-page invoices

**Usage:**
```tsx
import { generateInvoicePDF } from '@/lib/pdfGenerator';

await generateInvoicePDF(invoice);
```

## Features

### Professional Design
- Clean, modern layout
- Consistent branding
- Professional color scheme
- Clear typography hierarchy

### User-Friendly
- Intuitive navigation
- Clear status indicators
- Easy filtering and searching
- Quick actions

### Print-Ready
- Optimized for printing
- Professional formatting
- Proper page breaks
- Print-friendly colors

### Responsive
- Mobile-friendly design
- Adaptive layouts
- Touch-friendly buttons
- Readable on all screen sizes

### Accessible
- Semantic HTML
- Proper color contrast
- Clear labels and descriptions
- Keyboard navigation support

## Integration

To integrate invoices into your application:

1. **Display Invoice List:**
```tsx
import InvoiceList from '@/components/invoices/InvoiceList';

function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  
  return <InvoiceList invoices={invoices} />;
}
```

2. **Display Single Invoice:**
```tsx
import InvoiceView from '@/components/invoices/InvoiceView';

function InvoiceDetailPage() {
  const [invoice, setInvoice] = useState(null);
  
  return <InvoiceView invoice={invoice} />;
}
```

3. **Generate PDF:**
```tsx
import { generateInvoicePDF } from '@/lib/pdfGenerator';

async function downloadInvoice(invoice) {
  await generateInvoicePDF(invoice);
}
```

## Customization

### Company Information
Edit the constants in `InvoiceView.tsx` and `pdfGenerator.ts`:
```typescript
const COMPANY_NAME = 'Your Company Name';
const COMPANY_LEGAL = 'Your Legal Name';
const COMPANY_ADDRESS = 'Your Address';
const BANK_ACCOUNT = 'Your Bank Account';
```

### Colors
Modify CSS variables in the module files:
```css
--color-primary-500: #1976d2;
--color-primary-600: #1565c0;
```

### Layout
Adjust spacing, fonts, and layout in the CSS modules.

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support with responsive design

## Performance

- Lazy loading of invoice details
- Efficient table rendering
- Optimized PDF generation
- Minimal re-renders with React hooks

## Future Enhancements

- Email invoice functionality
- Invoice templates customization
- Recurring invoices
- Payment reminders
- Invoice analytics
- Multi-currency support
- Digital signatures
- QR code for payment
