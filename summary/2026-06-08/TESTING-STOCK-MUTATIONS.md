# Testing Guide: Stock Mutation History

**Date**: 8 Juni 2026  
**Feature**: Stock Mutation History Page  
**URL**: `/inventory/stock-mutations`

---

## 🧪 **QUICK TEST CHECKLIST**

### **✅ Test 1: Access Page (1 min)**
```
1. Login as any staff role
2. Click sidebar → Inventori → "Mutasi Stok"
3. Page loads at /inventory/stock-mutations
4. Should see title "📊 Riwayat Mutasi Stok"
5. Should see filters bar (Tipe, Dari Tanggal, Sampai Tanggal, Export button)
6. Should see table with mutations
```

**Expected Result**: Page loads successfully with data

---

### **✅ Test 2: Filter by Type (1 min)**
```
1. On Stock Mutations page
2. Click "Tipe" dropdown
3. Select "Digunakan" (USED)
4. Table updates automatically
5. All rows should have red "DIGUNAKAN" badge
6. All quantities should be negative (e.g., -52)
```

**Expected Result**: Only USED mutations are shown

---

### **✅ Test 3: Filter by Date Range (2 min)**
```
1. Set "Dari Tanggal" to 2026-06-01
2. Set "Sampai Tanggal" to 2026-06-07
3. Table updates automatically
4. Check dates in "Tanggal" column
5. All dates should be between 1-7 June 2026
```

**Expected Result**: Only mutations within date range are shown

---

### **✅ Test 4: Export to Excel (2 min)**
```
1. Click "📥 Export Excel" button
2. File downloads (stock-mutations-[timestamp].xlsx)
3. Open Excel file
4. Verify headers:
   - Tanggal, Item, SKU, Type, Quantity, Stock Before, Stock After, Reference, User, Notes
5. Verify header row is bold with gold background
6. Verify data matches filtered results on page
```

**Expected Result**: Excel file downloads with correct data

---

### **✅ Test 5: Click Reference Link (1 min)**
```
1. Find a row with session reference (e.g., SES-2026-001)
2. Should see member name below session code
3. Click the session code link
4. Should navigate to /sessions/[sessionId]
5. Session detail page opens
```

**Expected Result**: Navigation to session detail works

---

### **✅ Test 6: Pagination (2 min)**
```
1. If total mutations > 50:
   - Should see "Halaman 1 dari X" at bottom
   - "Selanjutnya →" button enabled
   - "← Sebelumnya" button disabled
2. Click "Selanjutnya →"
   - Page number changes to 2
   - Table shows next 50 mutations
   - "← Sebelumnya" button enabled
3. Click "← Sebelumnya"
   - Returns to page 1
```

**Expected Result**: Pagination works correctly

---

### **✅ Test 7: UI/UX Elements (1 min)**
```
Check:
- ✅ Color badges for mutation types:
  - Red: DIGUNAKAN
  - Green: DITERIMA
  - Blue: PENYESUAIAN
  - Orange: DIKEMBALIKAN
- ✅ Negative quantities in red (-52)
- ✅ Positive quantities in green (+100)
- ✅ Stock Before → After (e.g., 147 → 95)
- ✅ Item name bold, SKU below in gray
- ✅ Hover effect on table rows
```

**Expected Result**: All UI elements styled correctly

---

## 🎯 **REAL-WORLD USE CASES**

### **Use Case 1: Track Material Usage in Sessions**
```
Scenario: Admin wants to see which sessions used INF001 (Infus Set)

Steps:
1. Go to /inventory/stock-mutations
2. Look for rows with:
   - Item: "Infus Set" (SKU: INF001)
   - Type: "DIGUNAKAN" (red badge)
   - Quantity: negative (e.g., -52)
3. Check "Referensi" column for session codes
4. Click session code to view session details

Expected: Can track all sessions that used INF001
```

---

### **Use Case 2: Monthly Usage Report**
```
Scenario: Manager wants to export material usage for June 2026

Steps:
1. Go to /inventory/stock-mutations
2. Set "Tipe" to "Digunakan"
3. Set "Dari Tanggal" to 2026-06-01
4. Set "Sampai Tanggal" to 2026-06-30
5. Click "📥 Export Excel"
6. Open Excel file
7. Use Excel to sum quantities by item

Expected: Complete monthly usage report in Excel
```

---

### **Use Case 3: Audit Stock Adjustments**
```
Scenario: Admin wants to review all manual stock adjustments

Steps:
1. Go to /inventory/stock-mutations
2. Set "Tipe" to "Penyesuaian"
3. Review table for:
   - Date & time
   - Item adjusted
   - Quantity changed
   - User who made adjustment
   - Notes (reason)

Expected: Complete audit trail of adjustments
```

---

### **Use Case 4: Verify Shipment Receipt**
```
Scenario: Admin wants to confirm which items were received from shipment

Steps:
1. Go to /inventory/stock-mutations
2. Set "Tipe" to "Diterima"
3. Find rows with shipment reference (e.g., SHP-2026-042)
4. Check:
   - Items received
   - Quantities
   - Stock before → after
   - Date received
   - User who received

Expected: Complete receipt confirmation
```

---

## 🔍 **TROUBLESHOOTING**

### **Problem: Page shows "Tidak ada data mutasi stok"**
**Possible Causes:**
1. No mutations exist in database yet
2. Filters are too restrictive
3. User doesn't have access to any branches

**Solutions:**
1. Create a test session with material usage
2. Clear filters (set all to default)
3. Check user's branchId and role

---

### **Problem: Export button downloads empty file**
**Possible Causes:**
1. No mutations match current filters
2. API endpoint not responding

**Solutions:**
1. Clear filters and try again
2. Check browser console for errors
3. Check API logs

---

### **Problem: Reference links don't work**
**Possible Causes:**
1. Session ID is invalid
2. User doesn't have permission to view session
3. Session was deleted

**Solutions:**
1. Check if session exists in database
2. Verify user role has session access
3. Check API logs for authorization errors

---

## 📊 **SAMPLE TEST DATA**

To create test data for this feature:

```sql
-- Check existing stock mutations
SELECT 
  sm.type,
  mp.name as item_name,
  sm.quantity,
  sm.stockBefore,
  sm.stockAfter,
  sm.createdAt
FROM stock_mutations sm
JOIN inventory_items ii ON sm.inventoryItemId = ii.id
JOIN master_products mp ON ii.masterProductId = mp.id
ORDER BY sm.createdAt DESC
LIMIT 10;
```

Or create a test session with material usage:
1. Go to /sessions
2. Create new session
3. Complete Step 6 (Materials)
4. Add some materials with quantities
5. Complete session
6. Check stock mutations page

---

## ✅ **ACCEPTANCE CRITERIA**

Feature is ready when:
- [x] Page accessible from sidebar menu
- [x] Table displays all mutation data
- [x] Filters work (type, date range)
- [x] Pagination works (if >50 mutations)
- [x] Export to Excel works
- [x] Reference links navigate correctly
- [x] Color badges display correctly
- [x] Responsive on different screen sizes
- [x] Works for all staff roles
- [x] No console errors
- [x] API responds in <2 seconds

---

**Total Testing Time**: ~10 minutes  
**Critical Tests**: Test 1, 2, 4, 5  
**Optional Tests**: Test 3, 6, 7
