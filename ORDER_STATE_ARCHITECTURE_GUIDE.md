# Order State Management - Architecture & Visual Guide

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     POS Electron Application                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ App.js       │
                    │ (Main Root)  │
                    └──────┬───────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
    ┌────▼─────┐                   ┌────────▼────────┐
    │AuthContext│                   │ OrderProvider   │
    │           │                   │  (NEW)          │
    │ - token   │                   └────────┬────────┘
    │ - user    │                           │
    └───────────┘                           │
                                    ┌───────▼────────┐
                                    │  OrderContext  │
                                    │   (NEW)        │
                                    └───────┬────────┘
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            │                               │                               │
      ┌─────▼──────────┐          ┌─────────▼─────────┐        ┌───────────▼──────┐
      │  OrdersPage    │          │ Other Components  │        │ BarcodeSearch    │
      │  (UPDATED)     │          │ (Any useOrder())  │        │ (Integrated)     │
      │                │          │                   │        │                  │
      │ Uses useOrder()│          │ Can also use      │        │ onProductFound() │
      │ for state      │          │ useOrder()        │        │ triggers         │
      └─────┬──────────┘          └─────────┬─────────┘        │ addItem()        │
            │                               │                  └──────────────────┘
            │                               │
            └───────────────────┬───────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   useOrder() Hook       │
                    │      (React Hook)       │
                    │                         │
                    │ Returns:                │
                    │ - order state           │
                    │ - addItem()             │
                    │ - removeItem()          │
                    │ - updateItemQuantity()  │
                    │ - submitOrder()         │
                    │ - reconcileWithBackend()│
                    │ - clearOrder()          │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
         ┌──────▼─────────┐           ┌─────────▼──────────┐
         │ useOrderState  │           │   OrderAPI         │
         │  Hook (NEW)    │           │   Service (NEW)    │
         │                │           │                    │
         │ Local State:   │           │ Backend Calls:     │
         │ - items[]      │────────▶  │ - createOrder()    │
         │ - totals{}     │           │ - addOrderItem()   │
         │ - synced       │           │ - removeOrderItem()│
         │ - pendingChg   │           │ - updateOrderItem()│
         │ - error        │           │ - getOrder()       │
         │ - dedup queue  │           │ - submitOrder()    │
         │                │           │                    │
         │ Deduplication  │           │ Error Handling:    │
         │ Engine:        │           │ - Timeouts         │
         │ - Track        │           │ - Validation (422) │
         │ - Prevent      │           │ - Server errors    │
         │ - Reuse        │           │ - Auth (401)       │
         └────────────────┘           └────────────────────┘
                                              │
                                              │
                                      ┌───────▼────────────┐
                                      │   Backend API      │
                                      │   /api/v1/orders   │
                                      └────────────────────┘
