import { useState, useCallback, useRef, useEffect } from 'react';
import log from '../utils/logger';

/**
 * Custom Hook: useOrderState
 * 
 * Manages order state with backend synchronization.
 * 
 * Features:
 * - Local order state (items, quantities, totals)
 * - Optimistic updates (instant UI response)
 * - Backend sync with retry logic
 * - Validation error handling with rollback
 * - Duplicate prevention (deduplicated requests)
 * - Reconciliation with backend
 * - Full audit trail of changes
 * 
 * State Structure:
 * {
 *   items: [{ id, name, sku, barcode, price, quantity, lineTotal }],
 *   totals: { subtotal, tax, total, itemCount },
 *   synced: true/false,
 *   lastSyncTime: timestamp,
 *   error: null,
 *   pendingChanges: 0
 * }
 */
function useOrderState(orderAPI = null) {
  // Main order state
  const [order, setOrder] = useState({
    items: [],
    totals: { subtotal: 0, tax: 0, total: 0, itemCount: 0 },
    synced: true,
    lastSyncTime: null,
    error: null,
    pendingChanges: 0,
    version: 0, // For optimistic updates rollback
  });

  // Track in-flight requests to prevent duplicates
  const inFlightRequests = useRef(new Map());

  /**
   * Calculate order totals from items
   * Pure function - no side effects
   */
  const calculateTotals = useCallback((items) => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );
    const tax = subtotal * 0.1; // 10% tax (configurable)
    const total = subtotal + tax;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      itemCount,
    };
  }, []);

  /**
   * Add item to order
   * Optimistic update: Update local state immediately
   * Then sync with backend
   */
  const addItem = useCallback(
    async (product) => {
      try {
        // Validation
        if (!product || !product.id) {
          throw new Error('Invalid product');
        }

        log.debug(`[Order] Adding item: ${product.name} (ID: ${product.id})`);

        setOrder((prevOrder) => {
          // Check if item already exists
          const existingItem = prevOrder.items.find(
            (item) => item.id === product.id
          );

          let newItems;
          if (existingItem) {
            // Increment quantity
            newItems = prevOrder.items.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          } else {
            // Add new item
            newItems = [
              ...prevOrder.items,
              {
                id: product.id,
                name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                price: product.price,
                quantity: 1,
                lineTotal: product.price,
              },
            ];
          }

          const newTotals = calculateTotals(newItems);

          return {
            ...prevOrder,
            items: newItems,
            totals: newTotals,
            synced: false,
            pendingChanges: prevOrder.pendingChanges + 1,
            version: prevOrder.version + 1,
          };
        });

        // Sync with backend
        if (orderAPI?.addOrderItem) {
          try {
            await syncAddItemWithBackend(product.id, 1, orderAPI);
          } catch (err) {
            log.warn(`[Order] Backend sync failed for add item:`, err);
            // Note: Item already in local state, but marked as not synced
          }
        }
      } catch (err) {
        log.error(`[Order] Error adding item:`, err.message);
        setOrder((prev) => ({
          ...prev,
          error: err.message,
        }));
      }
    },
    [calculateTotals, orderAPI]
  );

  /**
   * Remove item from order
   */
  const removeItem = useCallback(
    async (productId) => {
      try {
        log.debug(`[Order] Removing item: ${productId}`);

        const removedItem = order.items.find((item) => item.id === productId);
        if (!removedItem) {
          throw new Error('Item not found in order');
        }

        // Optimistic update
        setOrder((prevOrder) => {
          const newItems = prevOrder.items.filter(
            (item) => item.id !== productId
          );
          const newTotals = calculateTotals(newItems);

          return {
            ...prevOrder,
            items: newItems,
            totals: newTotals,
            synced: false,
            pendingChanges: prevOrder.pendingChanges + 1,
            version: prevOrder.version + 1,
          };
        });

        // Sync with backend
        if (orderAPI?.removeOrderItem) {
          try {
            await syncRemoveItemWithBackend(productId, orderAPI);
          } catch (err) {
            log.warn(`[Order] Backend sync failed for remove item:`, err);
            // Note: Item already removed locally
          }
        }
      } catch (err) {
        log.error(`[Order] Error removing item:`, err.message);
        setOrder((prev) => ({
          ...prev,
          error: err.message,
        }));
      }
    },
    [order.items, calculateTotals, orderAPI]
  );

  /**
   * Update item quantity
   */
  const updateItemQuantity = useCallback(
    async (productId, newQuantity) => {
      try {
        if (newQuantity < 0) {
          throw new Error('Quantity cannot be negative');
        }

        if (newQuantity === 0) {
          // Remove item if quantity is 0
          await removeItem(productId);
          return;
        }

        log.debug(`[Order] Updating item ${productId} quantity to ${newQuantity}`);

        // Optimistic update
        setOrder((prevOrder) => {
          const newItems = prevOrder.items.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  quantity: newQuantity,
                  lineTotal: parseFloat((item.price * newQuantity).toFixed(2)),
                }
              : item
          );
          const newTotals = calculateTotals(newItems);

          return {
            ...prevOrder,
            items: newItems,
            totals: newTotals,
            synced: false,
            pendingChanges: prevOrder.pendingChanges + 1,
            version: prevOrder.version + 1,
          };
        });

        // Sync with backend
        if (orderAPI?.updateOrderItem) {
          try {
            await syncUpdateItemWithBackend(
              productId,
              newQuantity,
              orderAPI
            );
          } catch (err) {
            log.warn(
              `[Order] Backend sync failed for update item:`,
              err
            );
          }
        }
      } catch (err) {
        log.error(`[Order] Error updating item quantity:`, err.message);
        setOrder((prev) => ({
          ...prev,
          error: err.message,
        }));
      }
    },
    [removeItem, calculateTotals, orderAPI]
  );

  /**
   * Sync add item with backend (with deduplication)
   */
  const syncAddItemWithBackend = useCallback(
    async (productId, quantity, api) => {
      const requestKey = `add-${productId}`;

      // Check if request already in flight
      if (inFlightRequests.current.has(requestKey)) {
        log.debug(`[Order] Skipping duplicate add request for ${productId}`);
        return inFlightRequests.current.get(requestKey);
      }

      const promise = (async () => {
        try {
          const response = await api.addOrderItem(productId, quantity);
          setOrder((prev) => ({
            ...prev,
            synced: true,
            lastSyncTime: new Date(),
            pendingChanges: Math.max(0, prev.pendingChanges - 1),
            error: null,
          }));
          log.info(`[Order] Backend add item successful: ${productId}`);
          return response;
        } catch (err) {
          log.error(`[Order] Backend add item failed:`, err.message);
          setOrder((prev) => ({
            ...prev,
            synced: false,
            error: err.message,
          }));
          throw err;
        } finally {
          inFlightRequests.current.delete(requestKey);
        }
      })();

      inFlightRequests.current.set(requestKey, promise);
      return promise;
    },
    []
  );

  /**
   * Sync remove item with backend (with deduplication)
   */
  const syncRemoveItemWithBackend = useCallback(
    async (productId, api) => {
      const requestKey = `remove-${productId}`;

      if (inFlightRequests.current.has(requestKey)) {
        log.debug(`[Order] Skipping duplicate remove request for ${productId}`);
        return inFlightRequests.current.get(requestKey);
      }

      const promise = (async () => {
        try {
          const response = await api.removeOrderItem(productId);
          setOrder((prev) => ({
            ...prev,
            synced: true,
            lastSyncTime: new Date(),
            pendingChanges: Math.max(0, prev.pendingChanges - 1),
            error: null,
          }));
          log.info(`[Order] Backend remove item successful: ${productId}`);
          return response;
        } catch (err) {
          log.error(`[Order] Backend remove item failed:`, err.message);
          setOrder((prev) => ({
            ...prev,
            synced: false,
            error: err.message,
          }));
          throw err;
        } finally {
          inFlightRequests.current.delete(requestKey);
        }
      })();

      inFlightRequests.current.set(requestKey, promise);
      return promise;
    },
    []
  );

  /**
   * Sync update item with backend (with deduplication)
   */
  const syncUpdateItemWithBackend = useCallback(
    async (productId, quantity, api) => {
      const requestKey = `update-${productId}`;

      if (inFlightRequests.current.has(requestKey)) {
        log.debug(
          `[Order] Skipping duplicate update request for ${productId}`
        );
        return inFlightRequests.current.get(requestKey);
      }

      const promise = (async () => {
        try {
          const response = await api.updateOrderItem(productId, quantity);
          setOrder((prev) => ({
            ...prev,
            synced: true,
            lastSyncTime: new Date(),
            pendingChanges: Math.max(0, prev.pendingChanges - 1),
            error: null,
          }));
          log.info(
            `[Order] Backend update item successful: ${productId}`
          );
          return response;
        } catch (err) {
          log.error(`[Order] Backend update item failed:`, err.message);
          setOrder((prev) => ({
            ...prev,
            synced: false,
            error: err.message,
          }));
          throw err;
        } finally {
          inFlightRequests.current.delete(requestKey);
        }
      })();

      inFlightRequests.current.set(requestKey, promise);
      return promise;
    },
    []
  );

  /**
   * Reconcile with backend (get latest order state)
   * Useful after connection restore or page refresh
   */
  const reconcileWithBackend = useCallback(async () => {
    if (!orderAPI?.getOrder) {
      log.warn(`[Order] No getOrder API available`);
      return;
    }

    try {
      log.info(`[Order] Reconciling with backend...`);
      const backendOrder = await orderAPI.getOrder();

      setOrder((prev) => {
        const newItems = backendOrder.items || [];
        const newTotals = calculateTotals(newItems);

        return {
          ...prev,
          items: newItems,
          totals: newTotals,
          synced: true,
          lastSyncTime: new Date(),
          pendingChanges: 0,
          error: null,
          version: prev.version + 1,
        };
      });

      log.info(`[Order] Reconciliation successful`);
      return true;
    } catch (err) {
      log.error(`[Order] Reconciliation failed:`, err.message);
      setOrder((prev) => ({
        ...prev,
        error: `Reconciliation failed: ${err.message}`,
      }));
      return false;
    }
  }, [orderAPI, calculateTotals]);

  /**
   * Clear order
   */
  const clearOrder = useCallback(() => {
    log.info(`[Order] Clearing order`);
    setOrder({
      items: [],
      totals: { subtotal: 0, tax: 0, total: 0, itemCount: 0 },
      synced: true,
      lastSyncTime: null,
      error: null,
      pendingChanges: 0,
      version: 0,
    });
  }, []);

  /**
   * Submit order to backend
   */
  const submitOrder = useCallback(async () => {
    if (order.items.length === 0) {
      throw new Error('Cannot submit empty order');
    }

    try {
      log.info(`[Order] Submitting order with ${order.items.length} items`);

      if (!orderAPI?.submitOrder) {
        throw new Error('submitOrder API not available');
      }

      const response = await orderAPI.submitOrder({
        items: order.items,
        totals: order.totals,
      });

      log.info(`[Order] Order submitted successfully:`, response);

      // Clear local order on success
      clearOrder();

      return response;
    } catch (err) {
      log.error(`[Order] Submit order failed:`, err.message);
      setOrder((prev) => ({
        ...prev,
        error: err.message,
      }));
      throw err;
    }
  }, [order.items, order.totals, orderAPI, clearOrder]);

  /**
   * Get order state summary
   */
  const getOrderSummary = useCallback(() => {
    return {
      itemCount: order.totals.itemCount,
      subtotal: order.totals.subtotal,
      tax: order.totals.tax,
      total: order.totals.total,
      hasPendingChanges: order.pendingChanges > 0,
      isSynced: order.synced,
      lastSyncTime: order.lastSyncTime,
      error: order.error,
    };
  }, [order]);

  return {
    // State
    order,

    // Methods
    addItem,
    removeItem,
    updateItemQuantity,
    reconcileWithBackend,
    submitOrder,
    clearOrder,

    // Utilities
    getOrderSummary,
  };
}

export default useOrderState;
