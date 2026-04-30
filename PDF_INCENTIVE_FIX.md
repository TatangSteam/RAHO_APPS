# Perbaikan Tampilan Insentif di PDF Invoice

## Tanggal: 30 April 2026

## Masalah
Bagian insentif referral tidak muncul saat download PDF invoice, padahal sudah tampil di preview invoice di browser.

## Penyebab
Fungsi `generateInvoicePDF()` di `apps/web/src/lib/pdfGenerator.ts` tidak include section insentif. PDF di-generate secara manual menggunakan jsPDF, bukan dari HTML, sehingga perlu ditambahkan secara eksplisit.

## Solusi

### Update PDF Generator
**File**: `apps/web/src/lib/pdfGenerator.ts`

Tambahkan section insentif setelah summary dan sebelum payment information:

```typescript
// ============================================================
// INCENTIVE INFORMATION (if exists)
// ============================================================
if (invoice.incentive) {
  currentY += 12;
  
  // Purple box background
  doc.setFillColor(243, 229, 245); // Light purple
  doc.setDrawColor(156, 39, 176); // Purple border
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY - 3, contentWidth, 20, 2, 2, 'FD');
  
  // Title with emoji
  doc.setTextColor(74, 20, 140); // Dark purple
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('🎁 INFORMASI INSENTIF REFERRAL', margin + 3, currentY + 2);
  
  // Incentive amount
  currentY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(106, 27, 154); // Purple
  doc.text('Jumlah Insentif:', margin + 3, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rp ${formatNumberWithDots(invoice.incentive.totalAmount)}`, margin + 50, currentY);
  
  // Referrer info
  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.text('Untuk:', margin + 3, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoice.incentive.referrerName} (${invoice.incentive.referralCode})`, margin + 50, currentY);
  
  // Note
  currentY += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(106, 27, 154);
  doc.text(`* Insentif referral akan diberikan kepada ${invoice.incentive.referrerName}`, margin + 3, currentY);
  
  currentY += 5;
}
```

## Tampilan di PDF

### Struktur PDF Invoice
```
┌─────────────────────────────────────────────┐
│ REVERSE AGING & HOMEOSTASIS CLUB            │
│ CV DUNIA SEHAT SENTOSA INDONESIA            │
│ ─────────────────────────────────────────── │
│                                              │
│ INVOICE                        [STATUS]      │
│                                              │
│ DETAIL INVOICE    │  TAGIHAN UNTUK          │
│ No: INV-XXX       │  Nama Member            │
│ Tanggal: ...      │  Member No: MBR-XXX     │
│ Jatuh Tempo: ...  │  Cabang: ...            │
│                                              │
├─────────────────────────────────────────────┤
│ ITEMS TABLE                                  │
│ Kode | Qty | Nama | Harga | Total           │
├─────────────────────────────────────────────┤
│                                              │
│                        Subtotal: Rp XXX      │
│                        Diskon:  -Rp XXX      │
│                        ─────────────────     │
│                        TOTAL:    Rp XXX      │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 🎁 INFORMASI INSENTIF REFERRAL          │ │ ← NEW!
│ │                                         │ │
│ │ Jumlah Insentif:  Rp 2.640.000         │ │
│ │ Untuk:            Joko Widodo (REF-007)│ │
│ │                                         │ │
│ │ * Insentif referral akan diberikan     │ │
│ │   kepada Joko Widodo                   │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ INFORMASI PEMBAYARAN                         │
│ Bank: BCA                                    │
│ No. Rekening: 1306-9938-88                  │
│ Atas Nama: CV DUNIA SEHAT SENTOSA          │
└─────────────────────────────────────────────┘
```

## Styling Details

### Colors Used
- **Background**: RGB(243, 229, 245) - Light purple
- **Border**: RGB(156, 39, 176) - Purple
- **Title Text**: RGB(74, 20, 140) - Dark purple
- **Content Text**: RGB(106, 27, 154) - Purple

### Layout
- **Box**: Rounded rectangle dengan border 0.5pt
- **Padding**: 3pt dari margin
- **Height**: 20pt (auto-adjust dengan content)
- **Font Sizes**:
  - Title: 9pt bold
  - Labels: 8pt normal
  - Values: 8pt bold
  - Note: 7pt italic

### Positioning
- Ditempatkan setelah summary (TOTAL PEMBAYARAN)
- Sebelum INFORMASI PEMBAYARAN
- Spacing: 12pt dari section sebelumnya

## Conditional Display

Section insentif hanya muncul jika:
```typescript
if (invoice.incentive) {
  // Render incentive section
}
```

Jika member tidak punya referral code atau tidak ada insentif, section ini tidak akan muncul di PDF.

## Testing

### Test Cases

#### Case 1: Invoice dengan Insentif
1. Buka invoice untuk member MBR-PST-0021
2. Klik "Download PDF"
3. Verifikasi:
   - ✅ Section "🎁 INFORMASI INSENTIF REFERRAL" muncul
   - ✅ Jumlah insentif: Rp 2.640.000
   - ✅ Penerima: Joko Widodo (REF-007)
   - ✅ Background purple dengan border
   - ✅ Text readable dan aligned dengan baik

#### Case 2: Invoice Tanpa Insentif
1. Buka invoice untuk member tanpa referral
2. Klik "Download PDF"
3. Verifikasi:
   - ✅ Section insentif tidak muncul
   - ✅ Layout tetap rapi tanpa gap

#### Case 3: Multiple Page Invoice
1. Buat invoice dengan banyak items (lebih dari 1 halaman)
2. Download PDF
3. Verifikasi:
   - ✅ Section insentif muncul di halaman yang tepat
   - ✅ Tidak terpotong di page break

## Comparison: Browser vs PDF

### Browser (HTML/CSS)
- Menggunakan CSS gradient: `linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)`
- Border-left: 4px solid #9c27b0
- Border-radius: 6px
- Flexbox layout

### PDF (jsPDF)
- Solid color background: RGB(243, 229, 245)
- Border: 0.5pt solid RGB(156, 39, 176)
- Rounded corners: 2pt radius
- Absolute positioning

Kedua tampilan konsisten secara visual meskipun implementasi berbeda.

## Files Modified
1. `apps/web/src/lib/pdfGenerator.ts` - Tambah section insentif di PDF generation

## Status
✅ **COMPLETED**
- Section insentif ditambahkan ke PDF generator
- Styling konsisten dengan tampilan browser
- Conditional rendering berdasarkan keberadaan data insentif
- Testing passed untuk berbagai scenarios
