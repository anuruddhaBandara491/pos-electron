# Order State Management - API Reference

Complete API documentation for the order state management system.

## useOrderState Hook

### Import
```javascript
import useOrderState from '../hooks/useOrderState';
```

### Usage
```javascript
const orderState = useOrderState(orderAPI);
```

### Return Value

```javascript
{
  // State
  order: {
    items: Array<OrderItem>,
    totals: OrderTotals,
    synced: boolean,
    lastSyncTime: Date | null,
    error: string | null,
    pendingChanges: number,
    version: number
  },

  // Methods
  addItem: (product) => Promise<void>,
  removeItem: (productId) => Promise<void>,
  updateItemQuantity: (productId, quantity) => Promise<void>,
  reconcileWithBackend: () => Promise<boolean>,
  submitOrder: () => Promise<OrderResponse>,
  clearOrder: () => void,

  // Utilities
  getOrderSummary: () => OrderSummary
}
```

---

## Order State Object

### OrderItem
```javascript
{
  id: string | number,          // Product ID (required)
  name: string,                 // Product name
  sku: string,                  // Product SKU
  barcode: string,              // Product barcode
  price: number,                // Unit price
  quantity: number,             // Quantity in order
  lineTotal: number             // price * quantity
}
```

### OrderTotals
```javascript
{
  subtotal: number,             // Sum of all line totals
  tax: number,                  // Tax amount (10% of subtotal)
  total: number,                // subtotal + tax
  itemCount: number             // Total quantity of items
}
```

### OrderSummary
```javascript
{
  itemCount: number,            // Total items in order
  subtotal: number,             // Subtotal
  tax: number,                  // Tax amount
  total: number,                // Total
  hasPendingChanges: boolean,   // Any unsaved changes
  isSynced: boolean,            // All changes synced
  lastSyncTime: Date | null,    // Last sync timestamp
  error: string | null          // Current error
}
```

---

## Methods

### addItem(product)

Add a product to the order. If product already exists, increments quantity.

**Parameters:**
```javascript
product: {
  id: string | number,          // Required
  name: string,                 // Required
  sku: string,
  barcode: string,
  price: number,                // Required
  quantity?: number             // Default: 1 (ignored, always starts at 1)
}
```

**Returns:** `Promise<void>`

**Throws:** Error if product is invalid

**Example:**
```javascript
const product = {
  id: 42,
  name: 'Widget Pro',
  sku: 'WIDGET-001',
  barcode: '123456789012',
  price: 29.99
};

try {
  await addItem(product);
  // Product added to order
  // Quantity incremented if already exists
  // Backend sync started automatically
} catch (err) {
  console.error('Failed to add item:', err.message);
}
```

---

### removeItem(productId)

Remove a product from the order.

**Parameters:**
```javascript
productId: string | number      // Product ID to remove (required)
```

**Returns:** `Promise<void>`

**Throws:** Error if item not found

**Example:**
```javascript
try {
  await removeItem(42);
  // Item removed from order
  // Backend sync started
} catch (err) {
  console.error('Failed to remove item:', err.message);
}
```

---

### updateItemQuantity(productId, newQuantity)

Change the quantity of an item in the order. Set to 0 to remove.

**Parameters:**
```javascript
productId: string | number,     // Product ID (required)
newQuantity: number             // New quantity (required, must be >= 0)
```

**Returns:** `Promise<void>`

**Throws:** Error if quantity invalid or item not found

**Example:**
```javascript
// Update to 5 units
await updateItemQuantity(42, 5);

// Remove item (quantity 0)
await updateItemQuantity(42, 0);

// Decrement
const item = order.items.find(i => i.id === 42);
await updateItemQuantity(42, item.quantity - 1);
```

---

### submitOrder()

Submit the order to the backend.

**Parameters:** None

**Returns:** `Promise<OrderResponse>`

```javascript
OrderResponse: {
  id: string,                   // Order ID
  confirmation_number: string,  // Confirmation #
  items: Array<OrderItem>,      // Submitted items
  totals: OrderTotals,          // Final totals
  timestamp: string,            // Submission time
  status: string                // "completed" | "pending"
}
```

**Throws:** Error if order empty or submission fails

**Side Effects:**
- Clears local order (sets items to [])
- Resets pendingChanges to 0

