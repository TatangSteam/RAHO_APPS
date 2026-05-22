# Staff Performance Dashboard Feature

**Date**: 22 Mei 2026  
**Status**: ✅ Complete

## Overview

Implemented a Staff Performance Dashboard that allows ADMIN_CABANG and above (ADMIN_MANAGER, SUPER_ADMIN) to view staff performance metrics and session history.

## Features

### 1. Performance Summary Page (`/staff-performance`)
- Table showing all staff in a branch with performance breakdown
- Columns: Staff Info | Role | Dokter | Nakes | Admin | Total | Aksi
- Summary cards showing total sessions by position
- Filters:
  - Branch selector (for ADMIN_MANAGER and SUPER_ADMIN)
  - Date range filter
  - Search by name/staff code
- Pagination support

### 2. Staff Detail Page (`/staff-performance/[staffId]`)
- Staff profile card with summary stats
- Session history list showing all therapy sessions
- Position badges showing which role(s) the staff held in each session
- Filters:
  - Position filter (All, Dokter, Nakes, Admin Layanan)
  - Date range filter
- Click on session to navigate to session detail page
- Pagination support

## Access Control

- **SUPER_ADMIN**: Can view all branches
- **ADMIN_MANAGER**: Can view all branches
- **ADMIN_CABANG**: Can only view their own branch

## Files Changed

### Backend (API)

1. **`apps/api/src/modules/users/services/staff-performance.service.ts`** (Created)
   - `getStaffPerformanceSummaryService()` - Returns staff list with performance counts
   - `getStaffSessionHistoryService()` - Returns detailed session history for a staff

2. **`apps/api/src/modules/users/users.controller.ts`** (Updated)
   - Added `getStaffPerformanceSummary()` controller
   - Added `getStaffSessionHistory()` controller

3. **`apps/api/src/modules/users/users.routes.ts`** (Updated)
   - Added `GET /users/performance/summary` route
   - Added `GET /users/performance/:staffId/history` route

### Frontend (Web)

1. **`apps/web/src/lib/usersApi.ts`** (Updated)
   - Added TypeScript interfaces for performance data
   - Added `getStaffPerformanceSummary()` API function
   - Added `getStaffSessionHistory()` API function

2. **`apps/web/src/app/(staff)/staff-performance/page.tsx`** (Created)
   - Summary table page with filters and pagination

3. **`apps/web/src/app/(staff)/staff-performance/[staffId]/page.tsx`** (Created)
   - Detail page with session history

4. **`apps/web/src/components/layout/Sidebar.tsx`** (Updated)
   - Added "Kinerja Staff" menu item under "Manajemen" section
   - Visible to: SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG

## API Endpoints

### GET `/api/users/performance/summary`
Query params:
- `branchId` (required for ADMIN_MANAGER/SUPER_ADMIN)
- `startDate` (optional)
- `endDate` (optional)
- `page` (default: 1)
- `limit` (default: 50)

Response:
```json
{
  "branch": { "id", "branchCode", "name" },
  "staff": [
    {
      "id", "email", "role", "staffCode", "fullName", "phone", "avatarUrl",
      "performance": { "asDoctor", "asNurse", "asAdminLayanan", "total" }
    }
  ],
  "total", "page", "limit",
  "dateRange": { "startDate", "endDate" }
}
```

### GET `/api/users/performance/:staffId/history`
Query params:
- `position` (optional: 'doctor' | 'nurse' | 'adminLayanan' | 'all')
- `startDate` (optional)
- `endDate` (optional)
- `page` (default: 1)
- `limit` (default: 20)

Response:
```json
{
  "staff": { "id", "email", "role", "staffCode", "fullName", "phone", "avatarUrl", "branch" },
  "summary": { "asDoctor", "asNurse", "asAdminLayanan", "total" },
  "sessions": [
    {
      "id", "sessionCode", "infusKe", "pelaksanaan", "treatmentDate", "isCompleted",
      "branch", "member", "package", "positions"
    }
  ],
  "total", "page", "limit",
  "dateRange": { "startDate", "endDate" }
}
```

## UI Design

- Dark theme compatible with `dark:bg-[#0a0a0a]` background
- Amber/gold accent colors matching Raho Premier Club branding
- Indonesian language for all UI text
- Responsive design for mobile and desktop
- Consistent with existing page patterns in the project

## Testing

To test this feature:
1. Login as ADMIN_CABANG, ADMIN_MANAGER, or SUPER_ADMIN
2. Navigate to "Kinerja Staff" in the sidebar (under Manajemen section)
3. For ADMIN_MANAGER/SUPER_ADMIN: Select a branch first
4. View the performance summary table
5. Click "Detail" on any staff to see their session history
6. Use filters to narrow down results by date or position