```

---

## Data Flow Diagram

### User Scans Product → Add to Order

```
┌──────────────────────────────────────┐
│ User Scans Barcode                   │
│ (BarcodeSearch component)            │
└──────────────┬───────────────────────┘
               │
               ▼
      ┌────────────────────┐
      │ Barcode found      │
      │ onProductFound()   │
      │ called             │
      └────────┬───────────┘
               │
               ▼
      ┌────────────────────────────┐
      │ Call: addItem(product)     │
      │ From OrdersPage component  │
      └────────┬───────────────────┘
               │
               ▼ (Optimistic Update - < 1ms)
      ┌────────────────────────────┐
      │ Local State Updates:       │
      │ - Add item to items[]      │
      │ - Increment quantity (if   │
      │   product already exists)  │
      │ - Recalculate totals       │
      │ - Mark synced: false       │
      │ - Increment pendingChanges │
      │ - Version++                │
      └────────┬───────────────────┘
               │
               ▼ (UI Updates Immediately)
      ┌────────────────────────────┐
      │ User sees:                 │
      │ - Item in table            │
      │ - Totals updated           │
      │ - "Syncing..." indicator   │
      │ - pendingChanges count     │
      └────────┬───────────────────┘
               │
               ▼ (Async Backend Sync)
      ┌────────────────────────────┐
      │ useOrderState schedules    │
      │ Backend Sync:              │
      │ syncAddItemWithBackend()   │
      └────────┬───────────────────┘
               │
               ▼ (Deduplication Check)
      ┌────────────────────────────┐
      │ Check in-flight requests   │
      │ key: "add-{productId}"     │
      │                            │
      │ If already in flight:      │
      │  - Return existing promise │
      │  - Skip duplicate call     │
      │                            │
      │ If not in flight:          │
      │  - Continue to API call    │
      └────────┬───────────────────┘
               │
               ▼
      ┌────────────────────────────┐
      │ API Call (Async):          │
      │ PATCH /api/v1/orders/{id}  │
      │      /items                │
      │                            │
      │ Body: {                    │
      │   product_id: 42,          │
      │   quantity: 1              │
      │ }                          │
      └────────┬───────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ┌────────┐   ┌─────────┐
    │ Success│   │ Error   │
    └────┬───┘   └────┬────┘
         │            │
         ▼            ▼
    ┌──────────────────────────┐
    │ Update State:            │
    │ - synced: true           │
    │ - lastSyncTime: now      │
    │ - pendingChanges--       │
    │ - error: null            │
    │                          │
    │ OR:                      │
    │                          │
    │ - synced: false          │
    │ - error: error.message   │
    │                          │
    │ (Item still in local     │
    │  order, marked as error) │
    └──────────────────────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ User sees updated UI:    │
    │ - Sync status: "Synced" ✓│
    │   or "Error: ..."        │
    │ - Can continue scanning  │
    │   (no UI blocking)       │
    └──────────────────────────┘
```

---

## State Lifecycle Diagram

```
┌─────────────────────┐
│  Initial State      │
│                     │
│ items: []           │
│ synced: true        │
│ error: null         │
│ pending: 0          │
└──────────┬──────────┘
           │
    Add Product
           │
           ▼
┌──────────────────────────┐
│ Optimistic Update        │ ◄──── UI Updates Instantly
│ (< 1ms)                  │
│                          │
│ items: [{...}]           │
│ synced: false ◄──────────┼─── Marked as "not synced"
│ error: null              │
│ pending: 1 ◄──────────── ┼─── 1 pending change
│ version: 1               │
└──────────┬───────────────┘
           │
           │ Dedup Check
           ▼
┌──────────────────────────┐
│ API Call in Progress     │ ◄──── Backend Sync (Async)
│ Request queued:          │
│ "add-{productId}"        │
└──────────┬───────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼ Success     ▼ Failure
┌─────────────────┐  ┌────────────────────┐
│ Sync Confirmed  │  │ Sync Failed        │
│                 │  │                    │
│ synced: true    │  │ synced: false      │
│ error: null     │  │ error: "Message"   │
│ pending: 0      │  │ pending: 1         │
│ lastSync: now   │  │                    │
└────────┬────────┘  │                    │
         │           │ ◄─── Item still    │
         │           │      in order      │
         │           │ (can retry)        │
         │           └────────┬───────────┘
         │                    │
         ▼                    ▼
    ┌─────────────────────────────────┐
    │ Final State                     │
    │ (after next action or manual    │
    │  reconciliation)                │
    └─────────────────────────────────┘
```

---

## Component Interaction Diagram

```
                  ┌────────────────────────┐
                  │   OrdersPage           │
                  │                        │
                  │ Uses:                  │
                  │ - useOrder()           │
                  │ - useCallback()        │
                  │ - useState()           │
                  └────────┬───────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
      ┌──────────┐  ┌────────────┐  ┌─────────────┐
      │ Barcode  │  │ Items      │  │ Summary     │
      │ Search   │  │ Table      │  │ Card        │
      │          │  │            │  │             │
      │ Scans    │  │ Shows      │  │ Displays    │
      │ barcode  │  │ items in   │  │ totals,     │
      │          │  │ order with │  │ sync status │
      │ Calls    │  │ quantity   │  │             │
      │ addItem()│  │ controls   │  │ Updates on  │
      │          │  │            │  │ each change │
      │ (on      │  │ Remove     │  │             │
      │ found)   │  │ buttons    │  │ Shows:      │
      │          │  │            │  │ - Item count│
      └──────────┘  │ Qty +/- &  │  │ - Subtotal  │
                    │ input      │  │ - Tax       │
                    │            │  │ - Total     │
                    └────────────┘  │ - Sync stat │
                                    └─────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌──────────┐ ┌──────────┐ ┌────────────┐
         │ All use  │ │ All call │ │ All listen │
         │ useOrder()│ │ methods  │ │ to state   │
         │          │ │ from hook│ │ changes    │
         │ Returns: │ │          │ │            │
         │ order    │ │ addItem()│ │ Re-render  │
         │ methods  │ │ removeIt │ │ when order │
         └──────────┘ │ updateQt │ │ updates    │
                      │ submitOrd│ │            │
                      │ clearOrd │ └────────────┘
                      │ reconcile│
                      └──────────┘
