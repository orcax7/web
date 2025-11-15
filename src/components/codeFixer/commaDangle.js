/**
 * @fileoverview Fixer for comma-dangle ESLint rule
 * Adds or removes trailing commas in objects and arrays based on ESLint configuration
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for comma-dangle rule
 * Handles trailing commas in objects, arrays, function parameters, and imports/exports
 */
class CommaDangleFixer extends FixerBase {
  constructor() {
    super('comma-dangle', 'simple');
    this.contextAnalyzer = new ContextAnalyzer();
  }

  /**
   * Check if this fixer can handle the given error
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {boolean} True if this fixer can handle the error
   */
  canFix(code, error) {
    if (!super.canFix(code, error)) {
      return false;
    }

    // Check if the position is safe for modification
    const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);
    return safeZone.isSafe;
  }

  /**
   * Apply the comma-dangle fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const absolutePos = this.getAbsolutePosition(code, error.line, error.column);
      
      // Determine if we need to add or remove a comma
      const fixType = this.determineFix(error.message);
      
      if (fixType === 'add') {
        return this.addTrailingComma(code, error, line, absolutePos);
      } else if (fixType === 'remove') {
        return this.removeTrailingComma(code, error, line, absolutePos);
      }
      
      return this.createFailureResult(code, 'Unable to determine comma-dangle fix type');
      
    } catch (error) {
      return this.handleError(error, code, 'comma-dangle fix');
    }
  }

  /**
   * Determine whether to add or remove comma based on error message
   * @param {string} message - ESLint error message
   * @returns {'add'|'remove'|null} The type of fix needed
   * @private
   */
  determineFix(message) {
    if (message.includes('Missing trailing comma') || 
        message.includes('Expected trailing comma')) {
      return 'add';
    }
    
    if (message.includes('Unexpected trailing comma') || 
        message.includes('Trailing comma')) {
      return 'remove';
    }
    
    return null;
  }

  /**
   * Add a trailing comma to the appropriate location
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {string} line - The line content
   * @param {number} absolutePos - Absolute position in code
   * @returns {FixResult} The result of the fix operation
   * @private
   */
  addTrailingComma(code, error, line, absolutePos) {
    // Find the position where comma should be added
    const insertPos = this.findCommaInsertPosition(code, error, line);
    
    if (insertPos === -1) {
      return this.createFailureResult(code, 'Could not find position to insert comma');
    }
    
    const fixedCode = this.safeReplace(code, insertPos, insertPos, ',');
    
    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }
    
    return this.createSuccessResult(fixedCode, 'Added trailing comma');
  }

  /**
   * Remove a trailing comma from the appropriate location
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {string} line - The line content
   * @param {number} absolutePos - Absolute position in code
   * @returns {FixResult} The result of the fix operation
   * @private
   */
  removeTrailingComma(code, error, line, absolutePos) {
    // Find the comma to remove
    const commaPos = this.findCommaRemovePosition(code, error, line);
    
    if (commaPos === -1) {
      return this.createFailureResult(code, 'Could not find comma to remove');
    }
    
    const fixedCode = this.safeReplace(code, commaPos, commaPos + 1, '');
    
    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }
    
    return this.createSuccessResult(fixedCode, 'Removed trailing comma');
  }

  /**
   * Find the position where a comma should be inserted
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {string} line - The line content
   * @returns {number} Absolute position to insert comma, or -1 if not found
   * @private
   */
  findCommaInsertPosition(code, error, line) {
    const absolutePos = this.getAbsolutePosition(code, error.line, error.column);
    
    // Look for the last non-whitespace character before closing bracket/brace
    let searchPos = absolutePos;
    let foundPos = -1;
    
    // Search backwards from error position to find the element that needs a comma
    while (searchPos >= 0) {
      const char = code[searchPos];
      
      if (char === '}' || char === ']' || char === ')') {
        // Found closing bracket, look for the last element before it
        foundPos = this.findLastElementPosition(code, searchPos);
        break;
      }
      
      searchPos--;
    }
    
    return foundPos;
  }

  /**
   * Find the position of a comma that should be removed
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {string} line - The line content
   * @returns {number} Absolute position of comma to remove, or -1 if not found
   * @private
   */
  findCommaRemovePosition(code, error, line) {
    const absolutePos = this.getAbsolutePosition(code, error.line, error.column);
    
    // Look for comma near the error position
    let searchStart = Math.max(0, absolutePos - 10);
    let searchEnd = Math.min(code.length, absolutePos + 10);
    
    for (let i = searchStart; i < searchEnd; i++) {
      if (code[i] === ',') {
        // Verify this comma is in a safe context
        if (!this.contextAnalyzer.isInString(code, i) && 
            !this.contextAnalyzer.isInComment(code, i)) {
          
          // Check if this is a trailing comma by looking ahead
          if (this.isTrailingComma(code, i)) {
            return i;
          }
        }
      }
    }
    
    return -1;
  }

  /**
   * Find the position of the last element before a closing bracket
   * @param {string} code - The source code
   * @param {number} closingPos - Position of closing bracket
   * @returns {number} Position after the last element, or -1 if not found
   * @private
   */
  findLastElementPosition(code, closingPos) {
    let pos = closingPos - 1;
    
    // Skip whitespace and newlines
    while (pos >= 0 && /\s/.test(code[pos])) {
      pos--;
    }
    
    if (pos >= 0) {
      return pos + 1; // Position after the last character
    }
    
    return -1;
  }

  /**
   * Check if a comma at the given position is a trailing comma
   * @param {string} code - The source code
   * @param {number} commaPos - Position of the comma
   * @returns {boolean} True if this is a trailing comma
   * @private
   */
  isTrailingComma(code, commaPos) {
    let pos = commaPos + 1;
    
    // Skip whitespace and newlines after comma
    while (pos < code.length && /\s/.test(code[pos])) {
      pos++;
    }
    
    // Check if next non-whitespace character is a closing bracket
    if (pos < code.length) {
      const nextChar = code[pos];
      return nextChar === '}' || nextChar === ']' || nextChar === ')';
    }
    
    return false;
  }

  /**
   * Enhanced validation for comma-dangle fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }
    
    // Additional validation: ensure we didn't break object/array structure
    try {
      // Try to parse as JSON-like structure to catch basic syntax errors
      const originalBrackets = this.countBrackets(originalCode);
      const fixedBrackets = this.countBrackets(fixedCode);
      
      // Bracket counts should remain the same
      return (originalBrackets.curly === fixedBrackets.curly &&
              originalBrackets.square === fixedBrackets.square &&
              originalBrackets.round === fixedBrackets.round);
              
    } catch (error) {
      return false;
    }
  }

  /**
   * Count different types of brackets in code
   * @param {string} code - The source code
   * @returns {Object} Bracket counts
   * @private
   */
  countBrackets(code) {
    const counts = { curly: 0, square: 0, round: 0 };
    
    for (let i = 0; i < code.length; i++) {
      if (!this.contextAnalyzer.isInString(code, i) && 
          !this.contextAnalyzer.isInComment(code, i)) {
        
        switch (code[i]) {
          case '{':
          case '}':
            counts.curly++;
            break;
          case '[':
          case ']':
            counts.square++;
            break;
          case '(':
          case ')':
            counts.round++;
            break;
        }
      }
    }
    
    return counts;
  }
}

export default CommaDangleFixer;
export { CommaDangleFixer };