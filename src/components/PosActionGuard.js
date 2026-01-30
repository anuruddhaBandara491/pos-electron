import React, { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import '../styles/PosActionGuard.css';

/**
 * POS Action Guard Component
 * Blocks or disables POS operations when backend is offline
 * 
 * Usage:
 * - Wrap around buttons/forms that require backend
 * - Shows warning overlay and prevents interaction
 * - Allows conditional rendering based on backend status
 */
function PosActionGuard({ 
  children, 
  requiresBackend = true, 
  showOverlay = true,
  message = 'Backend offline - POS actions disabled'
}) {
  const { backendHealthy } = useContext(AuthContext);

  // If backend is healthy or action doesn't require backend, render normally
  if (backendHealthy || !requiresBackend) {
    return children;
  }

  // If showing overlay, wrap with disabled state
  if (showOverlay) {
    return (
      <div className="pos-action-guard">
        <div className="guard-overlay">
          <div className="guard-warning">
            ⚠️ {message}
          </div>
        </div>
        <div className="guard-content disabled">
          {children}
        </div>
      </div>
    );
  }

  // If not showing overlay, just don't render
  return null;
}

export default PosActionGuard;
