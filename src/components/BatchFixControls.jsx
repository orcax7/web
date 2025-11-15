import React from 'react';
import './BatchFixControls.css';

/**
 * BatchFixControls Component
 * 
 * Provides batch fix functionality including:
 * - "Fix All" button with fix count display
 * - Progress bars and status updates for batch operations
 * - Visual feedback for batch processing state
 * 
 * Requirements: 5.4
 */
const BatchFixControls = ({ 
  fixableCount = 0,
  totalCount = 0,
  onBatchFix,
  isProcessing = false,
  batchProgress = null,
  disabled = false
}) => {
  const hasFixableIssues = fixableCount > 0;
  const progressPercentage = batchProgress ? 
    Math.round((batchProgress.current / batchProgress.total) * 100) : 0;

  return (
    <div className="batch-fix-controls">
      <div className="batch-fix-header">
        <div className="fix-counts">
          <span className="total-count">
            Total Issues: <strong>{totalCount}</strong>
          </span>
          <span className="fixable-count">
            Auto-fixable: <strong className={hasFixableIssues ? 'has-fixes' : 'no-fixes'}>
              {fixableCount}
            </strong>
          </span>
        </div>
        
        <button
          className={`batch-fix-button ${isProcessing ? 'processing' : ''} ${!hasFixableIssues ? 'disabled' : ''}`}
          onClick={onBatchFix}
          disabled={disabled || isProcessing || !hasFixableIssues}
          title={!hasFixableIssues ? 'No auto-fixable issues found' : `Fix all ${fixableCount} issues`}
        >
          {isProcessing ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            <> 
              Fix All ({fixableCount})
            </>
          )}
        </button>
      </div>

      {/* Progress indicator for batch operations */}
      {batchProgress && (
        <div className="batch-progress-container">
          <div className="progress-info">
            <div className="progress-text">
              <strong>{batchProgress.message || 'Processing fixes...'}</strong>
            </div>
            <div className="progress-details">
              <span>Phase: {batchProgress.phase}</span>
              <span>Progress: {batchProgress.current}/{batchProgress.total}</span>
              {batchProgress.successCount !== undefined && (
                <span className="success-count">✅ {batchProgress.successCount}</span>
              )}
              {batchProgress.failureCount !== undefined && batchProgress.failureCount > 0 && (
                <span className="failure-count">❌ {batchProgress.failureCount}</span>
              )}
            </div>
            {batchProgress.currentRule && (
              <div className="current-rule">
                Currently processing: <code>{batchProgress.currentRule}</code>
              </div>
            )}
          </div>
          
          <div className="progress-bar-container">
            <div 
              className={`progress-bar ${batchProgress.phase === 'error' ? 'error' : ''}`}
              style={{ width: `${progressPercentage}%` }}
            >
              <span className="progress-percentage">{progressPercentage}%</span>
            </div>
          </div>
          
          {batchProgress.phase === 'complete' && (
            <div className="completion-summary">
              <span className="completion-icon">🎉</span>
              Batch fix completed! 
              {batchProgress.successCount > 0 && (
                <span className="success-summary">
                  {batchProgress.successCount} fixes applied successfully
                </span>
              )}
              {batchProgress.failureCount > 0 && (
                <span className="failure-summary">
                  {batchProgress.failureCount} fixes failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchFixControls;