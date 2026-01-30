import { useState, useCallback, useRef, useEffect } from 'react';
import PaymentService from '../services/PaymentService';
import logger from 'electron-log';

/**
 * usePaymentFlow - Hook for managing POS payment operations
 * 
 * Features:
 * - Partial and full payment submission
 * - Backend balance tracking
 * - Double submission prevention
 * - Backend-confirmed payment status
 * - Error handling and recovery
 */
export function usePaymentFlow(apiClient, orderId) {
  // State management
  const [paymentState, setPaymentState] = useState({
    loading: false,
    submitting: false,
    error: null,
    success: null,
  });

  const [balance, setBalance] = useState({
    totalAmount: 0,
    totalPaid: 0,
    balanceRemaining: 0,
    status: 'unpaid', // 'unpaid', 'partial', 'paid'
  });

  const [paymentHistory, setPaymentHistory] = useState([]);
  const [lastPayment, setLastPayment] = useState(null);
  const [confirmedPaymentStatus, setConfirmedPaymentStatus] = useState(null);

  // Service reference
  const paymentServiceRef = useRef(null);

  // Initialize payment service
  useEffect(() => {
    if (!apiClient) {
      logger.warn('apiClient not available for PaymentService');
      return;
    }

    paymentServiceRef.current = new PaymentService(apiClient);

    return () => {
      paymentServiceRef.current?.clearCache();
    };
  }, [apiClient]);

  /**
   * Fetch payment balance from backend
   */
  const fetchBalance = useCallback(async (orderIdParam = orderId) => {
    if (!orderIdParam) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Order ID is required',
      }));
      return null;
    }

    setPaymentState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const balanceData = await paymentServiceRef.current.getPaymentBalance(orderIdParam);
      
      setBalance({
        totalAmount: balanceData.totalAmount || 0,
        totalPaid: balanceData.totalPaid || 0,
        balanceRemaining: balanceData.balanceRemaining || 0,
        status: balanceData.status || 'unpaid',
      });

      logger.info('Balance fetched:', balanceData);
      return balanceData;
    } catch (error) {
      const errorMsg = error.message || 'Failed to fetch payment balance';
      setPaymentState(prev => ({
        ...prev,
        error: errorMsg,
      }));
      logger.error('Balance fetch failed:', error);
      return null;
    } finally {
      setPaymentState(prev => ({
        ...prev,
        loading: false,
      }));
    }
  }, [orderId]);

  /**
   * Fetch payment history
   */
  const fetchPaymentHistory = useCallback(async (orderIdParam = orderId) => {
    if (!orderIdParam) return [];

    try {
      const history = await paymentServiceRef.current.getPaymentHistory(orderIdParam);
      setPaymentHistory(history);
      return history;
    } catch (error) {
      logger.error('Failed to fetch payment history:', error);
      return [];
    }
  }, [orderId]);

  /**
   * Submit partial payment
   */
  const submitPartialPayment = useCallback(async (amount, method) => {
    if (!orderId) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Order ID is required',
      }));
      return null;
    }

    if (!amount || amount <= 0) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Payment amount must be greater than zero',
      }));
      return null;
    }

    if (!method) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Payment method is required',
      }));
      return null;
    }

    setPaymentState(prev => ({
      ...prev,
      submitting: true,
      error: null,
      success: null,
    }));

    try {
      logger.info(`Submitting partial payment: $${amount} via ${method}`, { orderId });

      const response = await paymentServiceRef.current.submitPartialPayment(
        orderId,
        amount,
        method
      );

      // Update local state
      setLastPayment({
        id: response.paymentId,
        amount: response.amount,
        method: method,
        timestamp: new Date(),
        status: response.status,
      });

      // Confirm payment status with backend
      const confirmedStatus = await paymentServiceRef.current.confirmPaymentStatus(
        response.paymentId
      );

      setConfirmedPaymentStatus({
        paymentId: confirmedStatus.paymentId,
        status: confirmedStatus.status,
        confirmedAt: confirmedStatus.confirmedAt,
        balanceRemaining: confirmedStatus.balanceRemaining,
      });

      // Update balance
      await fetchBalance(orderId);
      await fetchPaymentHistory(orderId);

      setPaymentState(prev => ({
        ...prev,
        success: `Partial payment of $${amount} submitted successfully`,
      }));

      logger.info('Partial payment successful:', response);
      return response;
    } catch (error) {
      const errorMsg = error.message || 'Partial payment failed';
      setPaymentState(prev => ({
        ...prev,
        error: errorMsg,
      }));
      logger.error('Partial payment error:', error);
      return null;
    } finally {
      setPaymentState(prev => ({
        ...prev,
        submitting: false,
      }));
    }
  }, [orderId, fetchBalance, fetchPaymentHistory]);

  /**
   * Submit full payment
   */
  const submitFullPayment = useCallback(async (method) => {
    if (!orderId) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Order ID is required',
      }));
      return null;
    }

    if (!method) {
      setPaymentState(prev => ({
        ...prev,
        error: 'Payment method is required',
      }));
      return null;
    }

    setPaymentState(prev => ({
      ...prev,
      submitting: true,
      error: null,
      success: null,
    }));

    try {
      logger.info(`Submitting full payment via ${method}`, { orderId });

      const response = await paymentServiceRef.current.submitFullPayment(
        orderId,
        method
      );

      // Update local state
      setLastPayment({
        id: response.paymentId,
        amount: response.amount,
        method: method,
        timestamp: new Date(),
        status: response.status,
      });

      // Confirm payment status with backend
      const confirmedStatus = await paymentServiceRef.current.confirmPaymentStatus(
        response.paymentId
      );

      setConfirmedPaymentStatus({
        paymentId: confirmedStatus.paymentId,
        status: confirmedStatus.status,
        confirmedAt: confirmedStatus.confirmedAt,
        balanceRemaining: confirmedStatus.balanceRemaining,
      });

      // Update balance
      await fetchBalance(orderId);
      await fetchPaymentHistory(orderId);

      setPaymentState(prev => ({
        ...prev,
        success: `Full payment of $${response.amount} submitted successfully`,
      }));

      logger.info('Full payment successful:', response);
      return response;
    } catch (error) {
      const errorMsg = error.message || 'Full payment failed';
      setPaymentState(prev => ({
        ...prev,
        error: errorMsg,
      }));
      logger.error('Full payment error:', error);
      return null;
    } finally {
      setPaymentState(prev => ({
        ...prev,
        submitting: false,
      }));
    }
  }, [orderId, fetchBalance, fetchPaymentHistory]);

  /**
   * Check if order is fully paid
   */
  const checkIfPaid = useCallback(async (orderIdParam = orderId) => {
    if (!orderIdParam) return false;

    try {
      const isPaid = await paymentServiceRef.current.isOrderPaid(orderIdParam);
      return isPaid;
    } catch (error) {
      logger.error('Failed to check payment status:', error);
      return false;
    }
  }, [orderId]);

  /**
   * Confirm payment status (backend verification)
   */
  const confirmPaymentStatus = useCallback(async (paymentId) => {
    try {
      const status = await paymentServiceRef.current.confirmPaymentStatus(paymentId);
      setConfirmedPaymentStatus({
        paymentId: status.paymentId,
        status: status.status,
        confirmedAt: status.confirmedAt,
        balanceRemaining: status.balanceRemaining,
      });
      return status;
    } catch (error) {
      logger.error('Failed to confirm payment status:', error);
      throw error;
    }
  }, []);

  /**
   * Clear errors and success messages
   */
  const clearMessages = useCallback(() => {
    setPaymentState(prev => ({
      ...prev,
      error: null,
      success: null,
    }));
  }, []);

  /**
   * Reset payment state
   */
  const resetPaymentState = useCallback(() => {
    setPaymentState({
      loading: false,
      submitting: false,
      error: null,
      success: null,
    });
    setBalance({
      totalAmount: 0,
      totalPaid: 0,
      balanceRemaining: 0,
      status: 'unpaid',
    });
    setPaymentHistory([]);
    setLastPayment(null);
    setConfirmedPaymentStatus(null);
  }, []);

  return {
    // State
    paymentState,
    balance,
    paymentHistory,
    lastPayment,
    confirmedPaymentStatus,
    
    // Methods
    fetchBalance,
    fetchPaymentHistory,
    submitPartialPayment,
    submitFullPayment,
    checkIfPaid,
    confirmPaymentStatus,
    clearMessages,
    resetPaymentState,
  };
}
