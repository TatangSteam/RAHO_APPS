# Inventory Services - Modular Architecture

## Overview

The inventory module has been refactored into a modular architecture for better maintainability and separation of concerns.

## Structure

```
inventory/
├── inventory.service.ts           # Inventory items orchestrator
├── stock-request.service.ts       # Stock request orchestrator
├── shipment.service.ts            # Shipment orchestrator
├── inventory.controller.ts        # Inventory items controller
├── stock-request.controller.ts    # Stock request controller
├── shipment.controller.ts         # Shipment controller
├── inventory.routes.ts            # Route definitions
└── services/                      # Modular services
    ├── inventory-items.service.ts              # Inventory items management
    ├── stock-request-creation.service.ts       # Stock request creation
    ├── stock-request-approval.service.ts       # Stock request approval/rejection
    ├── stock-request-retrieval.service.ts      # Stock request retrieval
    ├── shipment-processing.service.ts          # Shipment processing
    ├── shipment-retrieval.service.ts           # Shipment retrieval
    └── README.md                               # This file
```

## Services

### 1. InventoryItemsService
**File:** `inventory-items.service.ts`

**Responsibilities:**
- Get inventory items for a branch
- Get inventory item by ID
- Get low stock items
- Format inventory item data

**Key Methods:**
- `getInventoryItems()` - Get all items for a branch
- `getInventoryItemById()` - Get item by ID
- `getLowStockItems()` - Get items below threshold
- `formatInventoryItem()` - Format item data

### 2. StockRequestCreationService
**File:** `stock-request-creation.service.ts`

**Responsibilities:**
- Create stock requests
- Validate user permissions
- Validate products
- Generate request codes
- Audit logging

**Key Methods:**
- `createRequest()` - Create new stock request
- `generateRequestCode()` - Generate unique request code
- `formatStockRequest()` - Format request data

**Request Code Format:** `REQ-{branchCode}-{YYMM}-{sequence}`

### 3. StockRequestApprovalService
**File:** `stock-request-approval.service.ts`

**Responsibilities:**
- Approve stock requests
- Reject stock requests
- Create shipments on approval
- Generate shipment codes
- Audit logging

**Key Methods:**
- `approveRequest()` - Approve request and create shipment
- `rejectRequest()` - Reject request with reason
- `generateShipmentCode()` - Generate unique shipment code
- `formatStockRequest()` - Format request data
- `formatShipment()` - Format shipment data

**Shipment Code Format:** `SHP-{fromBranch}-{toBranch}-{YYMM}-{sequence}`

### 4. StockRequestRetrievalService
**File:** `stock-request-retrieval.service.ts`

**Responsibilities:**
- Get stock requests with filtering
- Get stock request by ID
- Include related shipment data
- Format request data

**Key Methods:**
- `getRequests()` - Get requests with filters
- `getRequestById()` - Get request by ID with shipment
- `formatStockRequest()` - Format request data

### 5. ShipmentProcessingService
**File:** `shipment-processing.service.ts`

**Responsibilities:**
- Ship shipments (deduct stock from source)
- Receive shipments
- Approve shipments (add stock to destination)
- Create stock mutations
- Validate permissions
- Audit logging

**Key Methods:**
- `shipShipment()` - Mark as shipped, deduct stock
- `receiveShipment()` - Mark as received
- `approveShipment()` - Mark as approved, add stock
- `formatShipment()` - Format shipment data

**Shipment Flow:**
1. PENDING → SHIPPED (deduct from source)
2. SHIPPED → RECEIVED (received at destination)
3. RECEIVED → APPROVED (add to destination stock)

### 6. ShipmentRetrievalService
**File:** `shipment-retrieval.service.ts`

**Responsibilities:**
- Get shipments with filtering
- Get shipment by ID
- Include related stock request data
- Format shipment data

**Key Methods:**
- `getShipments()` - Get shipments with filters
- `getShipmentById()` - Get shipment by ID with request
- `formatShipment()` - Format shipment data

## Main Services (Orchestrators)

### InventoryService
```typescript
export class InventoryService {
  private itemsService: InventoryItemsService;

  async getInventoryItems(branchId: string) {
    return await this.itemsService.getInventoryItems(branchId);
  }
  
  async getLowStockItems(branchId?: string) {
    return await this.itemsService.getLowStockItems(branchId);
  }
}
```

