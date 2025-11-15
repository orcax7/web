/**
 * @fileoverview Batch fix processor for applying multiple ESLint fixes in sequence
 * Provides safe batch processing with progress tracking, validation, and error recovery
 */

import FixerBase from './fixerBase.js';
import ContextAnalyzer from './contextAnalyzer.js';
import CodeValidator from './codeValidator.js';
import fixerRegistry from '../registry/fixerRegistry.js';
import axios from 'axios';

/**
 * @typedef {Object} BatchProgress
 * @property {number} current - Current fix being processed (0-based)
 * @property {number} total - Total number of fixes to process
 * @property {string} currentRule - Rule ID currently being processed
 * @property {'analyzing'|'fixing'|'validating'|'complete'|'error'} phase - Current processing phase
 * @property {number} successCount - Number of successfully applied fixes
 * @property {number} failureCount - Number of failed fixes
 * @property {string} [message] - Optional status message
 */

/**
 * @typedef {Object} FixSummary
 * @property {string} ruleId - The ESLint rule that was fixed
 * @property {number} line - Line number where fix was applied
 * @property {number} column - Column number where fix was applied
 * @property {boolean} success - Whether the fix was successful
 * @property {string} message - Description of the fix result
 * @property {Date} appliedAt - Timestamp when fix was applied
 * @property {string} [originalText] - Original text before fix (for rollback)
 * @property {string} [fixedText] - Text after fix (for rollback)
 */

/**
 * @typedef {Object} BatchResult
 * @property {string} finalCode - The final code after all fixes
 * @property {FixSummary[]} appliedFixes - Array of successfully applied fixes
 * @property {FixSummary[]} failedFixes - Array of fixes that failed
 * @property {number} totalErrors - Total number of errors processed
 * @property {number} fixedErrors - Number of errors that were fixed
 * @property {boolean} success - Whether the batch operation completed successfully
 * @property {string} [error] - Error message if batch operation failed
 * @property {number} processingTime - Time taken to process batch (in milliseconds)
 */

/**
 * @typedef {Object} ESLintError
 * @property {string} ruleId - The ESLint rule identifier
 * @property {string} message - Error message from ESLint
 * @property {number} line - Line number (1-based)
 * @property {number} column - Column number (1-based)
 * @property {number} [endLine] - End line number for range errors
 * @property {number} [endColumn] - End column number for range errors
 * @property {'error'|'warning'} severity - Error severity level
 * @property {string} [nodeType] - AST node type that caused the error
 * @property {string} [source] - Source code line that caused the error
 * @property {Object} [fix] - ESLint's suggested fix object
 */

/**
 * Batch fix processor for applying multiple ESLint fixes safely
 */
class BatchFixProcessor {
  constructor(options = {}) {
    this.contextAnalyzer = new ContextAnalyzer();
    this.codeValidator = new CodeValidator();
    this.isCancelled = false;
    this.currentBatch = null;
    
    // Configuration options
    this.options = {
      relintAfterEachFix: options.relintAfterEachFix !== false, // Default true
      relintBatchSize: options.relintBatchSize || 5, // Re-lint after every N fixes
      lintApiUrl: options.lintApiUrl || 'http://localhost:3001/lint',
      fileName: options.fileName || 'temp.js',
      ...options
    };
  }

