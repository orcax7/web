import { parse } from "@babel/parser";
/**
 * @fileoverview Code validation utilities for ensuring fix safety and correctness
 * Provides syntax and semantic validation for JavaScript code after applying fixes
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string[]} [warnings] - Optional warnings about the code
 * @property {Object} [details] - Additional validation details
 */

/**
 * @typedef {Object} FixHistory
 * @property {string} ruleId - The rule that was fixed
 * @property {number} line - Line where fix was applied
 * @property {number} column - Column where fix was applied
 * @property {string} originalText - Original text before fix
 * @property {string} fixedText - Text after fix
 * @property {Date} timestamp - When the fix was applied
 */

/**
 * Code validator for ensuring JavaScript code correctness after fixes
 */
class CodeValidator {
  constructor() {
    /** @type {FixHistory[]} */
    this.fixHistory = [];

    /** @type {Map<string, string>} */
    this.codeSnapshots = new Map();
  }

  /**
   * Validate JavaScript syntax
   * @param {string} code - The code to validate
   * @returns {ValidationResult} Validation result
   */
  validateSyntax(code) {
    try {
      // Basic syntax validation using Function constructor
      new Function(code);

      // Additional checks for common syntax issues
      const syntaxIssues = this.checkCommonSyntaxIssues(code);

      if (syntaxIssues.length > 0) {
        return {
          isValid: false,
          error: 'Syntax validation failed',
          warnings: syntaxIssues,
          details: { type: 'syntax', issues: syntaxIssues }
        };
      }

      return {
        isValid: true,
        warnings: [],
        details: { type: 'syntax', passed: true }
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Syntax error: ${error.message}`,
        warnings: ['Code contains syntax errors that prevent execution'],
        details: {
          type: 'syntax',
          syntaxError: error.message,
          errorType: error.name
        }
      };
    }
  }

  /**
   * Validate semantic correctness by comparing original and fixed code
   * @param {string} originalCode - The original code before fixes
   * @param {string} fixedCode - The code after applying fixes
   * @returns {ValidationResult} Validation result
   */
  validateSemantics(originalCode, fixedCode) {
    try {
      // First validate syntax of both versions
      const originalSyntax = this.validateSyntax(originalCode);
      const fixedSyntax = this.validateSyntax(fixedCode);

      if (!fixedSyntax.isValid) {
        return {
          isValid: false,
          error: 'Fixed code has syntax errors',
          warnings: fixedSyntax.warnings,
          details: { type: 'semantic', cause: 'syntax_error_in_fixed' }
        };
      }

      // Check for semantic changes that might affect behavior
      const semanticIssues = this.checkSemanticChanges(originalCode, fixedCode);

      if (semanticIssues.length > 0) {
        return {
          isValid: false,
          error: 'Semantic validation failed',
          warnings: semanticIssues,
          details: { type: 'semantic', issues: semanticIssues }
        };
      }

      return {
        isValid: true,
        warnings: [],
        details: { type: 'semantic', passed: true }
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Semantic validation error: ${error.message}`,
        warnings: ['Unable to complete semantic validation'],
        details: { type: 'semantic', validationError: error.message }
      };
    }
  }

  /**
   * Check if fixes can be reverted based on history
   * @param {FixHistory[]} [history] - Fix history to check (defaults to internal history)
   * @returns {boolean} True if fixes can be reverted
   */
  canRevert(history = null) {
    const targetHistory = history || this.fixHistory;
    return targetHistory.length > 0;
  }

  /**
   * Revert the last fix applied to the code
   * @param {string} code - The current code
   * @param {FixHistory} lastFix - The last fix to revert
   * @returns {string} Code with the last fix reverted
   */
  revertLastFix(code, lastFix) {
    try {
      // Find the position of the fix in the current code
      const lines = code.split('\n');

      if (lastFix.line > lines.length) {
        throw new Error('Fix line number exceeds code length');
      }

      const targetLine = lines[lastFix.line - 1];

      // Simple reversion - replace fixed text with original text
      const revertedLine = targetLine.replace(lastFix.fixedText, lastFix.originalText);
      lines[lastFix.line - 1] = revertedLine;

      const revertedCode = lines.join('\n');

      // Validate the reverted code
      const validation = this.validateSyntax(revertedCode);
      if (!validation.isValid) {
        throw new Error(`Reversion would create invalid code: ${validation.error}`);
      }

      return revertedCode;
    } catch (error) {
      console.error('Failed to revert fix:', error);
      throw new Error(`Cannot revert fix: ${error.message}`);
    }
  }

