# Stock Requests Page - Modularization

This page has been refactored from a single 978-line file into a modular structure for better maintainability and reusability.

## File Structure

```
stock-requests/
├── page.tsx                    # Main page component (refactored)
├── page.original.tsx          # Original monolithic file (backup)
├── types.ts                   # TypeScript interfaces
├── components/
│   ├── index.ts              # Component exports
│   ├── StockRequestCard.tsx  # Individual request card
│   ├── ReviewModal.tsx       # Approve/reject modal
│   ├── CreateRequestModal.tsx # Create new request modal
│   ├── SearchFilters.tsx     # Search and filter controls
│   ├── InventoryItemSelector.tsx # Inventory item selection
│   └── RequestItemsList.tsx  # Selected items management
├── hooks/
│   ├── useStockRequests.ts   # Stock requests data fetching
│   └── useInventoryItems.ts  # Inventory items data fetching
└── README.md                 # This documentation
```

## Components Overview

### 1. **StockRequestCard** (`components/StockRequestCard.tsx`)
- **Purpose**: Displays individual stock request information
- **Props**: `request`, `userRole`, `onReview`
- **Features**: Status badges, item preview, action buttons for SUPER_ADMIN

### 2. **ReviewModal** (`components/ReviewModal.tsx`)
- **Purpose**: Modal for approving/rejecting stock requests
- **Props**: `request`, `onClose`, `onApprove`, `onReject`, `loading`
- **Features**: Request details, review notes input, approve/reject actions

### 3. **CreateRequestModal** (`components/CreateRequestModal.tsx`)
- **Purpose**: Modal for creating new stock requests
- **Props**: `isOpen`, `onClose`, `inventoryItems`, `onCreateRequest`, `onRefreshInventory`, `loading`
- **Features**: Inventory selection, item management, request creation

### 4. **SearchFilters** (`components/SearchFilters.tsx`)
- **Purpose**: Search and filter controls for inventory items
- **Props**: Search query, filters, categories, handlers
- **Features**: Text search, category filter, stock filter, keyboard shortcuts

### 5. **InventoryItemSelector** (`components/InventoryItemSelector.tsx`)
- **Purpose**: Grid display of inventory items for selection
- **Props**: Items, filters, handlers
- **Features**: Item cards, search highlighting, add to request functionality

### 6. **RequestItemsList** (`components/RequestItemsList.tsx`)
- **Purpose**: Management of selected request items
- **Props**: Request items, inventory items, handlers
- **Features**: Quantity controls, bulk actions, item removal, validation

## Custom Hooks

### 1. **useStockRequests** (`hooks/useStockRequests.ts`)
- **Purpose**: Manages stock requests data fetching and state
- **Returns**: `requests`, `loading`, `refetch`
- **Features**: Automatic refetching on filter changes, error handling

### 2. **useInventoryItems** (`hooks/useInventoryItems.ts`)
- **Purpose**: Manages inventory items data fetching
- **Returns**: `inventoryItems`, `fetchInventoryItems`
- **Features**: On-demand fetching, error handling

## Types (`types.ts`)

All TypeScript interfaces have been extracted to a separate file:
- `StockRequest` - Stock request data structure
- `InventoryItem` - Inventory item data structure  
- `RequestItem` - Request item data structure
- `FilterType` - Filter options type
- `StockFilterType` - Stock filter options type

## Benefits of Modularization

1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be reused in other parts of the application
3. **Testability**: Smaller components are easier to unit test
4. **Readability**: Code is more organized and easier to understand
5. **Performance**: Better code splitting and lazy loading opportunities
6. **Collaboration**: Multiple developers can work on different components simultaneously

## Migration Notes

- All functionality from the original 978-line file has been preserved
- No breaking changes to the user interface or user experience
- All API calls and business logic remain unchanged
- CSS classes and styling are maintained using the same `page.module.css` file

## Usage Example

```tsx
import StockRequestsPage from './page';

// The page component can now be used as before, but with improved internal structure
export default function InventoryLayout() {
  return <StockRequestsPage />;
}
```

## Future Improvements

1. **Add unit tests** for each component
2. **Implement error boundaries** for better error handling
3. **Add loading skeletons** for better UX
4. **Optimize re-renders** with React.memo where appropriate
5. **Add accessibility features** (ARIA labels, keyboard navigation)
6. **Implement virtualization** for large inventory lists