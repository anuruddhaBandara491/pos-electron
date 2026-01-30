# Keyboard-Driven POS Testing Guide

## Quick Testing Checklist

### Pre-Test Setup
- [ ] Start application in development mode
- [ ] Navigate to Orders page
- [ ] Ensure barcode scanner is connected (optional, can test with keyboard)
- [ ] Open browser DevTools console for error monitoring
- [ ] Have test product codes ready (or create items manually first)

---

## Unit Test Cases

### 1. POSKeyboardService Initialization

**Test:** Service initializes without errors
```javascript
const service = new POSKeyboardService(mockOrderState);
assert(service !== null);
assert(service.getStatus().isProcessing === false);
```

**Expected Result:** ✅ Service initialized, ready to accept keyboard events

---

### 2. Item Selection State

**Test:** `setSelectedItemId` updates selected item
```javascript
service.setSelectedItemId('item-123');
const status = service.getStatus();
assert(status.selectedItemId === 'item-123');
```

**Expected Result:** ✅ Selected item ID updated in service state

---

### 3. Request Queue Integrity

**Test:** Multiple rapid operations queue properly
```javascript
const results = [];
for (let i = 0; i < 5; i++) {
  service.handleNumericKey(String(i)).then(r => results.push(r));
}
await new Promise(resolve => setTimeout(resolve, 2000));
assert(results.length === 5);
```

**Expected Result:** ✅ All 5 operations processed in queue, no concurrent execution

---

## Integration Test Cases

### 1. Barcode Scan (Enter Key)

**Setup:**
- Navigate to Orders page
- Page is fully loaded with order context

**Test Steps:**
1. Click on barcode input field (hidden input, or focus via keyboard)
2. Type a valid product barcode (e.g., "1234567890")
3. Press Enter key
4. Observe order items table

**Expected Result:**
- ✅ Item appears in order table
- ✅ Quantity shows as 1
- ✅ Total price updates
- ✅ Order summary updates
- ✅ Barcode input clears

**Troubleshooting:**
- If item doesn't appear: Check barcode validity in backend
- If multiple items added: Check Enter key handler deduplication
- If input doesn't clear: Check barcode ref cleanup

---

### 2. Quantity Input (Numeric Keys 0-9)

**Setup:**
- Have at least 1 item in order
- Select the item via Tab or click
- Open console to monitor calls

**Test Steps:**
1. Press "5" key
2. Wait 1.5 seconds (let buffer timeout)
3. Observe quantity change
4. Press "1", "2", "3" rapidly (within 1 second)
5. Wait 1.5 seconds
6. Observe quantity changes to 123

**Expected Result:**
- ✅ Single digit updates quantity immediately (1-sec buffer)
- ✅ Multiple digits buffer and apply after 1 second
- ✅ Quantity never exceeds inventory
- ✅ Input field shows updated quantity

**Troubleshooting:**
- If quantity doesn't update: Check if item is selected
- If buffer applies too early: Check timeout value (should be 1000ms)
- If buffer applies too late: Verify timeout is not being cleared prematurely

---

### 3. Quantity Increment/Decrement (+/- Keys)

**Setup:**
- Have 1-2 items in order
- Select an item

**Test Steps:**
1. Press "+" key
2. Observe quantity increases by 1
3. Press "-" key
4. Observe quantity decreases by 1
5. Press "-" repeatedly until quantity = 1
6. Press "-" once more
7. Verify quantity stays at 1 (minimum)

**Expected Result:**
- ✅ "+" increments quantity by 1
- ✅ "-" decrements quantity by 1
- ✅ Minimum quantity is 1 (cannot go below)
- ✅ Real-time UI update after each press
- ✅ No API errors

**Troubleshooting:**
- If keys don't work: Check if item is selected
- If quantity goes below 1: Check minimum validation in handleMinusKey
- If increment is >1: Check for key repeat issues

---

### 4. Item Navigation (Tab Key)

**Setup:**
- Have 3+ items in order
- Start with no selection (or first item selected)

**Test Steps:**
1. Press Tab key
2. Observe next item highlights (className changes)
3. Press Tab again
4. Observe selection moves to next item
5. Press Tab until back at first item (circular navigation)
6. Hold Shift+Tab
7. Observe selection moves backward

