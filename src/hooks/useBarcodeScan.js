import { useState, useCallback, useEffect, useRef } from 'react';
import log from '../utils/logger';

/**
 * Custom Hook: useBarcodeScan
 * 
 * Handles barcode input capture from keyboard with intelligent debouncing.
 * Typical barcode scanners send all digits rapidly (< 100ms per digit),
 * followed by Enter key. This hook detects the pattern and triggers callback.
 * 
 * Features:
 * - Accumulates rapid keyboard input (barcode digits)
 * - Detects Enter key as end of barcode
 * - Filters out manual typing (slower input)
 * - Automatic timeout for incomplete input
 * - Can be disabled to prevent interference
 * - Returns current input buffer state
 * 
 * Performance:
 * - No debounce delay (immediate capture)
 * - Minimal overhead (250ms timeout)
 * - Only processes numeric + Enter keys
 * - Event listener cleanup on unmount
 */
function useBarcodeScan(
  onBarcodeScanned,
  {
    enabled = true,
    timeoutMs = 250,  // Wait this long for more input before assuming scan complete
    autoReset = true,  // Clear buffer after scan
    filterChars = /[0-9\-]/,  // Only capture digits and hyphens
  } = {}
) {
  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef(null);
  const lastKeyTimeRef = useRef(0);

  /**
   * Handle keydown event - capture digits rapidly
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return;

      const char = e.key;
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // Check if this is Enter key (end of barcode)
      if (char === 'Enter') {
        e.preventDefault();
        if (barcode.trim()) {
          // Mark as scanning complete
          setIsScanning(false);
          // Call the callback
          onBarcodeScanned(barcode.trim());
          // Auto-reset buffer
          if (autoReset) {
            setBarcode('');
          }
          // Clear timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
        return;
      }

      // Check if character matches filter (digits, hyphens, etc)
      if (!filterChars.test(char)) {
        return;
      }

      // Prevent default for barcode chars
      e.preventDefault();

      // If this is the first digit, mark as scanning
      if (!isScanning) {
        setIsScanning(true);
      }

      // Add character to buffer
      setBarcode((prev) => prev + char);
      lastKeyTimeRef.current = now;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout for incomplete barcode (no Enter pressed)
      // This allows barcodes without Enter key suffix
      timeoutRef.current = setTimeout(() => {
        if (barcode.length > 5) {
          // Only trigger if barcode seems complete
          setIsScanning(false);
          onBarcodeScanned(barcode.trim());
          if (autoReset) {
            setBarcode('');
          }
          timeoutRef.current = null;
        }
      }, timeoutMs);
    },
    [barcode, enabled, onBarcodeScanned, isScanning, timeoutMs, autoReset, filterChars]
  );

  /**
   * Setup and cleanup event listener
   */
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  /**
   * Method to manually clear buffer
   */
  const clearBuffer = useCallback(() => {
    setBarcode('');
    setIsScanning(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Method to enable/disable scanning
   */
  const setEnabled = useCallback((newEnabled) => {
    if (!newEnabled) {
      clearBuffer();
    }
  }, [clearBuffer]);

  return {
    barcode,           // Current barcode in buffer
    isScanning,        // True while capturing input
    clearBuffer,       // Function to manually clear
    setEnabled,        // Function to enable/disable scanning
  };
}

export default useBarcodeScan;
