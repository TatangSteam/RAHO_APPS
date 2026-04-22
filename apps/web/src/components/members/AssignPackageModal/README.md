# AssignPackageModal - Modular Structure

Komponen modal untuk assign paket terapi ke member dengan struktur modular yang lebih maintainable.

## Struktur File

```
AssignPackageModal/
├── index.tsx                    # Main component (orchestrator)
├── usePackageSelection.ts       # Custom hook untuk logic selection
├── BasicPackageSection.tsx      # Section untuk paket basic
├── BoosterPackageSection.tsx    # Section untuk paket booster
├── AddOnSection.tsx             # Section untuk add-ons
├── DiscountSection.tsx          # Section untuk discount
├── PreviewSection.tsx           # Section untuk preview total
└── README.md                    # Dokumentasi ini
```

## Komponen

### index.tsx
Main component yang mengorkestra semua sub-komponen. Menangani:
- State management
- Portal rendering
- Modal backdrop click handling
- Footer dengan tombol Batal dan Assign

### usePackageSelection.ts
Custom hook yang berisi semua logic untuk:
- Basic package selection (toggle, update qty)
- Booster package selection (toggle, update qty, update service type)
- Add-on selection (toggle, update qty)
- Preview calculation (subtotal, discount, total)

### BasicPackageSection.tsx
Menampilkan daftar paket basic dengan:
- Checkbox untuk select/deselect
- Input quantity ketika dipilih
- Total sesi dan harga

### BoosterPackageSection.tsx
Menampilkan grid booster types dengan:
- Checkbox per kombinasi (pricingId × boosterType)
- Dropdown untuk pilih service type (PM, PS, PTY, dll)
- Input quantity
- Price summary (per sesi, total sesi, total)

### AddOnSection.tsx
Menampilkan add-ons dalam 2 kategori:
- Air Nano (berbagai varian)
- Rokok Kenkou
- Quantity input dan total price per add-on

### DiscountSection.tsx
Input untuk:
- Diskon persentase (0-100%)
- Diskon nominal (Rp) dengan format titik
- Catatan diskon
- Notes tambahan

### PreviewSection.tsx
Menampilkan:
- Daftar item yang dipilih dengan harga
- Breakdown diskon (% + Rp)
- Total akhir

## Keuntungan Struktur Modular

1. **Maintainability**: Setiap section terpisah, mudah di-update
2. **Reusability**: Hook `usePackageSelection` bisa digunakan di komponen lain
3. **Testability**: Setiap komponen bisa di-test secara independen
4. **Readability**: Main component lebih clean dan mudah dipahami
5. **Scalability**: Mudah menambah section baru atau modify existing

## Usage

```tsx
import AssignPackageModal from '@/components/members/AssignPackageModal';

<AssignPackageModal
  show={showModal}
  pricings={pricingsList}
  assignData={assignData}
  submitting={isSubmitting}
  onClose={() => setShowModal(false)}
  onAssignDataChange={setAssignData}
  onSubmit={handleSubmit}
/>
```

## Styling

Semua komponen menggunakan CSS modules dari `AssignPackageModal.module.css` yang sudah ada.