**Expected Result:**
- ✅ Tab moves forward through items
- ✅ Shift+Tab moves backward
- ✅ Navigation wraps (first ↔ last)
- ✅ Selected item visually highlighted (CSS class applied)
- ✅ Selected item ID matches service state

**Troubleshooting:**
- If Tab doesn't navigate: Check usePOSKeyboard registration
- If selection doesn't show: Check CSS classes applied
- If navigation doesn't wrap: Check circular logic in handleTabKey

---

### 5. Item Deletion (Delete Key)

**Setup:**
- Have 2+ items in order
- Select an item via Tab or click

**Test Steps:**
1. Select a specific item (Tab to it, or click)
2. Press Delete key
3. Observe item disappears from table
4. Verify totals update
5. Try deleting when no item selected
6. Verify nothing happens (error handled gracefully)

**Expected Result:**
- ✅ Selected item removed from order
- ✅ Order totals recalculate
- ✅ Next item automatically selected (or previous)
- ✅ No error if trying to delete with no selection
- ✅ Table re-renders with remaining items

**Troubleshooting:**
- If item doesn't delete: Check if item is selected
- If totals wrong: Check quantity calculations
- If wrong item deletes: Check selectedItemId state sync

---

### 6. Undo Last Item (Ctrl+Z)

**Setup:**
- Have 2+ items in order
- Note the last added item

**Test Steps:**
1. Press Ctrl+Z
2. Observe last item removes
3. Verify order recalculates
4. Press Ctrl+Z again
5. Verify next-to-last item removes
6. Keep pressing Ctrl+Z until order is empty
7. Press Ctrl+Z once more (should do nothing)

**Expected Result:**
- ✅ Last item removed with Ctrl+Z
- ✅ Can undo multiple times
- ✅ Stops gracefully when no items remain
- ✅ Order totals update after each undo
- ✅ No error messages

**Troubleshooting:**
- If Ctrl+Z doesn't work: Check keyboard shortcut registration
- If wrong item removed: Check order item tracking
- If order doesn't update: Check state reconciliation

---

### 7. Clear Order (Escape Key)

**Setup:**
- Have 3+ items in order

**Test Steps:**
1. Press Escape key
2. Observe entire order clears
3. Verify order table is empty
4. Verify totals reset to $0.00
5. Verify selectedItemId resets

**Expected Result:**
- ✅ Entire order clears
- ✅ All items removed
- ✅ Totals reset to zero
- ✅ Selection cleared
- ✅ No confirmation dialog (for speed)

**Troubleshooting:**
- If Escape doesn't clear: Check handleEscapeKey implementation
- If some items remain: Check order clearing logic
- If totals wrong: Check summary recalculation

---

### 8. Clear All Order (Ctrl+Delete)

**Setup:**
- Have 2+ items in order

**Test Steps:**
1. Press Ctrl+Delete
2. Observe same behavior as Escape
3. Verify complete clear

**Expected Result:**
- ✅ Entire order clears (same as Escape)
- ✅ Alternative keyboard shortcut works

**Troubleshooting:**
- If doesn't work: Check Ctrl+Delete registration in usePOSKeyboard
- If only some items clear: Check clearOrder logic

---

### 9. Submit Order (Ctrl+Enter or F1)

**Setup:**
- Have 2+ items in order
- Order is valid (all items have quantity > 0)

**Test Steps:**
1. Press Ctrl+Enter
2. Observe order submission (may show loading state)
3. Wait for backend response
4. Verify order clears after successful submit
5. Check order appears in backend/database
6. Try F1 as alternative (if implemented)

**Expected Result:**
- ✅ Order submits to backend
- ✅ Success notification shown
- ✅ Order state clears
- ✅ Database updated with order
- ✅ Can start new order immediately

**Troubleshooting:**
- If submit fails: Check backend connectivity
- If order doesn't clear: Check state reset after submit
- If no feedback: Check for success notification

---

## Edge Case Tests

### 1. Rapid Key Presses
**Test:** Press multiple keys very rapidly
```
Press: 1 2 3 Enter Delete Tab + - 
(all within 1 second)
```

**Expected Result:**
- ✅ All operations queue
- ✅ No race conditions
- ✅ Operations execute sequentially
- ✅ No state corruption

---

### 2. Keyboard While Typing
**Test:** Press keyboard shortcut while barcode input has focus
```
Type: "12345"
Press: Delete (should delete character, not item)
Press: Escape (should not clear order, only clear input)
```

