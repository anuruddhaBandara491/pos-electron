/**
 * useReceiptFlow.js
 * React hook for receipt management and printing workflow
 * 
 * Manages:
 * - Fetching receipts from backend
 * - Tracking print status and failures
 * - Language selection and translation
 * - Reprint functionality
 * - Error handling and retry logic
 */

import { useState, useCallback, useRef } from 'react';

export function useReceiptFlow(receiptService, orderId) {
  const receiptServiceRef = useRef(receiptService);

  // Receipt data state
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(null);

  // Print state
  const [printState, setPrintState] = useState({
    printing: false,
    status: null, // 'pending', 'success', 'failed'
    error: null,
    printJobId: null,
    lastPrintTime: null,
    attemptCount: 0
  });

  // Language state
  const [language, setLanguage] = useState('en');
  const [supportedLanguages] = useState(['en', 'es', 'fr', 'de', 'zh', 'ja']);

  // Receipt history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /**
   * Fetch receipt from backend
   */
  const fetchReceipt = useCallback(async (lang = language) => {
    try {
      setReceiptLoading(true);
      setReceiptError(null);

      const fetchedReceipt = await receiptServiceRef.current.fetchReceipt(
        orderId,
        lang
      );

      setReceipt(fetchedReceipt);
      return fetchedReceipt;

    } catch (error) {
      const errorMsg = error.message || 'Failed to fetch receipt';
      setReceiptError(errorMsg);
      console.error('[FETCH_RECEIPT_ERROR]', error);
      throw error;
    } finally {
      setReceiptLoading(false);
    }
  }, [orderId, language]);

  /**
   * Print receipt
   */
  const printReceipt = useCallback(async (receiptToPrint = receipt, lang = language) => {
    try {
      if (!receiptToPrint) {
        throw new Error('No receipt data available');
      }

      setPrintState(prev => ({
        ...prev,
        printing: true,
        status: 'pending',
        error: null,
        attemptCount: prev.attemptCount + 1
      }));

      const result = await receiptServiceRef.current.printReceipt(
        receiptToPrint,
        lang
      );

      setPrintState(prev => ({
        ...prev,
        printing: false,
        status: 'success',
        printJobId: result.printJobId,
        lastPrintTime: new Date().toISOString(),
        error: null
      }));

      return result;

    } catch (error) {
      const errorMsg = error.message || 'Failed to print receipt';
      setPrintState(prev => ({
        ...prev,
        printing: false,
        status: 'failed',
        error: errorMsg,
        printJobId: error.printJobId || null
      }));

      console.error('[PRINT_ERROR]', error);
      throw error;
    }
  }, [receipt, language]);

  /**
   * Reprint receipt
   */
  const reprintReceipt = useCallback(async (receiptId, lang = language) => {
    try {
      setPrintState(prev => ({
        ...prev,
        printing: true,
        status: 'pending',
        error: null
      }));

      const result = await receiptServiceRef.current.reprintReceipt(
        receiptId,
        lang
      );

      setPrintState(prev => ({
        ...prev,
        printing: false,
        status: 'success',
        printJobId: result.printJobId,
        lastPrintTime: new Date().toISOString(),
        error: null
      }));

      return result;

    } catch (error) {
      const errorMsg = error.message || 'Failed to reprint receipt';
      setPrintState(prev => ({
        ...prev,
        printing: false,
        status: 'failed',
        error: errorMsg
      }));

      console.error('[REPRINT_ERROR]', error);
      throw error;
    }
  }, [language]);

  /**
   * Retry failed print
   */
  const retryPrint = useCallback(async () => {
    if (!receipt) {
      throw new Error('No receipt available to retry');
    }

    return printReceipt(receipt, language);
  }, [receipt, language, printReceipt]);

  /**
   * Fetch receipt history
   */
  const fetchHistory = useCallback(async (limit = 10) => {
    try {
      setHistoryLoading(true);

      const historyData = await receiptServiceRef.current.getReceiptHistory(
        orderId,
        limit
      );

      setHistory(historyData);
      return historyData;

    } catch (error) {
      console.error('[HISTORY_ERROR]', error);
      setHistory([]);
      throw error;
    } finally {
      setHistoryLoading(false);
    }
  }, [orderId]);

  /**
   * Change language
   */
  const changeLanguage = useCallback((lang) => {
    if (supportedLanguages.includes(lang)) {
      setLanguage(lang);
      return true;
    }
    return false;
  }, [supportedLanguages]);

  /**
   * Clear print error
   */
  const clearError = useCallback(() => {
    setPrintState(prev => ({
      ...prev,
      error: null
    }));
    setReceiptError(null);
  }, []);

  /**
   * Reset print state
   */
  const resetPrintState = useCallback(() => {
    setPrintState({
      printing: false,
      status: null,
      error: null,
      printJobId: null,
      lastPrintTime: null,
      attemptCount: 0
    });
  }, []);

  /**
   * Get print status message
   */
  const getPrintStatusMessage = useCallback(() => {
    switch (printState.status) {
      case 'success':
        return 'Receipt printed successfully';
      case 'failed':
        return `Print failed: ${printState.error || 'Unknown error'}`;
      case 'pending':
        return 'Printing...';
      default:
        return null;
    }
  }, [printState.status, printState.error]);

  /**
   * Get language display name
   */
  const getLanguageName = useCallback((lang) => {
    const names = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      zh: '中文',
      ja: '日本語'
    };
    return names[lang] || lang;
  }, []);

  return {
    // Receipt data
    receipt,
    receiptLoading,
    receiptError,
    receiptAvailable: !!receipt,

    // Print state
    printState,
    isPrinting: printState.printing,
    printStatus: printState.status,
    printError: printState.error,
    lastPrintTime: printState.lastPrintTime,
    printAttempts: printState.attemptCount,

    // History
    history,
    historyLoading,

    // Language
    language,
    supportedLanguages,

    // Methods
    fetchReceipt,
    printReceipt,
    reprintReceipt,
    retryPrint,
    fetchHistory,
    changeLanguage,
    clearError,
    resetPrintState,
    getPrintStatusMessage,
    getLanguageName
  };
}