### StockRequestService
```typescript
export class StockRequestService {
  private creationService: StockRequestCreationService;
  private approvalService: StockRequestApprovalService;
  private retrievalService: StockRequestRetrievalService;

  async createRequest(...) {
    return await this.creationService.createRequest(...);
  }
  
  async approveRequest(...) {
    return await this.approvalService.approveRequest(...);
  }
}
```

### ShipmentService
```typescript
export class ShipmentService {
  private processingService: ShipmentProcessingService;
  private retrievalService: ShipmentRetrievalService;

  async shipShipment(...) {
    return await this.processingService.shipShipment(...);
  }
  
  async receiveShipment(...) {
    return await this.processingService.receiveShipment(...);
  }
}
```

## Workflow

### Stock Request Flow
```
1. Branch Admin creates stock request
   ↓
2. Super Admin reviews request
   ↓
3a. APPROVED → Create shipment
3b. REJECTED → End
   ↓
4. Super Admin ships items (deduct from HQ)
   ↓
5. Branch Admin receives items
   ↓
6. Branch Admin approves (add to branch stock)
```

### Stock Mutation
```
SHIP:    HQ Stock -10 → Create OUT mutation
APPROVE: Branch Stock +10 → Create IN mutation
```

## Benefits

### ✅ Separation of Concerns
- Each service has ONE responsibility
- Clear boundaries between operations
- Easier to understand

### ✅ Better Maintainability
- Smaller files (100-350 lines vs 435-497 lines)
- Easier to navigate
- Faster to find bugs

### ✅ Easier Testing
- Test services independently
- Mock dependencies easily
- Focused unit tests

### ✅ Reusability
- Services can be reused
- Share logic between modules
- DRY principle

## Usage Example

```typescript
import { InventoryService } from './inventory.service';
import { StockRequestService } from './stock-request.service';
import { ShipmentService } from './shipment.service';

const inventoryService = new InventoryService();
const stockRequestService = new StockRequestService();
const shipmentService = new ShipmentService();

// Get inventory items
const items = await inventoryService.getInventoryItems(branchId);

// Get low stock items
const lowStock = await inventoryService.getLowStockItems();

// Create stock request
const request = await stockRequestService.createRequest({
  items: [
    { masterProductId: 'prod-1', requestedQuantity: 10 },
    { masterProductId: 'prod-2', requestedQuantity: 5 },
  ],
  notes: 'Urgent request',
}, branchId, userId);

// Approve request (creates shipment)
const { request: approved, shipment } = await stockRequestService.approveRequest(
  requestId,
  userId,
  'Approved'
);

// Ship items
await shipmentService.shipShipment(shipment.id, userId, 'Shipped via courier');

// Receive items
await shipmentService.receiveShipment(shipment.id, userId, branchId, 'Received in good condition');

// Approve receipt (adds to stock)
await shipmentService.approveShipment(shipment.id, userId, branchId, 'Stock added');
```

## API Endpoints

### Inventory Items
```
GET /api/inventory/items?branchId={id}     - Get inventory items
GET /api/inventory/items/:id               - Get item by ID
GET /api/inventory/low-stock?branchId={id} - Get low stock items
```

### Stock Requests
```
POST   /api/inventory/stock-requests       - Create request
GET    /api/inventory/stock-requests       - Get requests
GET    /api/inventory/stock-requests/:id   - Get request by ID
POST   /api/inventory/stock-requests/:id/approve - Approve request
POST   /api/inventory/stock-requests/:id/reject  - Reject request
```

### Shipments
```
GET  /api/inventory/shipments              - Get shipments
GET  /api/inventory/shipments/:id          - Get shipment by ID
POST /api/inventory/shipments/:id/ship     - Ship shipment
POST /api/inventory/shipments/:id/receive  - Receive shipment
POST /api/inventory/shipments/:id/approve  - Approve shipment
```

## Future Improvements

1. **Add Unit Tests** - Test each service independently
2. **Add Integration Tests** - Test full workflow
3. **Add Notifications** - Notify on status changes
4. **Add Barcode Scanning** - For receiving items
5. **Add Batch Operations** - Process multiple items
6. **Add Stock Forecasting** - Predict stock needs

## Related Modules

This modular pattern is also used in:
- `packages/` - Package management (already modular)
- `members/` - Member management (already modular)
- `admin/` - Admin operations (already modular)
- `sessions/` - Session management (already modular)