**Expected Result:**
- ✅ Shortcuts work normally in text input
- ✅ No special key conflicts
- ✅ Escape works globally (clears input AND order)
- ✅ Delete only affects input, not order when focused

---

### 3. Mouse Click Selection
**Test:** Click on item row instead of Tab key
```
1. Have 3+ items
2. Click 2nd item row
3. Press +/- keys
4. Press Delete
```

**Expected Result:**
- ✅ Item highlights when clicked
- ✅ selectedItemId updates
- ✅ Keyboard operations use clicked item
- ✅ Mouse and keyboard work together

---

### 4. Mixed Mouse and Keyboard
**Test:** Alternate between mouse and keyboard
```
1. Click item 1
2. Press Tab (move to item 2)
3. Click item 3
4. Press + (increment item 3)
5. Click item 1
6. Press Delete (delete item 1)
```

**Expected Result:**
- ✅ Selection transitions smoothly
- ✅ Operations use current selection
- ✅ No state conflicts
- ✅ UI always reflects actual state

---

### 5. Empty Order State
**Test:** Perform keyboard actions with empty order
```
1. Clear order completely
2. Press Tab (no items to navigate)
3. Press Delete (no item to delete)
4. Press + (no item to increment)
5. Press Undo (nothing to undo)
```

**Expected Result:**
- ✅ Tab does nothing (no error)
- ✅ Delete does nothing (no error)
- ✅ Plus does nothing (no error)
- ✅ Undo does nothing (no error)
- ✅ All handled gracefully

---

### 6. API Error Handling
**Test:** Simulate backend errors
```
1. Disconnect network
2. Try to scan barcode (Enter)
3. Observe error handling
4. Try to submit order
5. Observe error feedback
```

**Expected Result:**
- ✅ Error displayed to user
- ✅ Keyboard continues working
- ✅ Can retry operation
- ✅ No unhandled exceptions

---

## Performance Tests

### 1. Large Order with Many Items
**Test:** Add 50+ items to order, then navigate
```
1. Scan barcode 50 times (quantity 1 each)
2. Press Tab 10 times rapidly
3. Press + and - on final item
4. Submit order
```

**Expected Result:**
- ✅ No UI lag or freeze
- ✅ Tab navigation responsive
- ✅ Quantity changes instant
- ✅ Order submits quickly

**Baseline:** <100ms per keyboard action

---

### 2. Rapid Quantity Input
**Test:** Type many digits rapidly
```
Press: 1 2 3 4 5 6 7 8 9 (quickly)
Wait 1.5 seconds
Observe quantity = 123456789
```

**Expected Result:**
- ✅ All digits captured
- ✅ Correct quantity applied
- ✅ No digits lost
- ✅ Applied after 1-second timeout

---

### 3. Memory Leak Test
**Test:** Run for 5+ minutes with continuous keystrokes
```
1. Start app
2. Continuously press: Tab, +, -, Delete, Enter
3. Monitor memory usage in DevTools
4. Check for memory growth
```

**Expected Result:**
- ✅ Memory stable (±10%)
- ✅ No memory leaks
- ✅ Event listeners cleaned up
- ✅ Service cleanup works

---

## Browser Compatibility Tests

### Chrome/Edge
**Test:** Full keyboard functionality
- [ ] All shortcuts work
- [ ] No console errors
- [ ] CSS styling correct

### Firefox
**Test:** Full keyboard functionality
- [ ] All shortcuts work
- [ ] Focus handling correct
- [ ] No performance issues

### Safari
**Test:** Keyboard support (limited)
- [ ] Most shortcuts work
- [ ] Key repeat handled
- [ ] Focus rings visible

---

## Accessibility Tests

### Keyboard Navigation Only
**Test:** Complete order workflow using ONLY keyboard
```
1. Scan 3 items (Enter)
2. Navigate items (Tab)
3. Change quantities (+/-)
4. Remove item (Delete)
5. Submit order (Ctrl+Enter)
```

**Expected Result:**
- ✅ Complete without mouse
- ✅ All operations accessible
- ✅ Visual feedback clear
- ✅ Status always visible

---

### Focus Visibility
**Test:** Press Tab repeatedly around app
```
1. Press Tab throughout order page
2. Observe focus rings
3. Check all interactive elements show focus
```

**Expected Result:**
- ✅ Focus ring visible on all buttons
- ✅ Selected item clearly highlighted
- ✅ High contrast (WCAG AA)
- [ ] Works with system high-contrast mode

