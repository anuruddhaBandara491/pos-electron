import log from 'electron-log';

/**
 * POSKeyboardService
 * 
 * Backend-triggering logic for keyboard actions.
 * Handles API calls based on keyboard shortcuts.
 * 
 * Features:
 * - Barcode scanning (Enter key)
 * - Order submission
 * - Item removal / clearing
 * - Quantity adjustment
 * - Payment processing
 * - Receipt printing
 * - Report generation
 * - Safe error handling
 * - Request queuing
 */
class POSKeyboardService {
  constructor(orderState, barcodeScanner, paymentService = null) {
    this.orderState = orderState;
    this.barcodeScanner = barcodeScanner;
    this.paymentService = paymentService;
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastBarcode = '';
    this.selectedItemId = null;
    this.quantityInputBuffer = '';
    this.quantityInputTimeout = null;
  }

  /**
   * Process queued requests sequentially
   */
  async _processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      try {
        await request();
      } catch (err) {
        log.error('[POSKeyboardService] Queue error:', err.message);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Queue a request to prevent concurrent operations
   */
  _queueRequest(fn) {
    this.requestQueue.push(fn);
    this._processQueue();
  }

  /**
   * Handle Enter key
   * Triggers: Barcode scan or order submission
   */
  async handleEnterKey(barcodeInput) {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          log.info('[POS Keyboard] Enter pressed');

          const barcode = (barcodeInput || '').trim();

          if (!barcode) {
            log.warn('[POS Keyboard] Empty barcode');
            reject(new Error('No barcode entered'));
            return;
          }

          // Query product by barcode
          log.debug('[POS Keyboard] Scanning barcode:', barcode);

          // This will be called with actual barcode data
          if (this.barcodeScanner && this.barcodeScanner.onScan) {
            await this.barcodeScanner.onScan(barcode);
          }

          this.lastBarcode = barcode;
          resolve({ success: true, barcode });
        } catch (err) {
          log.error('[POS Keyboard] Enter key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle Escape key
   * Triggers: Clear order
   */
  async handleEscapeKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          log.info('[POS Keyboard] Escape pressed - clearing order');

          if (!this.orderState) {
            reject(new Error('Order state not available'));
            return;
          }

          if (this.orderState.order.items.length === 0) {
            log.debug('[POS Keyboard] Order already empty');
            resolve({ success: true, itemsCleared: 0 });
            return;
          }

          const itemCount = this.orderState.order.items.length;
          this.orderState.clearOrder();

          log.info(`[POS Keyboard] Cleared ${itemCount} items`);
          resolve({ success: true, itemsCleared: itemCount });
        } catch (err) {
          log.error('[POS Keyboard] Escape key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle Delete key
   * Triggers: Remove selected item from order
   */
  async handleDeleteKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          log.info('[POS Keyboard] Delete pressed');

          if (!this.orderState || !this.selectedItemId) {
            reject(new Error('No item selected'));
            return;
          }

          await this.orderState.removeItem(this.selectedItemId);
          this.selectedItemId = null;

          log.info('[POS Keyboard] Item removed');
          resolve({ success: true, itemRemoved: true });
        } catch (err) {
          log.error('[POS Keyboard] Delete key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle Ctrl+Z (Undo)
   * Triggers: Remove last added item
   */
  async handleUndoKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          log.info('[POS Keyboard] Ctrl+Z pressed - undo last item');

          if (!this.orderState || this.orderState.order.items.length === 0) {
            reject(new Error('No items to undo'));
            return;
          }

          // Get last item (first in array if maintained in order)
          const lastItem = this.orderState.order.items[
            this.orderState.order.items.length - 1
          ];

          if (lastItem) {
            await this.orderState.removeItem(lastItem.id);
            log.info('[POS Keyboard] Last item removed');
            resolve({ success: true, itemRemoved: lastItem.name });
          }
        } catch (err) {
          log.error('[POS Keyboard] Undo key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle Ctrl+Delete
   * Triggers: Clear entire order
   */
  async handleClearOrderKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          log.info('[POS Keyboard] Ctrl+Delete pressed - clearing entire order');

          if (!this.orderState) {
            reject(new Error('Order state not available'));
            return;
          }

          const itemCount = this.orderState.order.items.length;
          this.orderState.clearOrder();
          this.selectedItemId = null;
          this.quantityInputBuffer = '';

          log.info(`[POS Keyboard] Order cleared (${itemCount} items)`);
          resolve({ success: true, itemsCleared: itemCount });
        } catch (err) {
          log.error('[POS Keyboard] Clear order key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle numeric key (0-9)
   * Triggers: Quick quantity input
   */
  async handleNumericKey(digit) {
    return new Promise((resolve) => {
      // Accumulate digits for quantity input
      this.quantityInputBuffer += digit;

      // Clear timeout if exists
      if (this.quantityInputTimeout) {
        clearTimeout(this.quantityInputTimeout);
      }

      log.debug(`[POS Keyboard] Quantity input: ${this.quantityInputBuffer}`);

      // Apply quantity after 1 second of inactivity
      this.quantityInputTimeout = setTimeout(() => {
        this._queueRequest(async () => {
          try {
            const quantity = parseInt(this.quantityInputBuffer, 10);

            if (isNaN(quantity) || quantity < 0) {
              log.warn('[POS Keyboard] Invalid quantity:', this.quantityInputBuffer);
              this.quantityInputBuffer = '';
              resolve({ success: false, error: 'Invalid quantity' });
              return;
            }

            if (quantity === 0) {
              log.debug('[POS Keyboard] Zero quantity entered');
              this.quantityInputBuffer = '';
              resolve({ success: true, quantity: 0 });
              return;
            }

            if (!this.selectedItemId) {
              log.warn('[POS Keyboard] No item selected for quantity');
              this.quantityInputBuffer = '';
              resolve({ success: false, error: 'No item selected' });
              return;
            }

            // Apply quantity to selected item
            await this.orderState.updateItemQuantity(
              this.selectedItemId,
              quantity
            );

            log.info(`[POS Keyboard] Quantity set to ${quantity}`);
            this.quantityInputBuffer = '';

            resolve({ success: true, quantity });
          } catch (err) {
            log.error('[POS Keyboard] Quantity input error:', err.message);
            this.quantityInputBuffer = '';
            resolve({ success: false, error: err.message });
          }
        });
      }, 1000);
    });
  }

  /**
   * Handle + key
   * Triggers: Increment selected item quantity
   */
  async handlePlusKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          if (!this.orderState || !this.selectedItemId) {
            reject(new Error('No item selected'));
            return;
          }

          const item = this.orderState.order.items.find(
            (i) => i.id === this.selectedItemId
          );

          if (!item) {
            reject(new Error('Item not found'));
            return;
          }

          await this.orderState.updateItemQuantity(
            this.selectedItemId,
            item.quantity + 1
          );

          log.info(
            `[POS Keyboard] Quantity incremented to ${item.quantity + 1}`
          );

          resolve({ success: true, quantity: item.quantity + 1 });
        } catch (err) {
          log.error('[POS Keyboard] Plus key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle - key
   * Triggers: Decrement selected item quantity
   */
  async handleMinusKey() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          if (!this.orderState || !this.selectedItemId) {
            reject(new Error('No item selected'));
            return;
          }

          const item = this.orderState.order.items.find(
            (i) => i.id === this.selectedItemId
          );

          if (!item) {
            reject(new Error('Item not found'));
            return;
          }

          const newQuantity = Math.max(1, item.quantity - 1);

          await this.orderState.updateItemQuantity(
            this.selectedItemId,
            newQuantity
          );

          log.info(`[POS Keyboard] Quantity decremented to ${newQuantity}`);

          resolve({ success: true, quantity: newQuantity });
        } catch (err) {
          log.error('[POS Keyboard] Minus key error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Handle Tab key
   * Triggers: Navigate to next/previous item
   */
  async handleTabKey(isShift = false) {
    return new Promise((resolve) => {
      this._queueRequest(async () => {
        try {
          if (!this.orderState || this.orderState.order.items.length === 0) {
            resolve({ success: false, error: 'No items in order' });
            return;
          }

          const items = this.orderState.order.items;
          let currentIndex = items.findIndex(
            (i) => i.id === this.selectedItemId
          );

          if (currentIndex === -1) {
            // No item selected, start from first/last
            this.selectedItemId = isShift ? items[items.length - 1].id : items[0].id;
          } else {
            // Move to next/previous
            if (isShift) {
              currentIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
            } else {
              currentIndex = currentIndex === items.length - 1 ? 0 : currentIndex + 1;
            }
            this.selectedItemId = items[currentIndex].id;
          }

          const selectedItem = items.find((i) => i.id === this.selectedItemId);

          log.info(
            `[POS Keyboard] Selected item: ${selectedItem?.name} (${selectedItem?.quantity}x)`
          );

          resolve({
            success: true,
            selectedItem,
            itemIndex: items.findIndex((i) => i.id === this.selectedItemId),
          });
        } catch (err) {
          log.error('[POS Keyboard] Tab key error:', err.message);
          resolve({ success: false, error: err.message });
        }
      });
    });
  }

  /**
   * Handle Submit order (e.g., F1 or custom mapping)
   */
  async handleSubmitOrder() {
    return new Promise((resolve, reject) => {
      this._queueRequest(async () => {
        try {
          if (!this.orderState) {
            reject(new Error('Order state not available'));
            return;
          }

          if (this.orderState.order.items.length === 0) {
            reject(new Error('Cannot submit empty order'));
            return;
          }

          log.info('[POS Keyboard] Submitting order via keyboard');

          const result = await this.orderState.submitOrder();

          log.info('[POS Keyboard] Order submitted:', result.confirmation_number);

          resolve({ success: true, confirmationNumber: result.confirmation_number });
        } catch (err) {
          log.error('[POS Keyboard] Submit order error:', err.message);
          reject(err);
        }
      });
    });
  }

  /**
   * Set selected item ID
   */
  setSelectedItemId(itemId) {
    this.selectedItemId = itemId;
    log.debug(`[POSKeyboardService] Selected item: ${itemId}`);
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.requestQueue.length,
      selectedItemId: this.selectedItemId,
      quantityInputBuffer: this.quantityInputBuffer,
      lastBarcode: this.lastBarcode,
    };
  }

  /**
   * Clear all state
   */
  clear() {
    this.selectedItemId = null;
    this.quantityInputBuffer = '';
    this.lastBarcode = '';
    if (this.quantityInputTimeout) {
      clearTimeout(this.quantityInputTimeout);
    }
    log.info('[POSKeyboardService] State cleared');
  }
}

export default POSKeyboardService;
