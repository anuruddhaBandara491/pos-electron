# Order State Management - Testing Checklist

Complete testing guide for the order state management system.

## Pre-Testing Setup

- [ ] Install all dependencies
- [ ] Start dev server: `npm start`
- [ ] Open DevTools (F12) → Console and Network tabs
- [ ] Backend API endpoints available
- [ ] Auth token valid and user logged in
- [ ] Database has test products available

---

## Unit Tests

### Order State Hook

#### Test: Initialize Order State
```javascript
// Test: useOrderState should initialize with empty order
const { order } = useOrderState();
assert.equal(order.items.length, 0);
assert.equal(order.totals.itemCount, 0);
assert.equal(order.totals.subtotal, 0);
assert.equal(order.totals.tax, 0);
assert.equal(order.totals.total, 0);
assert.equal(order.synced, true);
assert.equal(order.error, null);
assert.equal(order.pendingChanges, 0);
```

#### Test: Calculate Totals
```javascript
// Test: Totals should calculate correctly (10% tax)
const product = { id: 1, name: 'Item', price: 10.00, sku: 'S1', barcode: '123' };
const { order, addItem } = useOrderState();

// Add item with price 10.00
await addItem(product);

assert.equal(order.totals.subtotal, 10.00);
assert.equal(order.totals.tax, 1.00);
assert.equal(order.totals.total, 11.00);
```

#### Test: Add Item
```javascript
// Test: Adding new product should add to items
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem } = useOrderState();

await addItem(product);

assert.equal(order.items.length, 1);
assert.equal(order.items[0].id, 42);
assert.equal(order.items[0].quantity, 1);
```

#### Test: Increment Quantity on Duplicate Add
```javascript
// Test: Adding same product twice should increment quantity
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem } = useOrderState();

await addItem(product);
await addItem(product);  // Add same product again

assert.equal(order.items.length, 1);
assert.equal(order.items[0].quantity, 2);
assert.equal(order.items[0].lineTotal, 39.98);
```

#### Test: Remove Item
```javascript
// Test: Removing item should remove from order
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem, removeItem } = useOrderState();

await addItem(product);
assert.equal(order.items.length, 1);

await removeItem(42);
assert.equal(order.items.length, 0);
assert.equal(order.totals.itemCount, 0);
```

#### Test: Update Quantity
```javascript
// Test: Updating quantity should update item
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem, updateItemQuantity } = useOrderState();

await addItem(product);
await updateItemQuantity(42, 5);

assert.equal(order.items[0].quantity, 5);
assert.equal(order.items[0].lineTotal, 99.95);
assert.equal(order.totals.itemCount, 5);
```

#### Test: Set Quantity to Zero Removes Item
```javascript
// Test: Setting quantity to 0 should remove item
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem, updateItemQuantity } = useOrderState();

await addItem(product);
await updateItemQuantity(42, 0);

assert.equal(order.items.length, 0);
```

#### Test: Clear Order
```javascript
// Test: Clear should remove all items
const product = { id: 42, name: 'Widget', price: 19.99, sku: 'W1', barcode: '123' };
const { order, addItem, clearOrder } = useOrderState();

await addItem(product);
assert.equal(order.items.length, 1);

clearOrder();
assert.equal(order.items.length, 0);
assert.equal(order.totals.total, 0);
```

---

## Integration Tests

### Order Context

#### Test: OrderProvider Wraps App
```javascript
// Test: useOrder should return null outside provider
const { order } = useOrder();
assert.equal(order, null);

// Test: useOrder should return state inside provider
function Component() {
  const { order } = useOrder();
  assert.notEqual(order, null);
}

render(
  <OrderProvider authContext={authContext}>
    <Component />
  </OrderProvider>
);
```

#### Test: State Shared Across Components
```javascript
// Test: Multiple components should share same order state
function ComponentA() {
  const { addItem } = useOrder();
  return <button onClick={() => addItem(product)}>Add</button>;
}

function ComponentB() {
  const { order } = useOrder();
  return <div>{order.totals.itemCount}</div>;
}

// Click button in ComponentA
// ComponentB should show updated itemCount
```

---

## UI/Integration Tests

### Barcode Search Integration

- [ ] **Scan barcode**
  - Barcode input focuses
  - Enter valid barcode
  - Product found
  - Product added to order
  - Order summary updates
  - Sync status shows "syncing"

- [ ] **Scan non-existent barcode**
  - Enter invalid barcode
  - Error message appears
  - Order unchanged

- [ ] **Scan multiple products**
  - Scan product A
  - Scan product B
  - Order has 2 items
  - Totals calculated correctly

