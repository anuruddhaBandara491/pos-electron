import React, { useState, useCallback, useContext } from 'react';
import log from '../utils/logger';
import useBarcodeScan from '../hooks/useBarcodeScan';
import AuthContext from '../context/AuthContext';
import '../styles/BarcodeSearch.css';

/**
 * BarcodeSearch Component
 * 
 * Captures barcode input via keyboard and searches backend for matching product.
 * 
 * Features:
 * - Real-time barcode capture from keyboard
 * - Instant backend search (optimized for speed)
 * - Visual feedback during search
 * - Product not found handling
 * - Displays minimal product data (ID, name, price, barcode)
 * - Auto-clear after successful scan
 * - Errors with user-friendly messages
 * 
 * Performance Optimizations:
 * - Debounces backend calls (only on complete barcode)
 * - Request timeout: 3 seconds
 * - Caches last search to prevent duplicate calls
 * - No polling or continuous requests
 * 
 * Props:
 * - onProductFound(product) - Called when product found
 * - onProductNotFound(barcode) - Called when no product matches barcode
 * - enabled - Enable/disable scanning
 * - autoFocus - Focus input field on mount
 */
function BarcodeSearch({
  onProductFound,
  onProductNotFound,
  enabled = true,
  autoFocus = true,
}) {
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastProduct, setLastProduct] = useState(null);
  const [lastBarcode, setLastBarcode] = useState('');
  const { authContext } = useContext(AuthContext) || {};

  /**
   * Search backend for product by barcode
   * Optimized for speed:
   * - Single GET request
   * - Timeout: 3 seconds
   * - Minimal response (only needed fields)
   */
  const searchProductByBarcode = useCallback(
    async (barcode) => {
      // Prevent duplicate searches
      if (barcode === lastBarcode && lastProduct) {
        if (onProductFound) {
          onProductFound(lastProduct);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setLastBarcode(barcode);

        log.info(`[BarcodeSearch] Searching for barcode: ${barcode}`);

        // Call backend API with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(
          `/api/v1/products/search/barcode?barcode=${encodeURIComponent(barcode)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authContext?.token}`, // Use token from context if available
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404) {
            // Product not found
            log.warn(`[BarcodeSearch] No product found for barcode: ${barcode}`);
            setLastProduct(null);
            setError(`No product found for barcode: ${barcode}`);
            if (onProductNotFound) {
              onProductNotFound(barcode);
            }
            return;
          }

          // Other error
          throw new Error(`Server error: ${response.status}`);
        }

        // Parse response - expect minimal data
        const data = await response.json();
        const product = data.data || data;

        log.info(`[BarcodeSearch] Found product:`, {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price,
        });

        setLastProduct(product);
        setError(null);

        // Callback to parent
        if (onProductFound) {
          onProductFound(product);
        }
      } catch (err) {
        const errorMessage = err.name === 'AbortError'
          ? 'Search timeout - server not responding'
          : err.message || 'Failed to search product';

        log.error(`[BarcodeSearch] Error:`, errorMessage);
        setError(errorMessage);
        setLastProduct(null);

        if (onProductNotFound) {
          onProductNotFound(barcode);
        }
      } finally {
        setLoading(false);
      }
    },
    [lastBarcode, lastProduct, onProductFound, onProductNotFound, authContext]
  );

  /**
   * Handle barcode scanned - trigger search
   */
  const handleBarcodeScanned = useCallback(
    (barcode) => {
      log.debug(`[BarcodeSearch] Barcode scanned: ${barcode}`);
      searchProductByBarcode(barcode);
    },
    [searchProductByBarcode]
  );

  /**
   * Use barcode hook for keyboard input capture
   */
  const { barcode, isScanning, clearBuffer } = useBarcodeScan(
    handleBarcodeScanned,
    {
      enabled: enabled,
      timeoutMs: 250,
      autoReset: true,
      filterChars: /[0-9\-]/,
    }
  );

  /**
   * Clear search results
   */
  const handleClear = () => {
    clearBuffer();
    setLastProduct(null);
    setError(null);
    setLastBarcode('');
  };

  return (
    <div className="barcode-search">
      {/* Input Buffer Display */}
      <div className={`barcode-input-buffer ${isScanning ? 'scanning' : ''} ${error ? 'error' : ''}`}>
        <span className="barcode-label">Barcode:</span>
        <span className="barcode-value">
          {barcode || <span className="placeholder">Scan a product...</span>}
        </span>
        {isScanning && <span className="scanning-indicator">●</span>}
      </div>

      {/* Search Status */}
      {loading && (
        <div className="barcode-status loading">
          <span className="spinner">⟳</span> Searching...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="barcode-status error">
          <span className="icon">⚠</span> {error}
        </div>
      )}

      {/* Product Found Display */}
      {lastProduct && !error && (
        <div className="barcode-product-result">
          <div className="product-header">
            <h3>{lastProduct.name}</h3>
            <span className="product-id">#{lastProduct.id}</span>
          </div>
          <div className="product-details">
            <div className="detail-row">
              <span className="label">SKU:</span>
              <span className="value">{lastProduct.sku || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Barcode:</span>
              <span className="value">{lastProduct.barcode}</span>
            </div>
            <div className="detail-row highlight">
              <span className="label">Price:</span>
              <span className="value price">${(lastProduct.price || 0).toFixed(2)}</span>
            </div>
            {lastProduct.stock !== undefined && (
              <div className="detail-row">
                <span className="label">Stock:</span>
                <span className={`value ${lastProduct.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                  {lastProduct.stock > 0 ? `${lastProduct.stock} units` : 'Out of stock'}
                </span>
              </div>
            )}
          </div>
          <button className="btn-clear" onClick={handleClear}>
            Clear & Scan Again
          </button>
        </div>
      )}

      {/* No results state */}
      {!loading && !error && !lastProduct && barcode && (
        <div className="barcode-status empty">
          <span className="icon">○</span> Waiting for Enter or complete barcode...
        </div>
      )}
    </div>
  );
}

export default BarcodeSearch;