---

## Device Tests

### With Barcode Scanner
**Setup:** Physical barcode scanner connected

**Test:**
1. Scan barcode via scanner (simulates Enter key)
2. Scan multiple items
3. Submit order
4. Verify orders created in backend

**Expected Result:**
- ✅ Scanner input works perfectly
- ✅ No conflicts with keyboard shortcuts
- ✅ Rapid scanning supported
- ✅ Integration seamless

---

### Mobile/Touch Screen
**Setup:** Tablet or mobile device

**Test:**
1. Use keyboard (hardware or virtual)
2. Touch items to select
3. Use keyboard for quantity

**Expected Result:**
- ✅ Keyboard works on mobile
- ✅ Touch selection works
- ✅ Responsive layout
- ✅ No keyboard conflicts with touch

---

## Regression Test Suite

Run these tests after ANY changes to keyboard code:

```javascript
// test/keyboard.test.js
describe('Keyboard-Driven POS', () => {
  describe('POSKeyboardService', () => {
    test('should initialize without errors', () => {});
    test('should queue operations sequentially', () => {});
    test('should handle selected item tracking', () => {});
    test('should apply quantity buffer after timeout', () => {});
    test('should navigate items circularly', () => {});
  });

  describe('usePOSKeyboard Hook', () => {
    test('should register all keyboard shortcuts', () => {});
    test('should not conflict with text input', () => {});
    test('should handle key combinations', () => {});
  });

  describe('OrdersPage Integration', () => {
    test('should show selected item highlighting', () => {});
    test('should update totals with keyboard changes', () => {});
    test('should submit order with keyboard', () => {});
  });
});
```

---

## Sign-Off Checklist

After all tests pass:

- [ ] All keyboard shortcuts work correctly
- [ ] No console errors or warnings
- [ ] API calls working properly
- [ ] State management consistent
- [ ] UI feedback clear and responsive
- [ ] Error handling graceful
- [ ] Performance acceptable (<100ms per action)
- [ ] Accessibility verified
- [ ] Documentation complete
- [ ] Ready for production

---

## Known Issues & Workarounds

### Issue: Tab key doesn't work in Chrome
**Workaround:** Update browser to latest version

### Issue: Quantity input buffer applies immediately
**Workaround:** Check timeout value is 1000ms

### Issue: Escape key clears input AND order
**Workaround:** By design - full keyboard control prioritized

---

## Support & Debugging

### Enable Debug Logging
```javascript
// In OrdersPage.js useEffect
useEffect(() => {
  keyboardServiceRef.current.DEBUG = true;
  const status = keyboardServiceRef.current.getStatus();
  console.log('Keyboard Service Status:', status);
}, []);
```

### Monitor Queue
```javascript
// Check queue in console
const status = window.keyboardService?.getStatus();
console.log('Queue:', status.queueLength, 'Processing:', status.isProcessing);
```

### Check Event Listeners
```javascript
// Verify listeners attached
window.addEventListener('keydown', (e) => {
  console.log('Key:', e.key, 'Code:', e.code);
});
```

---

## Performance Benchmarks

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Barcode scan | <50ms | Optimistic update + backend sync |
| Item selection (Tab) | <10ms | State update only |
| Quantity change | <20ms | State + total recalculation |
| Order submit | <500ms | Backend API call |
| Clear order | <20ms | State reset |

---

## Test Environment Setup

**Hardware:**
- PC/Mac with keyboard
- (Optional) USB barcode scanner
- (Optional) Mobile device with keyboard

**Software:**
- Node.js 14+
- React 17+
- Electron 13+
- Chrome/Firefox/Safari

**Connection:**
- Backend API server running
- Database accessible
- No firewall blocking localhost

---

## Test Results Template

```
Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

RESULTS:
- Barcode scan: [ ] PASS [ ] FAIL
- Quantity input: [ ] PASS [ ] FAIL
- Item navigation: [ ] PASS [ ] FAIL
- Item deletion: [ ] PASS [ ] FAIL
- Order submission: [ ] PASS [ ] FAIL
- Error handling: [ ] PASS [ ] FAIL
- Performance: [ ] PASS [ ] FAIL
- Accessibility: [ ] PASS [ ] FAIL

Issues Found:
1. ___________
2. ___________
3. ___________

Sign-Off: ___________
```