  /**
   * Record a fix in the history
   * @param {string} ruleId - The rule that was fixed
   * @param {number} line - Line where fix was applied
   * @param {number} column - Column where fix was applied
   * @param {string} originalText - Original text before fix
   * @param {string} fixedText - Text after fix
   */
  recordFix(ruleId, line, column, originalText, fixedText) {
    const fixRecord = {
      ruleId,
      line,
      column,
      originalText,
      fixedText,
      timestamp: new Date()
    };

    this.fixHistory.push(fixRecord);

    // Keep history size manageable
    if (this.fixHistory.length > 100) {
      this.fixHistory.shift();
    }
  }

  /**
   * Create a snapshot of code for later comparison
   * @param {string} code - The code to snapshot
   * @param {string} snapshotId - Identifier for the snapshot
   */
  createSnapshot(code, snapshotId) {
    this.codeSnapshots.set(snapshotId, code);
  }

  /**
   * Compare current code with a snapshot
   * @param {string} currentCode - The current code
   * @param {string} snapshotId - Identifier of the snapshot to compare with
   * @returns {Object} Comparison result
   */
  compareWithSnapshot(currentCode, snapshotId) {
    const snapshot = this.codeSnapshots.get(snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot '${snapshotId}' not found`);
    }

    return {
      identical: currentCode === snapshot,
      lengthDiff: currentCode.length - snapshot.length,
      lineDiff: currentCode.split('\n').length - snapshot.split('\n').length,
      hasChanges: currentCode !== snapshot
    };
  }

  /**
   * Check for common syntax issues
   * @param {string} code - The code to check
   * @returns {string[]} Array of syntax issue descriptions
   * @private
   */
  checkCommonSyntaxIssues(code) {
    const issues = [];

    // --- 1️⃣ Check unmatched brackets ---
    const brackets = { "(": ")", "[": "]", "{": "}" };
    const stack = [];

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      if (brackets[char]) {
        stack.push({ char, pos: i });
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (!last || brackets[last.char] !== char) {
          issues.push(`Unmatched bracket '${char}' at position ${i}`);
        }
      }
    }

    if (stack.length > 0) {
      for (const item of stack) {
        issues.push(`Unclosed bracket '${item.char}' at position ${item.pos}`);
      }
    }

    // --- 2️⃣ Check syntax via Babel parser ---
    try {
      parse(code, {
        sourceType: "module",
        plugins: [
          "jsx",
          "typescript", // Optional, remove if not needed
        ],
      });
    } catch (err) {
      // Babel gives a clear error message and location
      issues.push(`Syntax error: ${err.message}`);
    }

    return issues;
  }

  /**
   * Check for semantic changes between original and fixed code
   * @param {string} originalCode - Original code
   * @param {string} fixedCode - Fixed code
   * @returns {string[]} Array of semantic issue descriptions
   * @private
   */
  checkSemanticChanges(originalCode, fixedCode) {
    const issues = [];

    // Check for significant structural changes
    const originalLines = originalCode.split('\n').length;
    const fixedLines = fixedCode.split('\n').length;

    if (Math.abs(originalLines - fixedLines) > 10) {
      issues.push(`Significant line count change: ${originalLines} -> ${fixedLines}`);
    }

    // Check for removal of important keywords
    const importantKeywords = ['function', 'class', 'const', 'let', 'var', 'if', 'for', 'while'];

    importantKeywords.forEach(keyword => {
      const originalCount = (originalCode.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      const fixedCount = (fixedCode.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;

      if (originalCount !== fixedCount) {
        issues.push(`Keyword '${keyword}' count changed: ${originalCount} -> ${fixedCount}`);
      }
    });

    return issues;
  }

  /**
   * Get validation statistics
   * @returns {Object} Statistics about validations performed
   */
  getStats() {
    return {
      fixHistorySize: this.fixHistory.length,
      snapshotCount: this.codeSnapshots.size,
      lastFixTime: this.fixHistory.length > 0 ? this.fixHistory[this.fixHistory.length - 1].timestamp : null
    };
  }

  /**
   * Clear validation history and snapshots
   */
  clear() {
    this.fixHistory = [];
    this.codeSnapshots.clear();
  }

  /**
   * Export fix history for debugging or analysis
   * @returns {FixHistory[]} Copy of the fix history
   */
  exportHistory() {
    return [...this.fixHistory];
  }
}

export default CodeValidator;
export { CodeValidator };