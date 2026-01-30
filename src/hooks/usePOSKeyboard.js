import { useCallback } from 'react';
import log from '../utils/logger';
import useKeyboardShortcuts from './useKeyboardShortcuts';

/**
 * Custom Hook: usePOSKeyboard
 * 
 * Maps POS keyboard shortcuts to backend operations.
 * Designed for fast checkout flow without mouse dependency.
 * 
 * Keyboard Shortcuts:
 * - Enter: Scan barcode / Submit order
 * - Escape: Cancel / Clear order
 * - F1: Help / Documentation
 * - F2: Print receipt / Reprint last order
 * - F3: Discount / Special pricing
 * - F4: Refund / Return
 * - F5: Customer lookup
 * - F6: Payment methods
 * - F7: Quick report
 * - F8: Settings
 * - F9: Previous order
 * - F10: Next order
 * - Ctrl+P: Print
 * - Ctrl+Z: Undo last item
 * - Ctrl+Delete: Clear entire order
 * - Delete: Remove selected item
 * - Tab: Next field / Item
 * - Shift+Tab: Previous field / Item
 * - +: Increment quantity
 * - -: Decrement quantity
 * - 0-9: Quantity quick input
 * 
 * Features:
 * - Backend API triggering
 * - Fast checkout flow
 * - No mouse dependency
 * - Safe error handling
 * - Feedback on actions
 * - Logging for audit trail
 */