- [ ] **Scan duplicate product**
  - Scan product A
  - Scan product A again
  - Order still has 1 item
  - Quantity is 2

---

### Order Items Table

- [ ] **Display items**
  - Items table shows all scanned products
  - Correct product name, SKU, price
  - Correct quantity and line total

- [ ] **Update quantity via input**
  - Click quantity field
  - Enter new quantity
  - Press Enter
  - Quantity updates
  - Line total updates
  - Order total updates

- [ ] **Update quantity via +/- buttons**
  - Click + button
  - Quantity increments
  - Click - button
  - Quantity decrements
  - Totals update

- [ ] **Remove item via button**
  - Click X button
  - Item removed from table
  - Order total updates
  - Item count decreases

---

### Order Summary

- [ ] **Display summary**
  - Items count correct
  - Subtotal calculated correctly (sum of line totals)
  - Tax calculated correctly (10% of subtotal)
  - Total calculated correctly (subtotal + tax)

- [ ] **Update on changes**
  - Add item → summary updates
  - Remove item → summary updates
  - Change quantity → summary updates

- [ ] **Sync status indicator**
  - Shows "Synced" when all changes synced
  - Shows "Syncing" when changes pending
  - Shows number of pending changes
  - Shows last sync time

---

### Order Actions

- [ ] **Submit button**
  - Disabled when order empty
  - Enabled when items in order
  - Shows loading state while submitting
  - Success: Shows confirmation
  - Failure: Shows error message
  - Success: Clears order

- [ ] **Clear button**
  - Removes all items
  - Resets totals to 0
  - No backend call made

---

## Backend Sync Tests

### Add Item Sync

- [ ] **Optimistic update**
  - Product added locally immediately
  - UI updates instantly
  - No loading spinner

- [ ] **Backend sync**
  - API call made (check Network tab)
  - Correct endpoint: `PATCH /api/v1/orders/{id}/items`
  - Correct payload: `{ product_id, quantity }`
  - Response processed correctly

- [ ] **Sync status**
  - Initially shows "syncing"
  - After success: shows "synced"
  - lastSyncTime updated

---

### Remove Item Sync

- [ ] **Optimistic update**
  - Item removed locally immediately
  - Totals recalculated instantly

- [ ] **Backend sync**
  - API call made
  - Correct endpoint: `DELETE /api/v1/orders/{id}/items/{itemId}`
  - Response processed correctly

---

### Update Quantity Sync

- [ ] **Optimistic update**
  - Quantity updated locally
  - Totals updated instantly
  - Line total correct (price * quantity)

- [ ] **Backend sync**
  - API call made
  - Correct endpoint: `PATCH /api/v1/orders/{id}/items/{itemId}`
  - Correct payload: `{ quantity }`

---

### Submit Order Sync

- [ ] **Submit order**
  - Button disabled during submit
  - API call made: `POST /api/v1/orders/{id}/submit`
  - Correct payload includes items and totals
  - Response contains confirmation_number
  - Order cleared after success
  - Summary reset to empty

- [ ] **Submit with validation error**
  - Backend returns 422 error
  - Error message displayed
  - Order remains in local state
  - User can retry

---

## Error Handling Tests

### Network Errors

- [ ] **Connection timeout**
  - Disable network (DevTools)
  - Try to add item
  - Error message appears
  - Order state unchanged
  - User can retry after connection restored

- [ ] **Server error (500)**
  - Mock server 500 response
  - Error message displayed
  - Matches error from response
  - Order state unchanged

- [ ] **Validation error (422)**
  - Mock invalid product
  - Backend returns validation error
  - Error message displayed
  - Shows validation details if available

- [ ] **Unauthorized (401)**
  - Invalid/expired token
  - API call fails
  - Error shown
  - Should redirect to login (future feature)

---

### Duplicate Prevention Tests

#### Rapid Add Clicks
- [ ] **Multiple adds of same product**
  - Add same product 3 times rapidly
  - Only 1 API call made (check Network tab)
  - Quantity incremented correctly
  - No duplicate items created

#### Rapid Quantity Updates
- [ ] **Multiple quantity changes**
  - Click +/- button 5 times rapidly
  - Only 1 API call made to backend
  - Final quantity correct
  - Total correct

#### Rapid Removes
- [ ] **Multiple remove attempts**
  - Click remove button 2 times rapidly
  - Item removed (first click)
  - Second click shows error (item already removed)
  - Order correct

---

## State Reconciliation Tests

- [ ] **Reconcile after offline**
  - Go offline
  - Add item to order
  - Come back online
  - Call reconcileWithBackend()
  - Local state matches backend

