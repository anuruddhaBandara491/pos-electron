import { useEffect, useRef } from 'react';
import log from '../utils/logger';

/**
 * Custom Hook: useKeyboardShortcuts
 * 
 * Generic keyboard event handler for mapping shortcuts to actions.
 * Prevents conflicts with input fields and text areas.
 * 
 * Features:
 * - Key combination support (Ctrl, Shift, Alt)
 * - Prevent default handling
 * - Disable in input fields
 * - Key repeat handling
 * - Global event listener
 * - Proper cleanup
 * 
 * Usage:
 * useKeyboardShortcuts({
 *   'Enter': handleEnter,
 *   'Escape': handleEscape,
 *   'F1': handleF1,
 *   'Ctrl+S': handleSave,
 *   'Shift+Delete': handleDelete
 * });
 */
function useKeyboardShortcuts(keyMap = {}, enabled = true) {
  const keyStatusRef = useRef(new Map());

  useEffect(() => {
    if (!enabled || Object.keys(keyMap).length === 0) {
      return;
    }

    /**
     * Check if event target is an input field
     */
    const isInputTarget = (target) => {
      const tagName = target.tagName?.toUpperCase();
      return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      );
    };

    /**
     * Format keyboard event to key string
     * Examples: "Enter", "Escape", "Ctrl+S", "Shift+Delete"
     */
    const getKeyString = (event) => {
      const parts = [];

      if (event.ctrlKey) parts.push('Ctrl');
      if (event.shiftKey) parts.push('Shift');
      if (event.altKey) parts.push('Alt');

      // Get the key name
      let key = event.key;

      // Normalize function keys
      if (event.key.startsWith('F') && /^F\d+$/.test(event.key)) {
        key = event.key;
      }
      // Map common keys
      else if (event.key === 'Enter') {
        key = 'Enter';
      } else if (event.key === 'Escape') {
        key = 'Escape';
      } else if (event.key === 'Tab') {
        key = 'Tab';
      } else if (event.key === ' ') {
        key = 'Space';
      } else if (event.key.length === 1) {
        key = event.key.toUpperCase();
      }

      parts.push(key);
      return parts.join('+');
    };

    /**
     * Handle keydown event
     */
    const handleKeyDown = (event) => {
      const keyString = getKeyString(event);

      // Check if this key is being repeated
      if (keyStatusRef.current.get(keyString)) {
        return; // Ignore repeat
      }

      // Mark key as pressed
      keyStatusRef.current.set(keyString, true);

      // Skip for input fields unless specifically allowed
      if (isInputTarget(event.target)) {
        // Some shortcuts should still work in inputs (like Escape)
        if (!['Escape'].includes(event.key)) {
          return;
        }
      }

      // Check if we have a handler for this key
      if (keyMap[keyString]) {
        log.debug(`[Keyboard] Shortcut triggered: ${keyString}`);
        
        // Prevent default browser behavior
        event.preventDefault();
        event.stopPropagation();

        // Call the handler
        try {
          keyMap[keyString](event);
        } catch (err) {
          log.error(`[Keyboard] Error in handler for ${keyString}:`, err);
        }
      }
    };

    /**
     * Handle keyup event
     */
    const handleKeyUp = (event) => {
      const keyString = getKeyString(event);
      keyStatusRef.current.delete(keyString);
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keyStatusRef.current.clear();
    };
  }, [keyMap, enabled]);
}

export default useKeyboardShortcuts;
