# Order State Management - Quick Start

Get the order state management system running in 3 simple steps.

## Step 1: Wrap App with OrderProvider

In your main App.js file, import and wrap your app with `OrderProvider`:

```javascript
import { OrderProvider } from './context/OrderContext';
import { AuthContext } from './context/AuthContext';

function App() {
  const authContext = useContext(AuthContext);

  return (
    <OrderProvider authContext={authContext}>
      <Navigation />
      <Routes>
        {/* Your routes */}
      </Routes>
    </OrderProvider>
  );
}
```

## Step 2: Use Order State in Components

In any component (like OrdersPage), import and use the order state:

```javascript
import { useOrder } from '../context/OrderContext';

function OrdersPage() {
  const { order, addItem, removeItem, updateItemQuantity, submitOrder } = useOrder();

  if (!order) return <div>Loading...</div>;

  return (
    <div>
      <h1>Items: {order.totals.itemCount}</h1>
      <h2>Total: ${order.totals.total.toFixed(2)}</h2>
      
      {order.items.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <input 
            value={item.quantity}
            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value))}
          />
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      
      <button onClick={() => submitOrder()}>Submit</button>
    </div>
  );
}
```

## Step 3: Add Items from Barcode Search

When a product is found from barcode scan, add it to the order:

```javascript
const { addItem } = useOrder();

const handleProductFound = (product) => {
  addItem(product);
  // ✅ Product added to order
  // ✅ Quantity incremented if already in order
  // ✅ Backend synced automatically
  // ✅ UI updated instantly
};
```

---

## Available Methods

### Add Item
```javascript
await addItem({ id, name, price, sku, barcode });
```

### Update Quantity
```javascript
await updateItemQuantity(productId, newQuantity);
```

### Remove Item
```javascript
await removeItem(productId);
```

### Submit Order
```javascript
await submitOrder();
```

### Reconcile with Backend
```javascript
await reconcileWithBackend();
```

### Clear Order
```javascript
clearOrder();
```

---

## Order State Object

```javascript
order = {
  items: [
    { id, name, sku, barcode, price, quantity, lineTotal },
    // ... more items
  ],
  totals: {
    subtotal: 10.00,
    tax: 1.00,
    total: 11.00,
    itemCount: 2
  },
  synced: true,        // All changes synced to backend
  lastSyncTime: Date,  // When last sync occurred
  error: null,         // Error message if any
  pendingChanges: 0    // Number of unsaved changes
}
```

---

## Display Sync Status

```javascript
const { order } = useOrder();

<div className={`sync-status ${order.synced ? 'synced' : 'syncing'}`}>
  {order.synced ? '✓ Synced' : `⏳ Syncing... (${order.pendingChanges} changes)`}
</div>
```

---

## Handle Errors

```javascript
const { order } = useOrder();

{order.error && (
  <div className="error">
    {order.error}
  </div>
)}
```

---

## Example: Complete Order Flow

```javascript
import { useOrder } from '../context/OrderContext';

export default function OrdersPage() {
  const { 
    order, 
    addItem, 
    removeItem, 
    updateItemQuantity, 
    submitOrder,
    clearOrder 
  } = useOrder();

  const handleAddProduct = (product) => {
    addItem(product);  // Auto-syncs to backend
  };

  const handleSubmit = async () => {
    try {
      const result = await submitOrder();
      alert(`Order #${result.confirmation_number} submitted!`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      {/* Order Summary */}
      <div className="order-summary">
        <div>Items: {order.totals.itemCount}</div>
        <div>Total: ${order.totals.total.toFixed(2)}</div>
        <div>Status: {order.synced ? 'Synced' : 'Syncing...'}</div>
      </div>

      {/* Order Items */}
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {order.items.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>
                <input 
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value))}
                />
              </td>
              <td>${item.lineTotal.toFixed(2)}</td>
              <td>
                <button onClick={() => removeItem(item.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Error */}
      {order.error && (
        <div className="error">{order.error}</div>
      )}

      {/* Actions */}
      <div>
        <button onClick={handleSubmit} disabled={order.items.length === 0}>
          Submit Order
        </button>
        <button onClick={clearOrder}>
          Clear
        </button>
      </div>
    </div>
  );
}
```

---

## Barcode Integration Example

```javascript
import BarcodeSearch from '../components/BarcodeSearch';
import { useOrder } from '../context/OrderContext';

export default function OrdersPage() {
  const { addItem } = useOrder();

  const handleProductFound = (product) => {
    // Product found from barcode → add to order
    addItem(product);
    // That's it! Sync, totals, UI all handled automatically
  };

  const handleProductNotFound = (barcode) => {
    alert(`No product found for barcode: ${barcode}`);
  };

  return (
    <div>
      <BarcodeSearch
        onProductFound={handleProductFound}
        onProductNotFound={handleProductNotFound}
        autoFocus={true}
      />
      
      {/* Rest of order UI... */}
    </div>
  );
}
```

---

## Key Features

✅ **Instant UI Updates**
- Order state updates immediately when items are added/removed/updated
- No loading spinners needed

✅ **Automatic Backend Sync**
- All changes synced to backend in the background
- Doesn't block user interaction

✅ **Smart Duplicate Prevention**
- Multiple rapid clicks = single backend call
- Request deduplication prevents wasted API calls

✅ **Error Handling**
- Validation failures handled gracefully
- User-friendly error messages
- Can retry without re-entering data

✅ **State Reconciliation**
- Get latest order from backend
- Sync local and backend state
- Handle connection recovery

---

## Styling

The system includes complete styling. Import the CSS:

```javascript
import '../styles/OrderState.css';
```

Classes available:
- `order-summary` - Summary card
- `order-items-table` - Items table
- `sync-status` - Sync indicator
- `order-error` - Error message
- `order-actions` - Action buttons

---

## Common Patterns

### Disable inputs while syncing
```javascript
<button disabled={!order.synced}>Submit</button>
```

### Show pending changes count
```javascript
<span>{order.pendingChanges > 0 ? '⏳' : '✓'}</span>
```

### Auto-submit small orders
```javascript
useEffect(() => {
  if (order.items.length > 10 && order.synced) {
    submitOrder();
  }
}, [order.items.length, order.synced]);
```

### Print receipt after submit
```javascript
const result = await submitOrder();
print(result.receipt);
```

---

## Troubleshooting

**Q: Getting "Order state not available" error?**
A: Make sure OrderProvider wraps your entire app in App.js

**Q: Changes not syncing to backend?**
A: Check `order.synced` and `order.error` properties

**Q: Too many API calls?**
A: System prevents duplicates automatically - check DevTools Network tab

**Q: Order state returns null?**
A: Call useOrder() inside component wrapped by OrderProvider

---

## Next Steps

1. ✅ Wrap app with OrderProvider
2. ✅ Add order state to OrdersPage
3. ✅ Integrate with barcode search
4. ✅ Test all flows
5. ✅ Deploy to production

---

For detailed documentation, see [ORDER_STATE_MANAGEMENT.md](ORDER_STATE_MANAGEMENT.md)