- [ ] **Recover from corruption**
  - Manually corrupt order.items in DevTools
  - Call reconcileWithBackend()
  - Order restored from backend
  - Totals recalculated correctly

---

## Performance Tests

### Responsiveness
- [ ] **Add item < 100ms**
  - Add product
  - Item appears instantly
  - No lag or stuttering

- [ ] **Update quantity < 100ms**
  - Change quantity
  - Update displays instantly

- [ ] **Large orders (100+ items)**
  - Add 100+ items to order
  - UI still responsive
  - Scrolling smooth
  - Totals correct

### Network Performance
- [ ] **Slow network (3G)**
  - Throttle network (DevTools)
  - Use app normally
  - UI remains responsive
  - Backend calls eventually complete

---

## Edge Cases

### Negative Numbers
- [ ] **Quantity input < 0**
  - Manual input of -5
  - Error shown (if validation in UI)
  - Or item removed (if set to 0)
  - Order remains valid

### Zero Quantity
- [ ] **Set quantity to 0**
  - Input 0
  - Item removed
  - Order valid

### Very Large Quantity
- [ ] **Input 999999**
  - Quantity set
  - Totals calculated correctly (no overflow)
  - Backend accepts if validation passes

### Very Large Price
- [ ] **Add $99999.99 product**
  - Totals calculated correctly
  - No rounding errors
  - Display formatted correctly

### Empty Order Submit
- [ ] **Try to submit empty order**
  - Click submit with no items
  - Error shown: "Cannot submit empty order"
  - No API call made

### Invalid Product
- [ ] **Add product with missing fields**
  - Missing id: Error shown
  - Missing name: Item added with empty name (if backend allows)
  - Missing price: Totals incorrect or error

---

## Browser Compatibility

- [ ] **Chrome latest**
- [ ] **Firefox latest**
- [ ] **Safari latest**
- [ ] **Edge latest**
- [ ] **Mobile browsers**

---

## Accessibility Tests

- [ ] **Keyboard navigation**
  - Tab through inputs
  - Tab through buttons
  - Enter submits forms

- [ ] **Screen reader**
  - Order summary announced
  - Items table navigable
  - Buttons labeled

- [ ] **Color contrast**
  - Sync status colors readable
  - Error colors accessible
  - Table text readable

---

## Dark Mode Tests

- [ ] **Enable dark mode**
  - OS dark mode setting
  - Or app-level toggle
  - Colors update correctly
  - Text readable
  - Status indicators visible

---

## Data Validation

### Totals Accuracy
- [ ] **Multiple items**
  - Item A: 2 × $10.00 = $20.00
  - Item B: 3 × $5.00 = $15.00
  - Subtotal: $35.00 ✓
  - Tax (10%): $3.50 ✓
  - Total: $38.50 ✓

### Decimal Precision
- [ ] **Rounding**
  - $0.01 × 3 = $0.03 (not $0.02999...)
  - Tax of $0.333... rounds to $0.33
  - Total matches subtotal + tax exactly

### Line Total Calculation
- [ ] **Price × Quantity**
  - 1 × $19.99 = $19.99
  - 2 × $14.99 = $29.98
  - 3 × $7.77 = $23.31
  - No floating point errors

---

## Logging & Debugging

- [ ] **Check browser console**
  - No JavaScript errors
  - useOrderState logs show
  - OrderAPI logs show

- [ ] **Check Network tab**
  - All API calls logged
  - Request/response bodies visible
  - No duplicate calls
  - Correct headers (Authorization)

- [ ] **Check React DevTools**
  - Component tree shows OrderProvider
  - useOrder hook shows state
  - State updates reflected

---

## Production Readiness

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All UI tests pass
- [ ] All error cases handled
- [ ] Error messages user-friendly
- [ ] Logging configured
- [ ] Performance acceptable
- [ ] Accessibility tested
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Backend API confirmed
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] Tested in staging
- [ ] Ready for production

---

## Test Results Summary

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Unit Tests | 10 | [ ] | [ ] | |
| Integration Tests | 5 | [ ] | [ ] | |
| UI Tests | 25 | [ ] | [ ] | |
| Backend Sync | 15 | [ ] | [ ] | |
| Error Handling | 10 | [ ] | [ ] | |
| Duplicate Prevention | 5 | [ ] | [ ] | |
| Edge Cases | 10 | [ ] | [ ] | |
| Performance | 5 | [ ] | [ ] | |
| **TOTAL** | **85** | [ ] | [ ] | |

---

## Sign-Off

- **Tested By:** ________________
- **Date:** ________________
- **Environment:** ________________
- **Status:** ☐ APPROVED ☐ NEEDS FIXES

---

## Notes

[Space for test notes and issues found]
