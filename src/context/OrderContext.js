import React, { createContext, useContext, useMemo, useCallback } from 'react';
import useOrderState from '../hooks/useOrderState';
import OrderAPI from '../api/OrderAPI';

/**
 * OrderContext
 * 
 * Provides order state management to the entire app.
 * 
 * Usage:
 * const { order, addItem, removeItem, ... } = useOrder();
 */
const OrderContext = createContext(null);

/**
 * OrderProvider Component
 * 
 * Wraps app with order state management.
 * 
 * Usage:
 * <OrderProvider authContext={authContext}>
 *   <App />
 * </OrderProvider>
 */
export function OrderProvider({ children, authContext }) {
  // Get token function from auth context
  const getToken = useCallback(() => {
    return authContext?.token || '';
  }, [authContext]);

  // Initialize Order API
  const orderAPI = useMemo(() => {
    // Check if apiManager is available (from main app)
    const api = new OrderAPI(null, getToken);
    return api;
  }, [getToken]);

  // Initialize order state hook
  const orderState = useOrderState(orderAPI);

  // Prepare context value
  const value = useMemo(
    () => ({
      // State
      order: orderState.order,

      // Methods
      addItem: orderState.addItem,
      removeItem: orderState.removeItem,
      updateItemQuantity: orderState.updateItemQuantity,
      reconcileWithBackend: orderState.reconcileWithBackend,
      submitOrder: orderState.submitOrder,
      clearOrder: orderState.clearOrder,

      // Utilities
      getOrderSummary: orderState.getOrderSummary,
      setOrderId: (orderId) => orderAPI.setOrderId(orderId),
    }),
    [orderState, orderAPI]
  );

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
}

/**
 * Hook: useOrder
 * 
 * Access order state and methods from anywhere in the app.
 * 
 * Usage:
 * const { order, addItem, removeItem } = useOrder();
 * 
 * If context is not found, returns null (safe for optional usage)
 */
export function useOrder() {
  const context = useContext(OrderContext);

  if (!context) {
    console.warn(
      '[useOrder] Hook called outside OrderProvider. Order state unavailable.'
    );
    return null;
  }

  return context;
}

export default OrderContext;