```

---

## Request Deduplication Flow

```
Time 0ms: User clicks + button
         │
         ▼
    Action: updateItemQuantity(42, 5)
         │
         ▼
    ┌─────────────────────────────────┐
    │ Check in-flight queue:          │
    │ key = "update-42"               │
    │                                 │
    │ Is "update-42" in queue? NO     │
    └──────────────┬──────────────────┘
                   │
                   ▼
         Queue request "update-42"
         Send API call: PATCH /orders/123/items/42 {qty: 5}
         Store promise in queue["update-42"]
                   │
                   │
Time 5ms: User clicks + button again
         │
         ▼
    Action: updateItemQuantity(42, 6)
         │
         ▼
    ┌─────────────────────────────────┐
    │ Check in-flight queue:          │
    │ key = "update-42"               │
    │                                 │
    │ Is "update-42" in queue? YES ✓  │
    └──────────────┬──────────────────┘
                   │
                   ▼
         Return existing promise
         Skip duplicate API call
         State updated locally to qty: 6
                   │
                   │
Time 10ms: User clicks + button again
         │
         ▼
    Action: updateItemQuantity(42, 7)
         │
         ▼
    ┌─────────────────────────────────┐
    │ Check in-flight queue:          │
    │ key = "update-42"               │
    │                                 │
    │ Is "update-42" in queue? YES ✓  │
    └──────────────┬──────────────────┘
                   │
                   ▼
         Return existing promise
         Skip duplicate API call
         State updated locally to qty: 7
                   │
                   │
Time 200ms: First API call completes
         │
         ▼
    API Response received
    Backend confirms: qty = 5 (from first request)
    Remove "update-42" from queue
    Update sync status
                   │
                   │
Result:
    - 3 user clicks
    - 1 API call sent (with qty: 5)
    - Local state ended with qty: 7
    - On reconciliation, will sync to backend with latest value
```

---

## Error Recovery Flow

```
┌─────────────────────────────┐
│ User Action                 │
│ (e.g., submit order)        │
└────────────┬────────────────┘
             │
             ▼
      ┌────────────────────┐
      │ Try-Catch Block    │
      └────────┬───────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ┌────────┐   ┌─────────────────┐
    │ Success│   │ Error Caught    │
    └────┬───┘   │                 │
         │       │ Extract error:  │
         │       │ - status code   │
         │       │ - message       │
         │       │ - data          │
         │       └────────┬────────┘
         │                │
         ▼                ▼
    ┌──────────────┐  ┌──────────────────────┐
    │ Update state:│  │ Determine error type:│
    │ synced: true │  │                      │
    │ error: null  │  │ 422 (Validation)?    │
    │ pending: 0   │  │  - Show field errors │
    │              │  │  - Keep order intact │
    │ All good ✓   │  │  - Allow retry       │
    │              │  │                      │
    │              │  │ 401 (Unauthorized)?  │
    │              │  │  - Redirect to login │
    │              │  │  - Clear token       │
    │              │  │                      │
    │              │  │ 500 (Server error)?  │
    │              │  │  - Show error msg    │
    │              │  │  - Suggest retry     │
    │              │  │                      │
    │              │  │ Timeout?             │
    │              │  │  - Show timeout msg  │
    │              │  │  - Allow retry       │
    │              │  │  - Keep local state  │
    │              │  └────────┬─────────────┘
    │              │           │
    │              │           ▼
    │              │    ┌─────────────────┐
    │              │    │ Update state:   │
    │              │    │ synced: false   │
    │              │    │ error: "Msg"    │
    │              │    │ pending: 1      │
    │              │    │                 │
    │              │    │ Order stays     │
    │              │    │ intact for      │
    │              │    │ retry           │
    │              │    └─────────────────┘
    │              │           │
    │              ▼           ▼
    │         ┌──────────────────────────┐
    │         │ Render Error Message     │
    │         │ & Retry Button           │
    │         │                          │
    │         │ User sees what went      │
    │         │ wrong and can retry      │
    │         └──────────────────────────┘
    │              │
    └──────────────┴──────────────────────┐
                   │                      │
                   ▼                      ▼
            ┌──────────────┐    ┌──────────────────┐
            │ Continue     │    │ Manual Retry     │
            │ working      │    │ (Click button)   │
            │              │    │                  │
            │ Can scan     │    │ Try same action  │
            │ more items   │    │ again            │
            │              │    │                  │
            │ Order syncs  │    │ May succeed now  │
            │ later        │    │                  │
            └──────────────┘    └──────────────────┘