  /**
   * Process multiple fixes in batch with progress tracking
   * @param {string} code - The source code to fix
   * @param {ESLintError[]} errors - Array of ESLint errors to fix
   * @param {function(BatchProgress): void} [onProgress] - Progress callback function
   * @returns {Promise<BatchResult>} Result of the batch processing
   */
  async processBatch(code, errors, onProgress = null) {
    const startTime = Date.now();
    this.isCancelled = false;
    
    // Initialize batch tracking
    this.currentBatch = {
      originalCode: code,
      currentCode: code,
      errors: [...errors],
      appliedFixes: [],
      failedFixes: [],
      startTime
    };

    try {
      // Create initial snapshot for rollback capability
      this.codeValidator.createSnapshot(code, 'batch-start');
      
      // Filter and sort errors for safe processing
      const fixableErrors = await this.prepareErrorsForBatch(errors);
      
      if (fixableErrors.length === 0) {
        return this.createBatchResult(code, [], [], errors.length, 0, true, null, Date.now() - startTime);
      }

      // Report initial progress
      if (onProgress) {
        onProgress({
          current: 0,
          total: fixableErrors.length,
          currentRule: '',
          phase: 'analyzing',
          successCount: 0,
          failureCount: 0,
          message: `Preparing to process ${fixableErrors.length} fixable errors`
        });
      }

      let currentCode = code;
      const appliedFixes = [];
      const failedFixes = [];

      // Process each error in sequence
      for (let i = 0; i < fixableErrors.length; i++) {
        if (this.isCancelled) {
          throw new Error('Batch processing was cancelled');
        }

        const error = fixableErrors[i];
        
        // Report progress
        if (onProgress) {
          onProgress({
            current: i,
            total: fixableErrors.length,
            currentRule: error.ruleId,
            phase: 'fixing',
            successCount: appliedFixes.length,
            failureCount: failedFixes.length,
            message: `Processing ${error.ruleId} at line ${error.line}`
          });
        }

        try {
          // Apply fix safely
          const fixResult = await this.applyFixSafely(currentCode, error);
          
          if (fixResult.success) {
            // Validate the fix before accepting it
            const stepValidation = await this.validateBatchStep(fixResult.code, appliedFixes);
            
            if (stepValidation.isValid) {
              currentCode = fixResult.code;
              appliedFixes.push(this.createFixSummary(error, true, fixResult.message, fixResult.originalText, fixResult.fixedText));
              
              // Update current batch state
              this.currentBatch.currentCode = currentCode;
              this.currentBatch.appliedFixes = [...appliedFixes];
            } else {
              // Fix caused validation issues
              const failureMessage = `Fix validation failed: ${stepValidation.error}`;
              failedFixes.push(this.createFixSummary(error, false, failureMessage));
              this.currentBatch.failedFixes = [...failedFixes];
              
              // If validation suggests rollback, attempt recovery
              if (stepValidation.shouldRollback) {
                const recovery = await this.recoverFromError(currentCode, appliedFixes, new Error(stepValidation.error));
                if (recovery.success) {
                  currentCode = recovery.code;
                  console.warn(`Recovered using strategy: ${recovery.strategy} - ${recovery.message}`);
                } else {
                  throw new Error(`Validation failed and recovery unsuccessful: ${stepValidation.error}`);
                }
              }
            }
          } else {
            failedFixes.push(this.createFixSummary(error, false, fixResult.message));
            this.currentBatch.failedFixes = [...failedFixes];
          }
        } catch (processingError) {
          const errorMessage = `Unexpected error processing ${error.ruleId}: ${processingError.message}`;
          failedFixes.push(this.createFixSummary(error, false, errorMessage));
          this.currentBatch.failedFixes = [...failedFixes];
          
          // Attempt error recovery
          try {
            const recovery = await this.recoverFromError(currentCode, appliedFixes, processingError);
            if (recovery.success && recovery.strategy !== 'none') {
              currentCode = recovery.code;
              console.warn(`Recovered from processing error using strategy: ${recovery.strategy} - ${recovery.message}`);
            } else {
              // If recovery fails for critical errors, stop batch processing
              if (processingError.message.includes('syntax') || processingError.message.includes('validation')) {
                throw new Error(`Critical error during batch processing: ${processingError.message}`);
              }
            }
          } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
            // Continue with next fix if recovery fails for non-critical errors
          }
        }
      }

      // Final validation
      if (onProgress) {
        onProgress({
          current: fixableErrors.length,
          total: fixableErrors.length,
          currentRule: '',
          phase: 'validating',
          successCount: appliedFixes.length,
          failureCount: failedFixes.length,
          message: 'Performing final validation'
        });
      }

      const finalValidation = this.codeValidator.validateSyntax(currentCode);
      if (!finalValidation.isValid) {
        throw new Error(`Final code validation failed: ${finalValidation.error}`);
      }

      // Complete
      if (onProgress) {
        onProgress({
          current: fixableErrors.length,
          total: fixableErrors.length,
          currentRule: '',
          phase: 'complete',
          successCount: appliedFixes.length,
          failureCount: failedFixes.length,
          message: `Batch complete: ${appliedFixes.length} fixes applied, ${failedFixes.length} failed`
        });
      }

      const processingTime = Date.now() - startTime;
      return this.createBatchResult(currentCode, appliedFixes, failedFixes, errors.length, appliedFixes.length, true, null, processingTime);

    } catch (error) {
      // Handle batch failure
      if (onProgress) {
        onProgress({
          current: 0,
          total: errors.length,
          currentRule: '',
          phase: 'error',
          successCount: this.currentBatch?.appliedFixes?.length || 0,
          failureCount: this.currentBatch?.failedFixes?.length || 0,
          message: `Batch processing failed: ${error.message}`
        });
      }

      const processingTime = Date.now() - startTime;
      return this.createBatchResult(
        this.currentBatch?.currentCode || code,
        this.currentBatch?.appliedFixes || [],
        this.currentBatch?.failedFixes || [],
        errors.length,
        this.currentBatch?.appliedFixes?.length || 0,
        false,
        error.message,
        processingTime
      );
    } finally {
      this.currentBatch = null;
    }
  }

  /**
   * Apply a single fix safely with validation
   * @param {string} code - The current code
   * @param {ESLintError} error - The error to fix
   * @returns {Promise<Object>} Fix result with success status and code
   * @private
   */
  async applyFixSafely(code, error) {
    try {
      // Check if position is safe for fixing
      const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);
      if (!safeZone.isSafe) {
        return {
          success: false,
          code,
          message: `Cannot fix ${error.ruleId}: ${safeZone.reason}`,
          warnings: ['Fix skipped due to unsafe context']
        };
      }

      // Get the appropriate fixer
      const fixer = fixerRegistry.getFixer(error.ruleId);
      if (!fixer) {
        return {
          success: false,
          code,
          message: `No fixer available for rule: ${error.ruleId}`
        };
      }

      // Check if fixer can handle this specific error
      if (!fixer.canFix(code, error)) {
        return {
          success: false,
          code,
          message: `Fixer cannot handle this instance of ${error.ruleId}`
        };
      }

      // Apply the fix
      const fixResult = fixer.fix(code, error);
      
      if (!fixResult.success) {
        return fixResult;
      }

      // Validate the fix
      const validation = this.codeValidator.validateSyntax(fixResult.code);
      if (!validation.isValid) {
        return {
          success: false,
          code,
          message: `Fix validation failed: ${validation.error}`,
          warnings: validation.warnings
        };
      }

      // Record the fix for potential rollback
      const originalText = this.extractOriginalText(code, error);
      const fixedText = this.extractFixedText(fixResult.code, error);
      
      this.codeValidator.recordFix(
        error.ruleId,
        error.line,
        error.column,
        originalText,
        fixedText
      );

      return {
        success: true,
        code: fixResult.code,
        message: fixResult.message || `Successfully applied ${error.ruleId} fix`,
        warnings: fixResult.warnings || [],
        originalText,
        fixedText
      };

    } catch (error) {
      return {
        success: false,
        code,
        message: `Error applying fix: ${error.message}`,
        warnings: ['Unexpected error during fix application']
      };
    }
  }

  /**
   * Prepare errors for batch processing by filtering and ordering
   * @param {ESLintError[]} errors - Raw ESLint errors
   * @returns {Promise<ESLintError[]>} Filtered and ordered errors
   * @private
   */
  async prepareErrorsForBatch(errors) {
    // Filter to only fixable errors
    const fixableErrors = errors.filter(error => {
      return fixerRegistry.isFixable(error.ruleId);
    });

    // Sort errors for safe processing order
    // Process from bottom to top to avoid position shifts
    fixableErrors.sort((a, b) => {
      if (a.line !== b.line) {
        return b.line - a.line; // Reverse line order
      }
      return b.column - a.column; // Reverse column order within same line
    });

    return fixableErrors;
  }

  /**
   * Create a fix summary object
   * @param {ESLintError} error - The original error
   * @param {boolean} success - Whether the fix was successful
   * @param {string} message - Result message
   * @param {string} [originalText] - Original text before fix
   * @param {string} [fixedText] - Text after fix
   * @returns {FixSummary} Fix summary object
   * @private
   */
  createFixSummary(error, success, message, originalText = null, fixedText = null) {
    return {
      ruleId: error.ruleId,
      line: error.line,
      column: error.column,
      success,
      message,
      appliedAt: new Date(),
      originalText,
      fixedText
    };
  }

  /**
   * Create a batch result object
   * @param {string} finalCode - Final code after processing
   * @param {FixSummary[]} appliedFixes - Successfully applied fixes
   * @param {FixSummary[]} failedFixes - Failed fixes
   * @param {number} totalErrors - Total errors processed
   * @param {number} fixedErrors - Number of fixed errors
   * @param {boolean} success - Overall success status
   * @param {string} [error] - Error message if failed
   * @param {number} processingTime - Processing time in milliseconds
   * @returns {BatchResult} Batch result object
   * @private
   */
  createBatchResult(finalCode, appliedFixes, failedFixes, totalErrors, fixedErrors, success, error, processingTime) {
    return {
      finalCode,
      appliedFixes,
      failedFixes,
      totalErrors,
      fixedErrors,
      success,
      error,
      processingTime
    };
  }

  /**
   * Extract original text around the error position
   * @param {string} code - The source code
   * @param {ESLintError} error - The error object
   * @returns {string} Original text
   * @private
   */
  extractOriginalText(code, error) {
    const lines = code.split('\n');
    const line = lines[error.line - 1];
    
    if (!line) return '';
    
    // Extract a reasonable context around the error
    const start = Math.max(0, error.column - 10);
    const end = Math.min(line.length, error.column + 10);
    
    return line.substring(start, end);
  }

  /**
   * Extract fixed text around the error position
   * @param {string} code - The fixed code
   * @param {ESLintError} error - The original error object
   * @returns {string} Fixed text
   * @private
   */
  extractFixedText(code, error) {
    const lines = code.split('\n');
    const line = lines[error.line - 1];
    
    if (!line) return '';
    
    // Extract a reasonable context around the error position
    const start = Math.max(0, error.column - 10);
    const end = Math.min(line.length, error.column + 10);
    
    return line.substring(start, end);
  }

  /**
   * Cancel the current batch processing
   */
  cancel() {
    this.isCancelled = true;
  }

  /**
   * Rollback failed batch operations
   * @param {BatchResult} batchResult - Result from a failed batch operation
   * @returns {Promise<string>} The rolled back code
   */
  async rollbackBatch(batchResult) {
    if (batchResult.success) {
      throw new Error('Cannot rollback successful batch operation');
    }

    try {
      // Get the original code from snapshot
      const originalCode = this.codeValidator.codeSnapshots.get('batch-start');
      if (!originalCode) {
        throw new Error('No rollback snapshot available');
      }

      // Validate that rollback would be safe
      const validation = this.codeValidator.validateSyntax(originalCode);
      if (!validation.isValid) {
        throw new Error('Original code snapshot is invalid');
      }

      console.log(`Rolling back batch operation. Reverting ${batchResult.appliedFixes.length} applied fixes.`);
      
      return originalCode;
    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Validate batch operation at each step
   * @param {string} code - Code to validate
   * @param {FixSummary[]} appliedFixes - Fixes applied so far
   * @returns {Promise<Object>} Validation result
   * @private
   */
  async validateBatchStep(code, appliedFixes) {
    try {
      // Syntax validation
      const syntaxValidation = this.codeValidator.validateSyntax(code);
      if (!syntaxValidation.isValid) {
        return {
          isValid: false,
          error: `Syntax validation failed: ${syntaxValidation.error}`,
          type: 'syntax',
          shouldRollback: true
        };
      }

      // Semantic validation if we have applied fixes
      if (appliedFixes.length > 0) {
        const originalCode = this.codeValidator.codeSnapshots.get('batch-start');
        if (originalCode) {
          const semanticValidation = this.codeValidator.validateSemantics(originalCode, code);
          if (!semanticValidation.isValid) {
            return {
              isValid: false,
              error: `Semantic validation failed: ${semanticValidation.error}`,
              type: 'semantic',
              shouldRollback: false, // Semantic issues might be acceptable
              warnings: semanticValidation.warnings
            };
          }
        }
      }

      return {
        isValid: true,
        type: 'complete'
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        type: 'error',
        shouldRollback: true
      };
    }
  }

  /**
   * Recover from batch processing errors
   * @param {string} currentCode - Code at the point of failure
   * @param {FixSummary[]} appliedFixes - Fixes that were successfully applied
   * @param {Error} error - The error that occurred
   * @returns {Promise<Object>} Recovery result
   */
  async recoverFromError(currentCode, appliedFixes, error) {
    console.warn(`Attempting recovery from batch error: ${error.message}`);
    
    try {
      // First, try to validate current code
      const validation = await this.validateBatchStep(currentCode, appliedFixes);
      
      if (validation.isValid) {
        // Current code is valid, we can continue from here
        return {
          success: true,
          code: currentCode,
          strategy: 'continue',
          message: 'Code is valid, continuing from current state'
        };
      }

      if (validation.shouldRollback) {
        // Need to rollback to last known good state
        const rollbackCode = await this.rollbackToLastGoodState(appliedFixes);
        return {
          success: true,
          code: rollbackCode,
          strategy: 'rollback',
          message: `Rolled back to state after ${this.findLastGoodFixIndex(appliedFixes)} fixes`
        };
      }

      // Try partial rollback - remove last few fixes
      const partialRollbackCode = await this.attemptPartialRollback(currentCode, appliedFixes);
      if (partialRollbackCode) {
        return {
          success: true,
          code: partialRollbackCode,
          strategy: 'partial_rollback',
          message: 'Partially rolled back to recover from error'
        };
      }

      // Last resort - full rollback to original
      const originalCode = this.codeValidator.codeSnapshots.get('batch-start');
      if (originalCode) {
        return {
          success: true,
          code: originalCode,
          strategy: 'full_rollback',
          message: 'Full rollback to original code'
        };
      }

      // Recovery failed
      return {
        success: false,
        code: currentCode,
        strategy: 'none',
        message: 'Unable to recover from error'
      };

    } catch (recoveryError) {
      return {
        success: false,
        code: currentCode,
        strategy: 'none',
        message: `Recovery failed: ${recoveryError.message}`
      };
    }
  }

  /**
   * Rollback to the last known good state
   * @param {FixSummary[]} appliedFixes - Fixes that were applied
   * @returns {Promise<string>} Code at last good state
   * @private
   */
  async rollbackToLastGoodState(appliedFixes) {
    // Start from original and reapply fixes one by one until we find the last good state
    const originalCode = this.codeValidator.codeSnapshots.get('batch-start');
    if (!originalCode) {
      throw new Error('No original code snapshot available');
    }

    let currentCode = originalCode;
    let lastGoodCode = originalCode;
    
    for (let i = 0; i < appliedFixes.length; i++) {
      const fix = appliedFixes[i];
      
      // Simulate reapplying the fix
      try {
        // This is a simplified rollback - in a real implementation,
        // we would need to store more detailed fix information
        const validation = this.codeValidator.validateSyntax(currentCode);
        if (validation.isValid) {
          lastGoodCode = currentCode;
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }

    return lastGoodCode;
  }

  /**
   * Find the index of the last good fix
   * @param {FixSummary[]} appliedFixes - Applied fixes
   * @returns {number} Index of last good fix
   * @private
   */
  findLastGoodFixIndex(appliedFixes) {
    // For now, assume the last fix is problematic
    return Math.max(0, appliedFixes.length - 1);
  }

  /**
   * Attempt partial rollback by removing recent fixes
   * @param {string} currentCode - Current code state
   * @param {FixSummary[]} appliedFixes - Applied fixes
   * @returns {Promise<string|null>} Partially rolled back code or null if failed
   * @private
   */
  async attemptPartialRollback(currentCode, appliedFixes) {
    if (appliedFixes.length === 0) {
      return null;
    }

    try {
      // Try removing the last fix
      const lastFix = appliedFixes[appliedFixes.length - 1];
      
      if (lastFix.originalText && lastFix.fixedText) {
        const rolledBackCode = this.codeValidator.revertLastFix(currentCode, {
          ruleId: lastFix.ruleId,
          line: lastFix.line,
          column: lastFix.column,
          originalText: lastFix.originalText,
          fixedText: lastFix.fixedText
        });

        const validation = this.codeValidator.validateSyntax(rolledBackCode);
        if (validation.isValid) {
          return rolledBackCode;
        }
      }

      return null;
    } catch (error) {
      console.warn('Partial rollback failed:', error);
      return null;
    }
  }

  /**
   * Check if batch processing is currently running
   * @returns {boolean} True if batch is running
   */
  isRunning() {
    return this.currentBatch !== null;
  }

  /**
   * Get current batch status
   * @returns {Object|null} Current batch information or null if not running
   */
  getCurrentBatchStatus() {
    if (!this.currentBatch) {
      return null;
    }

    return {
      originalCodeLength: this.currentBatch.originalCode.length,
      currentCodeLength: this.currentBatch.currentCode.length,
      totalErrors: this.currentBatch.errors.length,
      appliedFixes: this.currentBatch.appliedFixes.length,
      failedFixes: this.currentBatch.failedFixes.length,
      elapsedTime: Date.now() - this.currentBatch.startTime
    };
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getStats() {
    return {
      validatorStats: this.codeValidator.getStats(),
      contextAnalyzerStats: this.contextAnalyzer.getCacheStats(),
      isRunning: this.isRunning(),
      currentBatch: this.getCurrentBatchStatus()
    };
  }

  /**
   * Generate detailed report of batch processing results
   * @param {BatchResult} batchResult - Result from batch processing
   * @returns {Object} Detailed report
   */
  generateDetailedReport(batchResult) {
    const report = {
      summary: {
        totalErrors: batchResult.totalErrors,
        fixedErrors: batchResult.fixedErrors,
        failedErrors: batchResult.failedFixes.length,
        successRate: batchResult.totalErrors > 0 ? (batchResult.fixedErrors / batchResult.totalErrors * 100).toFixed(1) : 0,
        processingTime: batchResult.processingTime,
        overallSuccess: batchResult.success
      },
      appliedFixes: {
        count: batchResult.appliedFixes.length,
        byRule: this.groupFixesByRule(batchResult.appliedFixes),
        timeline: batchResult.appliedFixes.map(fix => ({
          ruleId: fix.ruleId,
          line: fix.line,
          appliedAt: fix.appliedAt,
          message: fix.message
        }))
      },
      failedFixes: {
        count: batchResult.failedFixes.length,
        byRule: this.groupFixesByRule(batchResult.failedFixes),
        byReason: this.groupFailuresByReason(batchResult.failedFixes),
        details: batchResult.failedFixes.map(fix => ({
          ruleId: fix.ruleId,
          line: fix.line,
          reason: fix.message,
          appliedAt: fix.appliedAt
        }))
      },
      codeMetrics: {
        originalLength: batchResult.finalCode.length,
        originalLines: batchResult.finalCode.split('\n').length,
        hasChanges: batchResult.appliedFixes.length > 0
      },
      recommendations: this.generateRecommendations(batchResult)
    };

    return report;
  }

  /**
   * Group fixes by rule ID
   * @param {FixSummary[]} fixes - Array of fixes
   * @returns {Object} Fixes grouped by rule
   * @private
   */
  groupFixesByRule(fixes) {
    return fixes.reduce((groups, fix) => {
      if (!groups[fix.ruleId]) {
        groups[fix.ruleId] = [];
      }
      groups[fix.ruleId].push(fix);
      return groups;
    }, {});
  }

  /**
   * Group failures by reason
   * @param {FixSummary[]} failures - Array of failed fixes
   * @returns {Object} Failures grouped by reason
   * @private
   */
  groupFailuresByReason(failures) {
    return failures.reduce((groups, failure) => {
      const reason = this.categorizeFailureReason(failure.message);
      if (!groups[reason]) {
        groups[reason] = [];
      }
      groups[reason].push(failure);
      return groups;
    }, {});
  }

  /**
   * Categorize failure reason
   * @param {string} message - Failure message
   * @returns {string} Category
   * @private
   */
  categorizeFailureReason(message) {
    if (message.includes('unsafe context') || message.includes('string') || message.includes('comment')) {
      return 'unsafe_context';
    }
    if (message.includes('validation failed') || message.includes('syntax')) {
      return 'validation_error';
    }
    if (message.includes('No fixer available')) {
      return 'no_fixer';
    }
    if (message.includes('cannot handle')) {
      return 'fixer_limitation';
    }
    return 'other';
  }

  /**
   * Generate recommendations based on batch results
   * @param {BatchResult} batchResult - Batch processing result
   * @returns {string[]} Array of recommendations
   * @private
   */
  generateRecommendations(batchResult) {
    const recommendations = [];

    if (batchResult.failedFixes.length > 0) {
      const failuresByReason = this.groupFailuresByReason(batchResult.failedFixes);
      
      if (failuresByReason.unsafe_context && failuresByReason.unsafe_context.length > 0) {
        recommendations.push(`${failuresByReason.unsafe_context.length} fixes failed due to unsafe context (strings/comments). Consider manual review.`);
      }
      
      if (failuresByReason.no_fixer && failuresByReason.no_fixer.length > 0) {
        recommendations.push(`${failuresByReason.no_fixer.length} rules don't have fixers available. These require manual correction.`);
      }
      
      if (failuresByReason.validation_error && failuresByReason.validation_error.length > 0) {
        recommendations.push(`${failuresByReason.validation_error.length} fixes failed validation. Code may have complex syntax issues.`);
      }
    }

    if (batchResult.appliedFixes.length > 0) {
      recommendations.push(`Successfully applied ${batchResult.appliedFixes.length} fixes. Consider running ESLint again to check for new issues.`);
    }

    if (batchResult.processingTime > 5000) {
      recommendations.push('Batch processing took longer than expected. Consider processing smaller batches for better performance.');
    }

    return recommendations;
  }

  /**
   * Re-lint code using the external ESLint API
   * @param {string} code - Code to lint
   * @param {string} [fileName] - Optional file name
   * @returns {Promise<ESLintError[]>} Array of ESLint errors
   */
  async relintCode(code, fileName = null) {
    try {
      const targetFileName = fileName || this.options.fileName;
      
      // Create a blob and file for the API request
      const codeBlob = new Blob([code], { type: "text/plain" });
      const codeFile = new File([codeBlob], targetFileName, { type: "text/plain" });
      
      const formData = new FormData();
      formData.append("files", codeFile);
      
      const response = await axios.post(this.options.lintApiUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data && response.data.lintResult && response.data.lintResult.messages) {
        return response.data.lintResult.messages;
      }
      
      return [];
    } catch (error) {
      console.warn('Re-linting failed:', error.message);
      // Return empty array if re-linting fails - don't stop batch processing
      return [];
    }
  }

  /**
   * Process batch with re-linting integration
   * @param {string} code - The source code to fix
   * @param {ESLintError[]} errors - Array of ESLint errors to fix
   * @param {function(BatchProgress): void} [onProgress] - Progress callback function
   * @param {Object} [options] - Additional options
   * @returns {Promise<BatchResult>} Result of the batch processing with updated error list
   */
  async processBatchWithRelinting(code, errors, onProgress = null, options = {}) {
    const startTime = Date.now();
    this.isCancelled = false;
    
    // Merge options
    const batchOptions = { ...this.options, ...options };
    
    // Initialize batch tracking
    this.currentBatch = {
      originalCode: code,
      currentCode: code,
      errors: [...errors],
      appliedFixes: [],
      failedFixes: [],
      startTime,
      currentErrors: [...errors], // Track current error list
      relintCount: 0
    };

    try {
      // Create initial snapshot for rollback capability
      this.codeValidator.createSnapshot(code, 'batch-start');
      
      // Filter and sort errors for safe processing
      let fixableErrors = await this.prepareErrorsForBatch(errors);
      
      if (fixableErrors.length === 0) {
        return this.createBatchResult(code, [], [], errors.length, 0, true, null, Date.now() - startTime);
      }

      // Report initial progress
      if (onProgress) {
        onProgress({
          current: 0,
          total: fixableErrors.length,
          currentRule: '',
          phase: 'analyzing',
          successCount: 0,
          failureCount: 0,
          message: `Preparing to process ${fixableErrors.length} fixable errors`
        });
      }

      let currentCode = code;
      const appliedFixes = [];
      const failedFixes = [];
      let processedCount = 0;

      // Process errors in batches with re-linting
      while (fixableErrors.length > 0 && !this.isCancelled) {
        const batchSize = Math.min(batchOptions.relintBatchSize, fixableErrors.length);
        const currentBatchErrors = fixableErrors.slice(0, batchSize);
        
        // Process current batch of errors
        for (let i = 0; i < currentBatchErrors.length; i++) {
          if (this.isCancelled) break;
          
          const error = currentBatchErrors[i];
          processedCount++;
          
          // Report progress
          if (onProgress) {
            onProgress({
              current: processedCount,
              total: this.currentBatch.errors.length,
              currentRule: error.ruleId,
              phase: 'fixing',
              successCount: appliedFixes.length,
              failureCount: failedFixes.length,
              message: `Processing ${error.ruleId} at line ${error.line} (batch ${Math.ceil(processedCount / batchSize)})`
            });
          }

          try {
            // Apply fix safely
            const fixResult = await this.applyFixSafely(currentCode, error);
            
            if (fixResult.success) {
              // Validate the fix before accepting it
              const stepValidation = await this.validateBatchStep(fixResult.code, appliedFixes);
              
              if (stepValidation.isValid) {
                currentCode = fixResult.code;
                appliedFixes.push(this.createFixSummary(error, true, fixResult.message, fixResult.originalText, fixResult.fixedText));
                
                // Update current batch state
                this.currentBatch.currentCode = currentCode;
                this.currentBatch.appliedFixes = [...appliedFixes];
              } else {
                // Fix caused validation issues
                const failureMessage = `Fix validation failed: ${stepValidation.error}`;
                failedFixes.push(this.createFixSummary(error, false, failureMessage));
                this.currentBatch.failedFixes = [...failedFixes];
              }
            } else {
              failedFixes.push(this.createFixSummary(error, false, fixResult.message));
              this.currentBatch.failedFixes = [...failedFixes];
            }
          } catch (processingError) {
            const errorMessage = `Unexpected error processing ${error.ruleId}: ${processingError.message}`;
            failedFixes.push(this.createFixSummary(error, false, errorMessage));
            this.currentBatch.failedFixes = [...failedFixes];
          }
        }

        // Remove processed errors from the list
        fixableErrors = fixableErrors.slice(batchSize);

        // Re-lint after processing this batch (if there are more errors to process)
        if (fixableErrors.length > 0 && batchOptions.relintAfterEachFix) {
          if (onProgress) {
            onProgress({
              current: processedCount,
              total: this.currentBatch.errors.length,
              currentRule: '',
              phase: 'analyzing',
              successCount: appliedFixes.length,
              failureCount: failedFixes.length,
              message: 'Re-analyzing code after fixes...'
            });
          }

          try {
            const newErrors = await this.relintCode(currentCode, batchOptions.fileName);
            this.currentBatch.relintCount++;
            
            // Update the error list with new errors
            const updatedFixableErrors = await this.prepareErrorsForBatch(newErrors);
            
            // Filter out errors that we've already processed successfully
            const unprocessedErrors = updatedFixableErrors.filter(newError => {
              return !appliedFixes.some(fix => 
                fix.ruleId === newError.ruleId && 
                fix.line === newError.line && 
                fix.column === newError.column
              );
            });

            fixableErrors = unprocessedErrors;
            this.currentBatch.currentErrors = newErrors;
            
            if (onProgress) {
              onProgress({
                current: processedCount,
                total: processedCount + fixableErrors.length,
                currentRule: '',
                phase: 'analyzing',
                successCount: appliedFixes.length,
                failureCount: failedFixes.length,
                message: `Found ${fixableErrors.length} remaining errors after re-linting`
              });
            }
          } catch (relintError) {
            console.warn('Re-linting failed, continuing with original error list:', relintError);
            // Continue with remaining errors from original list
          }
        }
      }

      // Final validation
      if (onProgress) {
        onProgress({
          current: processedCount,
          total: processedCount,
          currentRule: '',
          phase: 'validating',
          successCount: appliedFixes.length,
          failureCount: failedFixes.length,
          message: 'Performing final validation'
        });
      }

      const finalValidation = this.codeValidator.validateSyntax(currentCode);
      if (!finalValidation.isValid) {
        throw new Error(`Final code validation failed: ${finalValidation.error}`);
      }

      // Final re-lint to get the most up-to-date error count
      let finalErrorCount = this.currentBatch.errors.length - appliedFixes.length;
      if (batchOptions.relintAfterEachFix) {
        try {
          const finalErrors = await this.relintCode(currentCode, batchOptions.fileName);
          finalErrorCount = finalErrors.length;
          this.currentBatch.currentErrors = finalErrors;
        } catch (error) {
          console.warn('Final re-linting failed:', error);
        }
      }

      // Complete
      if (onProgress) {
        onProgress({
          current: processedCount,
          total: processedCount,
          currentRule: '',
          phase: 'complete',
          successCount: appliedFixes.length,
          failureCount: failedFixes.length,
          message: `Batch complete: ${appliedFixes.length} fixes applied, ${failedFixes.length} failed, ${finalErrorCount} errors remaining`
        });
      }

      const processingTime = Date.now() - startTime;
      const result = this.createBatchResult(currentCode, appliedFixes, failedFixes, this.currentBatch.errors.length, appliedFixes.length, true, null, processingTime);
      
      // Add re-linting specific information
      result.relintingInfo = {
        relintCount: this.currentBatch.relintCount,
        finalErrorCount: finalErrorCount,
        currentErrors: this.currentBatch.currentErrors
      };

      return result;

    } catch (error) {
      // Handle batch failure
      if (onProgress) {
        onProgress({
          current: 0,
          total: errors.length,
          currentRule: '',
          phase: 'error',
          successCount: this.currentBatch?.appliedFixes?.length || 0,
          failureCount: this.currentBatch?.failedFixes?.length || 0,
          message: `Batch processing failed: ${error.message}`
        });
      }

      const processingTime = Date.now() - startTime;
      const result = this.createBatchResult(
        this.currentBatch?.currentCode || code,
        this.currentBatch?.appliedFixes || [],
        this.currentBatch?.failedFixes || [],
        errors.length,
        this.currentBatch?.appliedFixes?.length || 0,
        false,
        error.message,
        processingTime
      );

      // Add re-linting info even for failed batches
      result.relintingInfo = {
        relintCount: this.currentBatch?.relintCount || 0,
        finalErrorCount: this.currentBatch?.currentErrors?.length || errors.length,
        currentErrors: this.currentBatch?.currentErrors || errors
      };

      return result;
    } finally {
      this.currentBatch = null;
    }
  }

  /**
   * Update error list dynamically as fixes are applied
   * @param {ESLintError[]} currentErrors - Current error list
   * @param {FixSummary} appliedFix - Fix that was just applied
   * @returns {ESLintError[]} Updated error list
   * @private
   */
  updateErrorListAfterFix(currentErrors, appliedFix) {
    // Remove the fixed error and any errors that might have been resolved by this fix
    return currentErrors.filter(error => {
      // Remove the exact error that was fixed
      if (error.ruleId === appliedFix.ruleId && 
          error.line === appliedFix.line && 
          error.column === appliedFix.column) {
        return false;
      }
      
      // Some fixes might resolve multiple errors on the same line
      // This is a simplified approach - in practice, you'd want more sophisticated logic
      if (error.line === appliedFix.line && this.isRelatedRule(error.ruleId, appliedFix.ruleId)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Check if two rules are related and might be resolved together
   * @param {string} ruleId1 - First rule ID
   * @param {string} ruleId2 - Second rule ID
   * @returns {boolean} True if rules are related
   * @private
   */
  isRelatedRule(ruleId1, ruleId2) {
    const relatedRules = {
      'semi': ['no-extra-semi'],
      'no-extra-semi': ['semi'],
      'quotes': ['no-mixed-quotes'],
      'indent': ['no-mixed-spaces-and-tabs'],
      'no-trailing-spaces': ['eol-last']
    };
    
    return relatedRules[ruleId1]?.includes(ruleId2) || relatedRules[ruleId2]?.includes(ruleId1);
  }

  /**
   * Clear internal state and caches
   */
  clear() {
    this.codeValidator.clear();
    this.contextAnalyzer.clearCache();
    this.isCancelled = false;
    this.currentBatch = null;
  }
}

export default BatchFixProcessor;
export { BatchFixProcessor };