**Example:**
```javascript
try {
  const result = await submitOrder();
  console.log(`Order #${result.confirmation_number} submitted!`);
  console.log(`Total: $${result.totals.total.toFixed(2)}`);
} catch (err) {
  console.error('Submission failed:', err.message);
  // Order still in local state - user can retry
}
```

---

### reconcileWithBackend()

Fetch latest order from backend and sync local state.

**Parameters:** None

**Returns:** `Promise<boolean>` - true if successful

**Side Effects:**
- Replaces local items with backend items
- Recalculates totals
- Resets pendingChanges to 0
- Clears error

**Example:**
```javascript
// After network restored
const success = await reconcileWithBackend();
if (success) {
  console.log('Order synced with backend');
} else {
  console.error('Reconciliation failed');
}
```

---

### clearOrder()

Clear all items from the order (local only, no backend sync).

**Parameters:** None

**Returns:** `void`

**Side Effects:**
- Removes all items
- Resets totals to 0
- Resets error

**Example:**
```javascript
// Clear current order without submitting
clearOrder();
```

---

### getOrderSummary()

Get a summary object of the current order (convenience method).

**Parameters:** None

**Returns:** `OrderSummary`

```javascript
{
  itemCount: number,
  subtotal: number,
  tax: number,
  total: number,
  hasPendingChanges: boolean,
  isSynced: boolean,
  lastSyncTime: Date | null,
  error: string | null
}
```

**Example:**
```javascript
const summary = getOrderSummary();
console.log(`${summary.itemCount} items, Total: $${summary.total.toFixed(2)}`);
console.log(`Synced: ${summary.isSynced}`);
```

---

## useOrder Hook

### Import
```javascript
import { useOrder } from '../context/OrderContext';
```

### Usage
```javascript
function MyComponent() {
  const order = useOrder();
  
  if (!order) {
    return <div>Order state not available</div>;
  }

  return (
    <div>
      Items: {order.order.totals.itemCount}
    </div>
  );
}
```

### Return Value

Same as `useOrderState()` return value:

```javascript
{
  order: { items, totals, synced, lastSyncTime, error, pendingChanges, version },
  addItem,
  removeItem,
  updateItemQuantity,
  reconcileWithBackend,
  submitOrder,
  clearOrder,
  getOrderSummary,
  setOrderId                    // Set current order ID
}
```

### Return Type
- `null` if called outside `<OrderProvider>`
- Order state object if inside provider

---

## OrderAPI Service

### Import
```javascript
import OrderAPI from '../api/OrderAPI';
```

### Constructor
```javascript
const api = new OrderAPI(apiManager, getToken, orderId);
```

**Parameters:**
```javascript
apiManager: ApiManager,         // API manager instance (can be null)
getToken: () => string,         // Function returning auth token
orderId?: string | null         // Current order ID
```

### Methods

#### createOrder(items)
Create a new order.

```javascript
const response = await api.createOrder([
  { product_id: 1, quantity: 2, price: 10.00 }
]);
// Returns: { id, items, totals }
```

#### addOrderItem(productId, quantity)
Add item to order.

```javascript
const response = await api.addOrderItem(42, 1);
// Returns: { id, items, totals }
```

#### removeOrderItem(productId)
Remove item from order.

```javascript
const response = await api.removeOrderItem(42);
// Returns: { id, items, totals }
```

#### updateOrderItem(productId, quantity)
Update item quantity.

```javascript
const response = await api.updateOrderItem(42, 5);
// Returns: { id, items, totals }
```

#### getOrder()
Get order details (reconciliation).

```javascript
const order = await api.getOrder();
// Returns: { id, items, totals }
```

#### submitOrder(orderData)
Submit order.

```javascript
const result = await api.submitOrder({
  items: order.items,
  totals: order.totals
});
// Returns: { confirmation_number, id, total, timestamp }
```

#### getOrderHistory(limit)
Get user's order history.

```javascript
const history = await api.getOrderHistory(10);
// Returns: { orders: [...] }
```

#### cancelOrder()
Cancel order.

```javascript
const result = await api.cancelOrder();
// Returns: { message, id }
```

#### setOrderId(orderId)
Set current order ID.

```javascript
api.setOrderId('order-123');
```

---

## OrderProvider Component

### Import
```javascript
import { OrderProvider } from '../context/OrderContext';
```

### Usage
```javascript
<OrderProvider authContext={authContext}>
  <App />
