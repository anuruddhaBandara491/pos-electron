# Backend Payment API Specification
## POS System - Payment Integration Guide

**Status:** Required for Frontend Payment Flow  
**Frontend:** c:\xampp\htdocs\pos-electron  
**Backend:** c:\xampp\htdocs\pos-system  
**Created:** January 29, 2024

---

## Overview

This document specifies the exact API endpoints, request/response schemas, database requirements, and error handling that the backend must implement to support the Electron POS application's payment flow.

The Electron frontend has been fully implemented with:
- ✅ PaymentService.js (backend communication layer)
- ✅ usePaymentFlow.js (React state management)
- ✅ Payment.css (UI styling)
- ✅ OrdersPage.js integration (payment modal)

**Waiting For:** Backend API implementation

---

## Required API Endpoints

### Endpoint Summary Table

| Method | Endpoint | Purpose | Priority |
|--------|----------|---------|----------|
| POST | `/payments/submit` | Submit payment with idempotency | Critical |
| GET | `/payments/balance/{orderId}` | Get current payment status | Critical |
| GET | `/payments/{paymentId}/status` | Confirm payment status | Critical |
| GET | `/payments/history/{orderId}` | List all payments for order | High |

---

## Endpoint 1: POST /payments/submit

### Purpose
Submit a payment for an order. Handles both partial and full payments. Prevents double submission via idempotency keys.

### Request Headers
```
Content-Type: application/json
Idempotency-Key: (required) - UUID or hash preventing duplicate processing
X-Retry-Attempt: (optional) - Current retry attempt number (1, 2, or 3)
Authorization: Bearer {token}
```

### Request Body
```json
{
  "orderId": "ord_12345",
  "amount": 25.50,
  "method": "cash",
  "reference": "CASH_001",
  "metadata": {
    "source": "pos-electron",
    "version": "1.0"
  }
}
```

### Request Field Specifications

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| orderId | string | Yes | Must exist in orders table | "ord_12345" |
| amount | number | Yes | Must be > 0, max 2 decimals | 25.50 |
| method | enum | Yes | 'cash' \| 'card' \| 'check' | "cash" |
| reference | string | No | Max 100 chars, alphanumeric | "CASH_001" |
| metadata | object | No | JSON object, max 1KB | {...} |

### Response (Success - 200 OK)
```json
{
  "success": true,
  "payment": {
    "paymentId": "pay_abc123",
    "orderId": "ord_12345",
    "amount": 25.50,
    "method": "cash",
    "status": "completed",
    "reference": "CASH_001",
    "timestamp": "2024-01-29T10:30:00Z",
    "balanceRemaining": 24.50,
    "totalPaid": 25.50,
    "orderStatus": "partial"
  }
}
```

### Response Field Specifications

| Field | Type | Notes |
|-------|------|-------|
| success | boolean | Always true for 200 response |
| paymentId | string | Unique payment identifier |
| orderId | string | Associated order ID |
| amount | number | Payment amount submitted |
| method | string | Payment method used |
| status | string | 'completed' \| 'pending' \| 'failed' |
| reference | string | Reference number if provided |
| timestamp | ISO 8601 | Server timestamp (YYYY-MM-DDTHH:mm:ssZ) |
| balanceRemaining | number | Calculated by backend |
| totalPaid | number | Sum of all completed payments |
| orderStatus | string | 'unpaid' \| 'partial' \| 'paid' |

### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "amount",
    "message": "Amount must be greater than zero"
  }
}
```

**400 Bad Request - Partial Amount Exceeds Balance**
```json
{
  "success": false,
  "error": "Partial amount exceeds remaining balance",
  "code": "AMOUNT_EXCEEDS_BALANCE",
  "details": {
    "requestedAmount": 50.00,
    "balanceRemaining": 30.00
  }
}
```

**400 Bad Request - Order Already Paid**
```json
{
  "success": false,
  "error": "Order is already fully paid",
  "code": "ALREADY_PAID",
  "details": {
    "orderId": "ord_12345",
    "balanceRemaining": 0
  }
}
```

**409 Conflict - Idempotency Key Conflict**
```json
{
  "success": false,
  "error": "Payment is currently being processed",
  "code": "PAYMENT_IN_PROGRESS",
  "details": {
    "idempotencyKey": "idkey_xyz",
    "existingPaymentId": "pay_abc123"
  }
}
```

**402 Payment Required - Card Declined**
```json
{
  "success": false,
  "error": "Payment method declined",
  "code": "PAYMENT_DECLINED",
  "details": {
    "reason": "Insufficient funds",
    "method": "card"
  }
}
```

**404 Not Found - Order Not Found**
```json
{
  "success": false,
  "error": "Order not found",
  "code": "ORDER_NOT_FOUND",
  "details": {
    "orderId": "ord_12345"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "details": {
    "message": "Database connection failed"
  }
}
```

### Backend Implementation Notes

1. **Idempotency Handling:**
   ```sql
   -- Check if payment already being processed
   SELECT paymentId FROM payment_idempotency_keys 
   WHERE idempotencyKey = ? AND expiresAt > NOW()
   
   -- If exists and status = 'processing': return 409 Conflict
   -- If exists and status = 'completed': return cached response
   -- If not exists: proceed with payment
   ```

2. **Balance Calculation:**
   ```sql
   -- Get order total
   SELECT total FROM orders WHERE id = ?
   
   -- Calculate total paid
   SELECT SUM(amount) as totalPaid FROM payments 
   WHERE orderId = ? AND status = 'completed'
   
   -- Calculate remaining
   balanceRemaining = total - totalPaid
   ```

3. **Payment Processing:**
   ```sql
   -- BEGIN TRANSACTION
   
   -- Lock order row
   SELECT * FROM orders WHERE id = ? FOR UPDATE
   
   -- Validate amount doesn't exceed balance
   IF amount > (order.total - SUM(previous_payments)) {
     ROLLBACK; return AMOUNT_EXCEEDS_BALANCE
   }
   
   -- Check if fully paid
   IF (order.total - SUM(previous_payments)) <= 0 {
     ROLLBACK; return ALREADY_PAID
   }
   
   -- Insert payment record
   INSERT INTO payments (...) VALUES (...)
   
   -- Store idempotency key
   INSERT INTO payment_idempotency_keys (...) VALUES (...)
   
   -- Update order status if fully paid
   IF (balanceRemaining <= 0) {
     UPDATE orders SET status = 'paid' WHERE id = ?
   }
   
   -- COMMIT TRANSACTION
   ```

4. **Timestamp:**
   - Use server time (NOW() in MySQL)
   - Format: ISO 8601 with UTC timezone
   - Example: "2024-01-29T10:30:00Z"

5. **Retry Logic:**
   - Max 3 retry attempts (frontend)
   - Idempotency key ensures no duplicate charges
   - Return 409 Conflict if payment in progress
   - Return cached response if already completed

---

## Endpoint 2: GET /payments/balance/{orderId}

### Purpose
Get current payment balance for an order. Used to display balance in payment modal before submitting payment.

### Request Headers
```
Authorization: Bearer {token}
```

### URL Parameters
```
orderId (required): string - Order identifier
```

### Request Example
```
GET /payments/balance/ord_12345
```

### Response (Success - 200 OK)
```json
{
  "success": true,
  "balance": {
    "orderId": "ord_12345",
    "totalAmount": 50.00,
    "totalPaid": 25.50,
    "balanceRemaining": 24.50,
    "status": "partial",
    "payments": [
      {
        "paymentId": "pay_123",
        "method": "cash",
        "amount": 25.50,
        "timestamp": "2024-01-29T10:15:00Z",
        "status": "completed"
      }
    ]
  }
}
```

### Response Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| orderId | string | The order identifier |
| totalAmount | number | Total order amount |
| totalPaid | number | Sum of all completed payments |
| balanceRemaining | number | totalAmount - totalPaid |
| status | enum | 'unpaid' \| 'partial' \| 'paid' |
| payments | array | All payments for this order |

### Payments Array Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| paymentId | string | Unique payment ID |
| method | string | 'cash' \| 'card' \| 'check' |
| amount | number | Payment amount |
| timestamp | ISO 8601 | When payment was processed |
| status | string | 'completed' \| 'pending' \| 'failed' |

### Error Responses

**404 Not Found - Order Not Found**
```json
{
  "success": false,
  "error": "Order not found",
  "code": "ORDER_NOT_FOUND",
  "details": {
    "orderId": "ord_12345"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to calculate balance",
  "code": "BALANCE_CALCULATION_ERROR"
}
```

### Backend Implementation Notes

1. **Query Pattern:**
   ```sql
   SELECT 
     id as orderId,
     total as totalAmount,
     COALESCE(SUM(p.amount), 0) as totalPaid,
     (total - COALESCE(SUM(p.amount), 0)) as balanceRemaining,
     CASE 
       WHEN (total - COALESCE(SUM(p.amount), 0)) <= 0 THEN 'paid'
       WHEN COALESCE(SUM(p.amount), 0) > 0 THEN 'partial'
       ELSE 'unpaid'
     END as status
   FROM orders o
   LEFT JOIN payments p ON o.id = p.orderId AND p.status = 'completed'
   WHERE o.id = ?
   GROUP BY o.id
   ```

2. **Performance:**
   - Cache results for 5 seconds (optional)
   - Use database indexes on payments.orderId
   - Consider materializing balance in orders table for high-frequency queries

3. **Edge Cases:**
   - Order not found: return 404
   - Order has no payments: balanceRemaining = totalAmount
   - Order overpaid: balanceRemaining < 0 (shouldn't happen with validation)

---

## Endpoint 3: GET /payments/{paymentId}/status

### Purpose
Confirm payment status after submission. Frontend calls this to verify payment was accepted by backend and get final balance calculation.

### Request Headers
```
Authorization: Bearer {token}
```

### URL Parameters
```
paymentId (required): string - Payment identifier
```

### Request Example
```
GET /payments/pay_abc123/status
```

### Response (Success - 200 OK)
```json
{
  "success": true,
  "status": {
    "paymentId": "pay_abc123",
    "orderId": "ord_12345",
    "amount": 25.50,
    "method": "cash",
    "paymentStatus": "completed",
    "timestamp": "2024-01-29T10:30:00Z",
    "confirmedAt": "2024-01-29T10:30:05Z",
    "balanceRemaining": 24.50,
    "totalPaid": 25.50,
    "orderStatus": "partial"
  }
}
```

### Response Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| paymentId | string | The payment identifier |
| orderId | string | Associated order ID |
| amount | number | Payment amount |
| method | string | Payment method |
| paymentStatus | string | 'completed' \| 'pending' \| 'failed' |
| timestamp | ISO 8601 | When payment was submitted |
| confirmedAt | ISO 8601 | When backend confirmed (server time) |
| balanceRemaining | number | Recalculated from backend |
| totalPaid | number | Recalculated sum of payments |
| orderStatus | string | 'unpaid' \| 'partial' \| 'paid' |

### Error Responses

**404 Not Found - Payment Not Found**
```json
{
  "success": false,
  "error": "Payment not found",
  "code": "PAYMENT_NOT_FOUND",
  "details": {
    "paymentId": "pay_abc123"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to confirm payment status",
  "code": "STATUS_CONFIRMATION_ERROR"
}
```

### Backend Implementation Notes

1. **Query Pattern:**
   ```sql
   SELECT 
     p.id as paymentId,
     p.orderId,
     p.amount,
     p.method,
     p.status as paymentStatus,
     p.timestamp,
     NOW() as confirmedAt,
     (o.total - COALESCE(SUM(p2.amount), 0)) as balanceRemaining,
     COALESCE(SUM(p2.amount), 0) as totalPaid,
     CASE 
       WHEN (o.total - COALESCE(SUM(p2.amount), 0)) <= 0 THEN 'paid'
       WHEN COALESCE(SUM(p2.amount), 0) > 0 THEN 'partial'
       ELSE 'unpaid'
     END as orderStatus
   FROM payments p
   JOIN orders o ON p.orderId = o.id
   LEFT JOIN payments p2 ON p.orderId = p2.orderId AND p2.status = 'completed'
   WHERE p.id = ?
   GROUP BY p.id
   ```

2. **confirmedAt:**
   - Always use current server time (NOW())
   - Proves backend processed the confirmation request
   - Frontend displays this timestamp to user

3. **Balance Recalculation:**
   - Always recalculate from database
   - Don't return value from original payment submission
   - Ensures accuracy if concurrent payments occurred

---

## Endpoint 4: GET /payments/history/{orderId}

### Purpose
Fetch all payment history for an order. Used to display payment list in payment modal.

### Request Headers
```
Authorization: Bearer {token}
```

### URL Parameters
```
orderId (required): string - Order identifier
limit (optional): number - Max results (default: 100)
offset (optional): number - Pagination offset (default: 0)
```

### Request Example
```
GET /payments/history/ord_12345?limit=50&offset=0
```

### Response (Success - 200 OK)
```json
{
  "success": true,
  "history": {
    "orderId": "ord_12345",
    "totalPayments": 2,
    "totalAmount": 50.00,
    "totalPaid": 25.50,
    "payments": [
      {
        "paymentId": "pay_abc123",
        "method": "cash",
        "amount": 15.00,
        "timestamp": "2024-01-29T10:15:00Z",
        "status": "completed",
        "reference": "CASH_001"
      },
      {
        "paymentId": "pay_def456",
        "method": "card",
        "amount": 10.50,
        "timestamp": "2024-01-29T10:20:00Z",
        "status": "completed",
        "reference": "CARD_1234"
      }
    ]
  }
}
```

### Response Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| orderId | string | The order identifier |
| totalPayments | number | Count of payments returned |
| totalAmount | number | Order total |
| totalPaid | number | Sum of all completed payments |
| payments | array | Payment records |

### Payments Array Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| paymentId | string | Unique payment ID |
| method | string | 'cash' \| 'card' \| 'check' |
| amount | number | Payment amount |
| timestamp | ISO 8601 | When payment was processed |
| status | string | 'completed' \| 'pending' \| 'failed' |
| reference | string | Reference number if available |

### Error Responses

**404 Not Found - Order Not Found**
```json
{
  "success": false,
  "error": "Order not found",
  "code": "ORDER_NOT_FOUND",
  "details": {
    "orderId": "ord_12345"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to retrieve payment history",
  "code": "HISTORY_RETRIEVAL_ERROR"
}
```

### Backend Implementation Notes

1. **Query Pattern:**
   ```sql
   SELECT 
     p.id as paymentId,
     p.method,
     p.amount,
     p.timestamp,
     p.status,
     p.reference,
     COUNT(*) OVER() as totalPayments
   FROM payments p
   WHERE p.orderId = ?
   ORDER BY p.timestamp DESC
   LIMIT ? OFFSET ?
   ```

2. **Sorting:**
   - Default: Most recent first (ORDER BY timestamp DESC)
   - Frontend displays newest payment at top of list

3. **Pagination:**
   - Default limit: 100 payments
   - Support offset-based pagination
   - Include totalPayments for UI feedback

4. **Status Filter:**
   - Include only 'completed' payments by default
   - Optionally include 'pending' for transparency
   - Exclude 'failed' payments from balance calculation

---

## Database Schema Requirements

### Table 1: payments

```sql
CREATE TABLE payments (
  id VARCHAR(36) PRIMARY KEY COMMENT 'Unique payment ID (pay_*)',
  orderId VARCHAR(36) NOT NULL COMMENT 'Foreign key to orders table',
  amount DECIMAL(10, 2) NOT NULL COMMENT 'Payment amount',
  method ENUM('cash', 'card', 'check') NOT NULL COMMENT 'Payment method',
  status ENUM('completed', 'pending', 'failed') NOT NULL DEFAULT 'completed' COMMENT 'Payment status',
  reference VARCHAR(100) COMMENT 'Payment reference number',
  idempotencyKey VARCHAR(255) UNIQUE COMMENT 'Idempotency key (base64)',
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When payment was processed',
  metadata JSON COMMENT 'Additional payment metadata',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_orderId (orderId),
  INDEX idx_idempotencyKey (idempotencyKey),
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status),
  
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Table 2: payment_idempotency_keys

```sql
CREATE TABLE payment_idempotency_keys (
  id VARCHAR(36) PRIMARY KEY,
  idempotencyKey VARCHAR(255) NOT NULL UNIQUE COMMENT 'Idempotency key from request header',
  paymentId VARCHAR(36) COMMENT 'Associated payment ID',
  status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
  response JSON COMMENT 'Cached response for duplicates',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL COMMENT 'When idempotency entry expires (24 hours)',
  
  INDEX idx_idempotencyKey (idempotencyKey),
  INDEX idx_expiresAt (expiresAt),
  
  FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Table 3: orders (existing, add column if needed)

```sql
-- Verify orders table has these columns:
ALTER TABLE orders ADD COLUMN total DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN status ENUM('unpaid', 'partial', 'paid', 'cancelled') DEFAULT 'unpaid';

-- Add index for payment queries
ALTER TABLE orders ADD INDEX idx_status (status);
```

### Indexes Required

```sql
-- On payments table
CREATE INDEX idx_payments_orderId ON payments(orderId);
CREATE INDEX idx_payments_idempotencyKey ON payments(idempotencyKey);
CREATE INDEX idx_payments_timestamp ON payments(timestamp);
CREATE INDEX idx_payments_status ON payments(status);

-- On payment_idempotency_keys table
CREATE INDEX idx_idem_key ON payment_idempotency_keys(idempotencyKey);
CREATE INDEX idx_idem_expires ON payment_idempotency_keys(expiresAt);

-- On orders table
CREATE INDEX idx_orders_status ON orders(status);
```

---

## Error Codes Reference

All error responses should include an error code for frontend handling:

| Code | HTTP Status | Cause | Retry? |
|------|-------------|-------|--------|
| VALIDATION_ERROR | 400 | Invalid request data | No |
| AMOUNT_EXCEEDS_BALANCE | 400 | Partial amount > remaining | No |
| ALREADY_PAID | 400 | Order already fully paid | No |
| INVALID_AMOUNT | 400 | Amount ≤ 0 or invalid format | No |
| PAYMENT_DECLINED | 402 | Card/method declined | No |
| PAYMENT_IN_PROGRESS | 409 | Duplicate idempotency key | No (wait) |
| ORDER_NOT_FOUND | 404 | Order doesn't exist | No |
| PAYMENT_NOT_FOUND | 404 | Payment doesn't exist | No |
| INTERNAL_ERROR | 500 | Server error | Yes |
| DATABASE_ERROR | 500 | Database connection/query error | Yes |
| BALANCE_CALCULATION_ERROR | 500 | Error calculating balance | Yes |
| STATUS_CONFIRMATION_ERROR | 500 | Error confirming status | Yes |
| HISTORY_RETRIEVAL_ERROR | 500 | Error retrieving history | Yes |

---

## HTTP Status Codes

| Code | Use Case |
|------|----------|
| 200 OK | Successful payment/balance/status retrieval |
| 400 Bad Request | Validation error, amount exceeds balance, already paid |
| 402 Payment Required | Payment method declined |
| 404 Not Found | Order or payment not found |
| 409 Conflict | Idempotency key conflict (payment in progress) |
| 500 Internal Server Error | Server or database error |

---

## Request/Response Examples

### Complete Payment Flow Example

**Step 1: Fetch Balance**
```bash
curl -X GET \
  https://api.pos-system.local/payments/balance/ord_12345 \
  -H 'Authorization: Bearer token'

# Response 200 OK
{
  "success": true,
  "balance": {
    "orderId": "ord_12345",
    "totalAmount": 50.00,
    "totalPaid": 0,
    "balanceRemaining": 50.00,
    "status": "unpaid",
    "payments": []
  }
}
```

**Step 2: Submit Partial Payment**
```bash
curl -X POST \
  https://api.pos-system.local/payments/submit \
  -H 'Authorization: Bearer token' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: ikey_abc123xyz789' \
  -d '{
    "orderId": "ord_12345",
    "amount": 25.00,
    "method": "cash",
    "reference": "CASH_001"
  }'

# Response 200 OK
{
  "success": true,
  "payment": {
    "paymentId": "pay_123",
    "orderId": "ord_12345",
    "amount": 25.00,
    "method": "cash",
    "status": "completed",
    "reference": "CASH_001",
    "timestamp": "2024-01-29T10:30:00Z",
    "balanceRemaining": 25.00,
    "totalPaid": 25.00,
    "orderStatus": "partial"
  }
}
```

**Step 3: Confirm Payment Status**
```bash
curl -X GET \
  https://api.pos-system.local/payments/pay_123/status \
  -H 'Authorization: Bearer token'

# Response 200 OK
{
  "success": true,
  "status": {
    "paymentId": "pay_123",
    "orderId": "ord_12345",
    "amount": 25.00,
    "method": "cash",
    "paymentStatus": "completed",
    "timestamp": "2024-01-29T10:30:00Z",
    "confirmedAt": "2024-01-29T10:30:05Z",
    "balanceRemaining": 25.00,
    "totalPaid": 25.00,
    "orderStatus": "partial"
  }
}
```

**Step 4: Get Payment History**
```bash
curl -X GET \
  'https://api.pos-system.local/payments/history/ord_12345?limit=50&offset=0' \
  -H 'Authorization: Bearer token'

# Response 200 OK
{
  "success": true,
  "history": {
    "orderId": "ord_12345",
    "totalPayments": 1,
    "totalAmount": 50.00,
    "totalPaid": 25.00,
    "payments": [
      {
        "paymentId": "pay_123",
        "method": "cash",
        "amount": 25.00,
        "timestamp": "2024-01-29T10:30:00Z",
        "status": "completed",
        "reference": "CASH_001"
      }
    ]
  }
}
```

---

## Implementation Priority

### Phase 1 (Critical - Must Have)
1. ✅ POST /payments/submit - Core payment submission
2. ✅ GET /payments/balance/{orderId} - Balance inquiry
3. ✅ GET /payments/{paymentId}/status - Payment confirmation

### Phase 2 (High - Strongly Recommended)
4. ✅ GET /payments/history/{orderId} - Payment history
5. Database schema (payments, payment_idempotency_keys)
6. Error response formatting

### Phase 3 (Optional - Future)
- Payment method tokenization
- Refund processing
- Recurring payments
- Reporting/analytics

---

## Security Considerations

1. **Idempotency Keys:**
   - Must be unique per payment attempt
   - Frontend generates: base64(orderId-amount-method-timestamp)
   - Backend validates: prevent duplicate processing
   - Expire after 24 hours

2. **Authorization:**
   - All endpoints require Bearer token
   - Validate token before processing
   - Log all payment transactions

3. **Data Validation:**
   - Validate amount > 0
   - Validate amount ≤ balance
   - Validate orderId exists
   - Validate method is in enum

4. **Transaction Safety:**
   - Use database transactions (BEGIN/COMMIT/ROLLBACK)
   - Lock order row during payment processing (FOR UPDATE)
   - Prevent race conditions with concurrent payments

5. **Sensitive Data:**
   - Never log payment amounts
   - Mask card numbers in responses
   - Use HTTPS only
   - Don't expose internal error messages

---

## Testing Checklist

- [ ] Create test order with total $50.00
- [ ] Fetch balance: should show $50.00 remaining
- [ ] Submit $25 cash payment: should return $25.00 remaining
- [ ] Confirm payment status: should return payment details
- [ ] Fetch balance again: should show $25.00 remaining
- [ ] Get payment history: should show 1 payment of $25
- [ ] Submit duplicate payment (same idempotency key): should return 409
- [ ] Submit $50 partial payment: should return AMOUNT_EXCEEDS_BALANCE
- [ ] Submit $25 second payment: should show $0 remaining, status='paid'
- [ ] Try paying already paid order: should return ALREADY_PAID
- [ ] Verify all error codes in error responses
- [ ] Verify all timestamps in ISO 8601 format
- [ ] Test with concurrent payment requests
- [ ] Verify database locks prevent race conditions
- [ ] Test with missing authorization header: should return 401
- [ ] Test with invalid payment method: should return VALIDATION_ERROR

---

## Performance Requirements

| Operation | Target | Notes |
|-----------|--------|-------|
| POST /payments/submit | <500ms | Including balance calculation |
| GET /payments/balance | <200ms | Optimized query with indexes |
| GET /payments/{paymentId}/status | <100ms | Single row fetch |
| GET /payments/history | <200ms | With pagination |

---

## Logging and Monitoring

All payment operations should be logged:

```
[PAYMENT_SUBMISSION] orderId=ord_12345, amount=25.00, method=cash, paymentId=pay_123
[BALANCE_FETCH] orderId=ord_12345, totalAmount=50.00, balanceRemaining=25.00
[PAYMENT_CONFIRMED] paymentId=pay_123, status=completed, confirmedAt=2024-01-29T10:30:05Z
[DUPLICATE_DETECTED] idempotencyKey=ikey_abc123xyz789, existingPaymentId=pay_123
[ERROR_AMOUNT_EXCEEDS] orderId=ord_12345, requested=50.00, remaining=25.00
```

---

## Frontend Integration Points

The Electron frontend expects these exact behaviors:

1. **POST /payments/submit** must:
   - Accept Idempotency-Key header
   - Return paymentId in response
   - Calculate and return balanceRemaining
   - Support retry (max 3 attempts)
   - Return 409 Conflict if duplicate

2. **GET /payments/balance/{orderId}** must:
   - Return accurate balance calculation
   - Include all payments in array
   - Calculate status (unpaid/partial/paid)

3. **GET /payments/{paymentId}/status** must:
   - Confirm payment with server timestamp
   - Recalculate balance from database
   - Return confirmedAt timestamp

4. **GET /payments/history/{orderId}** must:
   - Return payments in reverse chronological order
   - Include timestamp for each payment
   - Support pagination with limit/offset

---

## Summary

This document specifies **4 critical API endpoints** that must be implemented in the backend to support the complete payment flow in the Electron POS application.

**Frontend Status:** ✅ Complete (0 errors)
**Backend Status:** ⏳ Pending implementation

All endpoint specifications, schemas, error codes, and database requirements are documented above.

For questions or clarifications, refer to:
- [PAYMENT_FLOW_IMPLEMENTATION.md](PAYMENT_FLOW_IMPLEMENTATION.md) - Technical details
- [PAYMENT_FLOW_QUICK_REFERENCE.md](PAYMENT_FLOW_QUICK_REFERENCE.md) - Quick reference
- [PAYMENT_FLOW_SUMMARY.md](PAYMENT_FLOW_SUMMARY.md) - Overview

**Next Steps:**
1. Review this specification with backend team
2. Implement database schema (tables + indexes)
3. Implement 4 API endpoints
4. Run testing checklist
5. Integrate with Electron frontend

---

**Document Version:** 1.0  
**Last Updated:** January 29, 2024  
**Status:** Ready for Implementation  