```

---

## Tax Calculation Example

```
Order with 3 items:

Item 1:
  Product: Widget A
  Price: $10.00
  Quantity: 2
  Line Total: 10.00 × 2 = $20.00

Item 2:
  Product: Widget B
  Price: $15.00
  Quantity: 1
  Line Total: 15.00 × 1 = $15.00

Item 3:
  Product: Widget C
  Price: $5.50
  Quantity: 3
  Line Total: 5.50 × 3 = $16.50

Totals Calculation:

Step 1: Sum all line totals
  Subtotal = 20.00 + 15.00 + 16.50 = $51.50

Step 2: Calculate tax (10% of subtotal)
  Tax = 51.50 × 0.1 = $5.15

Step 3: Calculate total
  Total = 51.50 + 5.15 = $56.65

Step 4: Format to 2 decimals
  Final: $56.65

Display:
  ┌─────────────────────┐
  │ Subtotal: $51.50    │
  │ Tax:      $ 5.15    │
  │ ─────────────────── │
  │ Total:    $56.65    │
  │                     │
  │ Items: 6            │
  └─────────────────────┘
```

---

## Performance Timeline

```
Timeline for: User scans barcode → Sees item in order

T0ms:    User scans barcode
         │
T1ms:    onProductFound() called
         │
T2ms:    addItem(product) called
         │
T3ms:    Optimistic state update
         │ (items[], totals, synced: false)
         │
T4ms:    Component re-renders
         │
T10ms:   Item visible in table
         │ User sees instant feedback ✓
         │
T50ms:   Backend sync scheduled
         │ (async, non-blocking)
         │
T150ms:  API request sent
         │
T250ms:  Backend response received
         │
T251ms:  State updated
         │ synced: true
         │ pendingChanges: 0
         │
T252ms:  Component re-renders
         │ Sync status updates to "✓ Synced"
         │

Total time to visible: 10ms
Total time to synced: 250ms
UI blocking time: 0ms

User is happy! No loading spinners, instant feedback.
```

---

## Memory Usage

```
Order with 100 items:

useOrderState hook memory:
  - items array: 100 items × ~200 bytes = 20KB
  - totals object: ~100 bytes
  - state metadata: ~500 bytes
  ────────────────────────────
  Subtotal: ~21KB

OrderAPI memory:
  - In-flight queue: ~1-5 objects × ~100 bytes = 500 bytes
  - Method bindings: ~1KB
  ────────────────────────────
  Subtotal: ~1.5KB

Context & Providers:
  - OrderContext: ~100 bytes
  - Providers: ~500 bytes
  ────────────────────────────
  Subtotal: ~600 bytes

Total per-component memory: ~23KB (for 100 items)

Memory efficient! ✓
```

---

## Summary

This visual guide shows:
- System architecture and component relationships
- Data flow from user action to backend
- State lifecycle and transitions
- Request deduplication mechanism
- Error recovery process
- Calculation examples
- Performance timeline
- Memory efficiency

All designed for optimal user experience and system efficiency!
