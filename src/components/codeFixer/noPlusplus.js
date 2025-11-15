/**
 * @fileoverview Fixer for no-plusplus ESLint rule
 * Converts unary ++ and -- operators to their += and -= equivalents
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for no-plusplus rule
 * Replaces ++ and -- operators with += 1 and -= 1
 */
class NoPlusPlusFixer extends FixerBase {
  constructor() {
    super('no-plusplus', 'simple');
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
    if (!safeZone.isSafe) {
      return false;
    }

    // Ensure we can find the ++ or -- operator
    const line = this.getLine(code, error.line);
    return /(\+\+|--)/.test(line);
  }

  /**
   * Apply the no-plusplus fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const operatorInfo = this.findUnaryOperator(line, error.column);
      
      if (!operatorInfo) {
        return this.createFailureResult(code, 'Could not find unary operator');
      }

      const fixedCode = this.replaceUnaryOperator(code, error.line, operatorInfo);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode,
        `Replaced ${operatorInfo.operator} with ${operatorInfo.replacement}`
      );

    } catch (error) {
      return this.handleError(error, code, 'no-plusplus fix');
    }
  }

  /**
   * Find the unary operator (++ or --) in the line
   * @param {string} line - The line containing the operator
   * @param {number} column - The column position from the error
   * @returns {Object|null} Operator information or null if not found
   * @private
   */
  findUnaryOperator(line, column) {
    // Try to find ++ or -- near the error column
    const operators = [
      { pattern: /(\w+)\s*\+\+/g, operator: '++', type: 'postfix' },
      { pattern: /\+\+\s*(\w+)/g, operator: '++', type: 'prefix' },
      { pattern: /(\w+)\s*--/g, operator: '--', type: 'postfix' },
      { pattern: /--\s*(\w+)/g, operator: '--', type: 'prefix' }
    ];

    for (const { pattern, operator, type } of operators) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      
      while ((match = pattern.exec(line)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        
        // Check if this match is near the error column
        if (column >= matchStart && column <= matchEnd + 5) {
          const variable = match[1];
          const replacement = operator === '++' ? '+= 1' : '-= 1';
          
          return {
            operator,
            type,
            variable,
            replacement,
            matchStart,
            matchEnd,
            fullMatch: match[0]
          };
        }
      }
    }

    return null;
  }

  /**
   * Replace the unary operator with its equivalent
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number containing the operator
   * @param {Object} operatorInfo - Information about the operator to replace
   * @returns {string} Fixed code
   * @private
   */
  replaceUnaryOperator(code, lineNumber, operatorInfo) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    let fixedLine;
    
    if (operatorInfo.type === 'postfix') {
      // Replace i++ with i += 1
      fixedLine = targetLine.replace(
        new RegExp(`${this.escapeRegex(operatorInfo.variable)}\\s*\\${operatorInfo.operator}`),
        `${operatorInfo.variable} ${operatorInfo.replacement}`
      );
    } else {
      // Replace ++i with i += 1
      fixedLine = targetLine.replace(
        new RegExp(`\\${operatorInfo.operator}\\s*${this.escapeRegex(operatorInfo.variable)}`),
        `${operatorInfo.variable} ${operatorInfo.replacement}`
      );
    }
    
    lines[lineNumber - 1] = fixedLine;
    return lines.join('\n');
  }

  /**
   * Escape special regex characters in a string
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Enhanced validation for no-plusplus fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Count unary operators
    const originalPlusPlus = (originalCode.match(/\+\+/g) || []).length;
    const fixedPlusPlus = (fixedCode.match(/\+\+/g) || []).length;
    const originalMinusMinus = (originalCode.match(/--/g) || []).length;
    const fixedMinusMinus = (fixedCode.match(/--/g) || []).length;
    
    // Should have one less ++ or --
    const totalOriginal = originalPlusPlus + originalMinusMinus;
    const totalFixed = fixedPlusPlus + fixedMinusMinus;
    
    return totalFixed < totalOriginal;
  }
}

export default NoPlusPlusFixer;
export { NoPlusPlusFixer };
