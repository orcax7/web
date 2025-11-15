/**
 * @fileoverview Base class and interfaces for all ESLint fixers
 * Provides common functionality and standardized patterns for fixer implementations
 */

/**
 * @typedef {Object} FixResult
 * @property {boolean} success - Whether the fix was applied successfully
 * @property {string} code - The fixed code (original code if fix failed)
 * @property {string} [message] - Optional message describing the fix result
 * @property {string[]} [warnings] - Optional warnings about the fix
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
 * Interface for all fixer implementations
 * @interface IFixer
 */

/**
 * @typedef {Object} IFixer
 * @property {string} ruleId - The ESLint rule this fixer handles
 * @property {'simple'|'complex'} complexity - Complexity level of the fixer
 * @property {function(string, ESLintError): boolean} canFix - Check if error can be fixed
 * @property {function(string, ESLintError): FixResult} fix - Apply the fix to the code
 * @property {function(string, string): boolean} validate - Validate the fix result
 */

/**
 * Base class for all ESLint fixers
 * Provides common functionality and standardized error handling
 */
class FixerBase {
  /**
   * @param {string} ruleId - The ESLint rule this fixer handles
   * @param {'simple'|'complex'} complexity - Complexity level of the fixer
   */
  constructor(ruleId, complexity = 'simple') {
    this.ruleId = ruleId;
    this.complexity = complexity;
  }

  /**
   * Check if this fixer can handle the given error
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {boolean} True if this fixer can handle the error
   */
  canFix(code, error) {
    if (error.ruleId !== this.ruleId) {
      return false;
    }
    
    // Basic validation - subclasses can override for more specific checks
    return this.isValidPosition(code, error.line, error.column);
  }

  /**
   * Apply the fix to the code
   * Must be implemented by subclasses
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   * @abstract
   */
  fix(code, error) {
    throw new Error(`Fix method must be implemented by ${this.constructor.name}`);
  }

  /**
   * Validate that the fix was applied correctly
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    // Basic validation - ensure code is different and still valid JavaScript
    if (originalCode === fixedCode) {
      return false;
    }
    
    return this.isValidJavaScript(fixedCode);
  }

  /**
   * Check if the given position in code is valid
   * @param {string} code - The source code
   * @param {number} line - Line number (1-based)
   * @param {number} column - Column number (1-based)
   * @returns {boolean} True if position is valid
   * @protected
   */
  isValidPosition(code, line, column) {
    const lines = code.split('\n');
    
    if (line < 1 || line > lines.length) {
      return false;
    }
    
    const targetLine = lines[line - 1];
    if (column < 1 || column > targetLine.length + 1) {
      return false;
    }
    
    return true;
  }

  /**
   * Basic JavaScript syntax validation
   * @param {string} code - Code to validate
   * @returns {boolean} True if code appears to be valid JavaScript
   * @protected
   */
  isValidJavaScript(code) {
    try {
      // Basic syntax check - try to parse as JavaScript
      new Function(code);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a successful fix result
   * @param {string} code - The fixed code
   * @param {string} [message] - Optional success message
   * @param {string[]} [warnings] - Optional warnings
   * @returns {FixResult} Success result
   * @protected
   */
  createSuccessResult(code, message, warnings = []) {
    return {
      success: true,
      code,
      message: message || `Applied ${this.ruleId} fix`,
      warnings
    };
  }

  /**
   * Create a failed fix result
   * @param {string} originalCode - The original unchanged code
   * @param {string} message - Error message
   * @param {string[]} [warnings] - Optional warnings
   * @returns {FixResult} Failure result
   * @protected
   */
  createFailureResult(originalCode, message, warnings = []) {
    return {
      success: false,
      code: originalCode,
      message: message || `Failed to apply ${this.ruleId} fix`,
      warnings
    };
  }

  /**
   * Safe string replacement with bounds checking
   * @param {string} code - Original code
   * @param {number} start - Start position (0-based)
   * @param {number} end - End position (0-based)
   * @param {string} replacement - Replacement text
   * @returns {string} Modified code
   * @protected
   */
  safeReplace(code, start, end, replacement) {
    if (start < 0 || end > code.length || start > end) {
      throw new Error('Invalid replacement bounds');
    }
    
    return code.slice(0, start) + replacement + code.slice(end);
  }

  /**
   * Convert line/column position to absolute position
   * @param {string} code - The source code
   * @param {number} line - Line number (1-based)
   * @param {number} column - Column number (1-based)
   * @returns {number} Absolute position (0-based)
   * @protected
   */
  getAbsolutePosition(code, line, column) {
    const lines = code.split('\n');
    let position = 0;
    
    for (let i = 0; i < line - 1; i++) {
      position += lines[i].length + 1; // +1 for newline character
    }
    
    return position + column - 1;
  }

  /**
   * Get the line content at the specified line number
   * @param {string} code - The source code
   * @param {number} line - Line number (1-based)
   * @returns {string} The line content
   * @protected
   */
  getLine(code, line) {
    const lines = code.split('\n');
    return lines[line - 1] || '';
  }

  /**
   * Handle errors consistently across all fixers
   * @param {Error} error - The error that occurred
   * @param {string} originalCode - The original code
   * @param {string} context - Context information about where the error occurred
   * @returns {FixResult} Failure result with error information
   * @protected
   */
  handleError(error, originalCode, context = '') {
    const message = `${this.ruleId} fixer error${context ? ` in ${context}` : ''}: ${error.message}`;
    console.warn(message, error);
    
    return this.createFailureResult(originalCode, message, [
      'Fix operation failed due to unexpected error',
      'Original code was preserved'
    ]);
  }
}

export default FixerBase;
export { FixerBase };