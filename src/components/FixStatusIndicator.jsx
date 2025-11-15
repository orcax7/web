import React from 'react';
import './FixStatusIndicator.css';

/**
 * FixStatusIndicator Component
 * 
 * Provides visual feedback for ESLint fix operations including:
 * - Visual distinction between fixable and non-fixable issues
 * - Loading states during fix application
 * - Success/error feedback after fix completion
 * 
 * Requirements: 5.1, 5.2
 */
const FixStatusIndicator = ({
  isFixable,
  isApplying = false,
  fixResult = null,
  ruleId,
  severity = 'error'
}) => {
  // Determine the status and appropriate styling
  const getStatusInfo = () => {
    if (isApplying) {
      return {
        icon: '⏳',
        className: 'fix-status-applying',
        label: 'Applying fix...',
        color: '#2196F3'
      };
    }

    if (fixResult) {
      if (fixResult.success) {
        return {
          icon: '',
          className: 'fix-status-success',
          label: 'Fixed successfully',
          color: '#4CAF50'
        };
      } else {
        return {
          icon: '',
          className: 'fix-status-error',
          label: `Fix failed: ${fixResult.message || 'Unknown error'}`,
          color: '#f44336'
        };
      }
    }

    if (isFixable) {
      return {
        icon: '',
        className: 'fix-status-fixable',
        label: 'Auto-fixable',
        color: '#4CAF50'
      };
    }

    return {
      icon: '',
      className: 'fix-status-not-fixable',
      label: 'Manual fix required',
      color: '#ff9800'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`fix-status-indicator ${statusInfo.className}`}
      title={statusInfo.label}
      style={{ '--status-color': statusInfo.color }}
    >
      <span className="fix-status-text">
        {statusInfo.label}
      </span>
      {fixResult && fixResult.warnings && fixResult.warnings.length > 0 && (
        <div className="fix-status-warnings">
          <span className="warning-icon" title="Warnings">⚠️</span>
          <span className="warning-count">{fixResult.warnings.length}</span>
        </div>
      )}
    </div>
  );
};

export default FixStatusIndicator;