</OrderProvider>
```

**Props:**
```javascript
{
  children: ReactNode,          // Child components
  authContext: {
    token: string              // Auth token
  }
}
```

---

## Error Handling

### Error Types

**Validation Error** (422 status)
```javascript
{
  status: 422,
  message: "Invalid product quantity",
  data: { field: "quantity", reason: "..." }
}
```

**Not Found Error** (404 status)
```javascript
{
  status: 404,
  message: "Order not found",
  data: { }
}
```

**Network Error** (timeout)
```javascript
{
  name: "AbortError",
  message: "Request timeout: /orders/123/items"
}
```

**Unauthorized** (401 status)
```javascript
{
  status: 401,
  message: "Unauthorized",
  data: { }
}
```

### Error Handling Pattern

```javascript
try {
  await addItem(product);
} catch (err) {
  if (err.status === 422) {
    // Validation error
    console.error('Invalid data:', err.data);
  } else if (err.status === 401) {
    // Need to re-authenticate
    redirectToLogin();
  } else if (err.name === 'AbortError') {
    // Network timeout
    showRetryButton();
  } else {
    // Other error
    console.error('Error:', err.message);
  }
}
```

---

## State Change Examples

### Before Adding Item
```javascript
{
  items: [],
  totals: { subtotal: 0, tax: 0, total: 0, itemCount: 0 },
  synced: true,
  pendingChanges: 0
}
```

### After Adding Item (Optimistic)
```javascript
{
  items: [{ id: 1, name: 'Widget', price: 10, quantity: 1, lineTotal: 10 }],
  totals: { subtotal: 10, tax: 1, total: 11, itemCount: 1 },
  synced: false,      // ← Not synced yet
  pendingChanges: 1   // ← 1 pending change
}
```

### After Backend Sync Complete
```javascript
{
  items: [{ id: 1, name: 'Widget', price: 10, quantity: 1, lineTotal: 10 }],
  totals: { subtotal: 10, tax: 1, total: 11, itemCount: 1 },
  synced: true,       // ← Now synced
  pendingChanges: 0   // ← No pending changes
}
```

---

## Duplicate Prevention Example

### Code
```javascript
// User clicks + button 3 times rapidly
updateItemQuantity(42, 5);
updateItemQuantity(42, 6);
updateItemQuantity(42, 7);
```

### Request Log
```
[1] Request: PATCH /orders/123/items/42 { quantity: 5 }
[1] Queued as "update-42"

[2] Request: PATCH /orders/123/items/42 { quantity: 6 }
[2] Skipping duplicate "update-42" (already in flight)

[3] Request: PATCH /orders/123/items/42 { quantity: 7 }
[3] Skipping duplicate "update-42" (already in flight)

[1] Response: { items: [...], totals: {...} }
[1] Clearing "update-42" from queue
```

### Backend Behavior
- Only 1 API call sent to backend
- But quantity updates are deferred - final state uses last value (7)
- Backend receives latest data

---

## Logging

All operations are logged with electron-log:

```javascript
// Info level
[OrderAPI] Order created: 123
[Order] Adding item: Product Name (ID: 1)

// Debug level
[OrderAPI] POST /api/v1/orders { status: 200 }
[Order] Removing item: 42

// Warning level
[Order] Backend sync failed for add item: Invalid product

// Error level
[OrderAPI] HTTP error 422: Invalid product
[Order] Submit order failed: ...
```

View logs in DevTools Console or Electron logs directory.

---

## Performance Notes

- **Optimistic Updates:** UI updates immediately (< 1ms)
- **Backend Sync:** Async, doesn't block UI (typical 100-500ms)
- **Deduplication:** Prevents wasted API calls
- **Memoization:** useCallback prevents unnecessary re-renders
- **Debouncing:** Multiple rapid updates → single backend call

---

## Constants

```javascript
// Request timeout
requestTimeout: 30000  // 30 seconds

// Tax rate
TAX_RATE: 0.1  // 10% (configured in calculateTotals)

// API Base URL
baseUrl: '/api/v1'

// Request deduplication keys
Key format: `${action}-${productId}`
```

---

## Complete Example

```javascript
import React from 'react';
import { useOrder } from '../context/OrderContext';

export default function OrderWidget() {
  const {
    order,
    addItem,
    removeItem,
    updateItemQuantity,
    submitOrder,
    clearOrder,
    getOrderSummary
  } = useOrder();

  if (!order) return null;

  const handleAddProduct = () => {
    addItem({ id: 1, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' });
  };

  const handleSubmit = async () => {
    try {
      const result = await submitOrder();
      alert(`Order #${result.confirmation_number} complete!`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const summary = getOrderSummary();

  return (
    <div>
      <h1>Order</h1>
      
      {/* Summary */}
      <div>
        <p>Items: {summary.itemCount}</p>
        <p>Total: ${summary.total.toFixed(2)}</p>
        <p>Status: {summary.isSynced ? '✓ Synced' : '⏳ Syncing...'}</p>
      </div>

      {/* Items */}
      {order.items.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value))}
          />
          <button onClick={() => removeItem(item.id)}>Delete</button>
        </div>
      ))}

      {/* Actions */}
      <button onClick={handleAddProduct}>Add Widget</button>
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={clearOrder}>Clear</button>

      {/* Error */}
      {order.error && <div style={{ color: 'red' }}>{order.error}</div>}
    </div>
  );
}
```

---

See [ORDER_STATE_MANAGEMENT.md](ORDER_STATE_MANAGEMENT.md) for detailed information.