function usePOSKeyboard(options = {}) {
  const {
    enabled = true,
    onEnter = null,
    onEscape = null,
    onF1 = null,
    onF2 = null,
    onF3 = null,
    onF4 = null,
    onF5 = null,
    onF6 = null,
    onF7 = null,
    onF8 = null,
    onDelete = null,
    onCtrlZ = null,
    onCtrlDelete = null,
    onPlus = null,
    onMinus = null,
    onTab = null,
    onQuantityInput = null,
    onOrderComplete = null,
  } = options;

  /**
   * Safe callback wrapper
   */
  const safeCall = useCallback(
    async (callback, keyName, event) => {
      if (!callback) {
        log.debug(`[POS Keyboard] No handler for ${keyName}`);
        return;
      }

      try {
        log.info(`[POS Keyboard] Executing: ${keyName}`);
        await callback(event);
      } catch (err) {
        log.error(`[POS Keyboard] Error for ${keyName}:`, err.message);
        throw err;
      }
    },
    []
  );

  /**
   * Handle Enter key
   * Used for: Scanning barcode, confirming action
   */
  const handleEnter = useCallback(
    async (event) => {
      try {
        await safeCall(onEnter, 'Enter', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Enter action failed: ${err.message}`);
      }
    },
    [onEnter, safeCall]
  );

  /**
   * Handle Escape key
   * Used for: Clearing order, canceling action
   */
  const handleEscape = useCallback(
    async (event) => {
      try {
        log.info(`[POS Keyboard] Escape pressed - canceling action`);
        await safeCall(onEscape, 'Escape', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Escape action failed: ${err.message}`);
      }
    },
    [onEscape, safeCall]
  );

  /**
   * Handle Delete key
   * Used for: Removing selected item from order
   */
  const handleDelete = useCallback(
    async (event) => {
      try {
        await safeCall(onDelete, 'Delete', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Delete action failed: ${err.message}`);
      }
    },
    [onDelete, safeCall]
  );

  /**
   * Handle Ctrl+Z (Undo)
   * Used for: Removing last added item
   */
  const handleCtrlZ = useCallback(
    async (event) => {
      try {
        log.info(`[POS Keyboard] Undo - removing last item`);
        await safeCall(onCtrlZ, 'Ctrl+Z', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Undo action failed: ${err.message}`);
      }
    },
    [onCtrlZ, safeCall]
  );

  /**
   * Handle Ctrl+Delete
   * Used for: Clearing entire order
   */
  const handleCtrlDelete = useCallback(
    async (event) => {
      try {
        log.info(`[POS Keyboard] Ctrl+Delete - clearing entire order`);
        await safeCall(onCtrlDelete, 'Ctrl+Delete', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Clear order failed: ${err.message}`);
      }
    },
    [onCtrlDelete, safeCall]
  );

  /**
   * Handle numeric keys (0-9)
   * Used for: Quick quantity input
   */
  const handleNumericKey = useCallback(
    (digit) =>
      async (event) => {
        try {
          await safeCall(onQuantityInput, `Digit_${digit}`, event);
        } catch (err) {
          log.warn(`[POS Keyboard] Quantity input failed: ${err.message}`);
        }
      },
    [onQuantityInput, safeCall]
  );

  /**
   * Handle + key (increment quantity)
   */
  const handlePlus = useCallback(
    async (event) => {
      try {
        await safeCall(onPlus, 'Plus', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Increment failed: ${err.message}`);
      }
    },
    [onPlus, safeCall]
  );

  /**
   * Handle - key (decrement quantity)
   */
  const handleMinus = useCallback(
    async (event) => {
      try {
        await safeCall(onMinus, 'Minus', event);
      } catch (err) {
        log.warn(`[POS Keyboard] Decrement failed: ${err.message}`);
      }
    },
    [onMinus, safeCall]
  );

  /**
   * Handle Tab key (navigate between items)
   */
  const handleTab = useCallback(
    async (event) => {
      try {
        const isShiftTab = event.shiftKey;
        await safeCall(
          onTab,
          isShiftTab ? 'Shift+Tab' : 'Tab',
          event
        );
      } catch (err) {
        log.warn(`[POS Keyboard] Tab navigation failed: ${err.message}`);
      }
    },
    [onTab, safeCall]
  );

  /**
   * Handle F keys
   */
  const handleFKey = useCallback(
    async (fNum, callback, name) => {
      return async (event) => {
        try {
          await safeCall(callback, name, event);
        } catch (err) {
          log.warn(`[POS Keyboard] ${name} action failed: ${err.message}`);
        }
      };
    },
    [safeCall]
  );

  // Build keyboard map
  const keyMap = {};

  // Standard keys
  if (onEnter) keyMap['Enter'] = handleEnter;
  if (onEscape) keyMap['Escape'] = handleEscape;
  if (onDelete) keyMap['Delete'] = handleDelete;
  if (onCtrlZ) keyMap['Ctrl+Z'] = handleCtrlZ;
  if (onCtrlDelete) keyMap['Ctrl+Delete'] = handleCtrlDelete;
  if (onPlus) keyMap['+'] = handlePlus;
  if (onMinus) keyMap['-'] = handleMinus;
  if (onTab) keyMap['Tab'] = handleTab;
  if (onTab) keyMap['Shift+Tab'] = handleTab;

  // Numeric keys for quantity input
  for (let i = 0; i <= 9; i++) {
    if (onQuantityInput) {
      keyMap[i.toString()] = handleNumericKey(i);
    }
  }

  // F keys
  if (onF1) keyMap['F1'] = handleFKey(1, onF1, 'F1');
  if (onF2) keyMap['F2'] = handleFKey(2, onF2, 'F2');
  if (onF3) keyMap['F3'] = handleFKey(3, onF3, 'F3');
  if (onF4) keyMap['F4'] = handleFKey(4, onF4, 'F4');
  if (onF5) keyMap['F5'] = handleFKey(5, onF5, 'F5');
  if (onF6) keyMap['F6'] = handleFKey(6, onF6, 'F6');
  if (onF7) keyMap['F7'] = handleFKey(7, onF7, 'F7');
  if (onF8) keyMap['F8'] = handleFKey(8, onF8, 'F8');

  // Register keyboard shortcuts
  useKeyboardShortcuts(keyMap, enabled);

  // Return utility functions
  return {
    isKeyboardEnabled: enabled,
    getKeyMap: () => Object.keys(keyMap),
    logKeyboardState: () => {
      log.info('[POS Keyboard] Active shortcuts:', Object.keys(keyMap));
    },
  };
}

export default usePOSKeyboard;
