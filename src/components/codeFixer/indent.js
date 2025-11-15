/**
 * @fileoverview Fixer for indent ESLint rule
 * Analyzes and corrects code indentation based on detected style and nesting levels
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for indent rule
 * Handles code indentation for nested blocks, arrays, objects, and function parameters
 */
class IndentFixer extends FixerBase {
  constructor() {
    super('indent', 'complex');
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

    // Ensure we can detect the indentation style
    const indentStyle = this.detectIndentationStyle(code);
    return indentStyle !== null;
  }

  /**
   * Apply the indent fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const indentStyle = this.detectIndentationStyle(code);
      if (!indentStyle) {
        return this.createFailureResult(code, 'Could not detect indentation style');
      }

      const line = this.getLine(code, error.line);
      const expectedIndent = this.calculateExpectedIndentation(code, error.line, indentStyle);
      const currentIndent = this.getCurrentIndentation(line);

      if (expectedIndent === currentIndent.length) {
        return this.createFailureResult(code, 'Line already has correct indentation');
      }

      const fixedCode = this.applyIndentationFix(code, error.line, expectedIndent, indentStyle);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode, 
        `Fixed indentation: expected ${expectedIndent} ${indentStyle.type}, got ${currentIndent.length}`
      );

    } catch (error) {
      return this.handleError(error, code, 'indent fix');
    }
  }

  /**
   * Detect the indentation style used in the code
   * @param {string} code - The source code
   * @returns {Object|null} Indentation style info or null if cannot detect
   * @private
   */
  detectIndentationStyle(code) {
    const lines = code.split('\n');
    const indentCounts = { spaces: {}, tabs: 0 };
    let totalIndentedLines = 0;

    for (const line of lines) {
      if (line.trim().length === 0) continue; // Skip empty lines

      const indent = this.getCurrentIndentation(line);
      if (indent.length === 0) continue; // Skip non-indented lines

      totalIndentedLines++;

      if (indent.type === 'tabs') {
        indentCounts.tabs++;
      } else if (indent.type === 'spaces') {
        const spaceCount = indent.length;
        indentCounts.spaces[spaceCount] = (indentCounts.spaces[spaceCount] || 0) + 1;
      }
    }

    if (totalIndentedLines === 0) {
      // Default to 2 spaces if no indented lines found
      return { type: 'spaces', size: 2, unit: '  ' };
    }

    // Determine if tabs or spaces are more common
    if (indentCounts.tabs > totalIndentedLines / 2) {
      return { type: 'tabs', size: 1, unit: '\t' };
    }

    // Find the most common space count that's likely an indent unit
    const spaceCounts = Object.entries(indentCounts.spaces)
      .map(([count, frequency]) => ({ count: parseInt(count), frequency }))
      .sort((a, b) => b.frequency - a.frequency);

    if (spaceCounts.length === 0) {
      return { type: 'spaces', size: 2, unit: '  ' };
    }

    // Look for common indent sizes (2, 4, 8)
    const commonSizes = [2, 4, 8];
    for (const size of commonSizes) {
      if (spaceCounts.some(sc => sc.count % size === 0)) {
        return { type: 'spaces', size, unit: ' '.repeat(size) };
      }
    }

    // Use the most frequent space count as the base unit
    const mostCommon = spaceCounts[0];
    return { 
      type: 'spaces', 
      size: mostCommon.count, 
      unit: ' '.repeat(mostCommon.count) 
    };
  }

  /**
   * Get current indentation of a line
   * @param {string} line - The line to analyze
   * @returns {Object} Indentation info
   * @private
   */
  getCurrentIndentation(line) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    
    if (indent.includes('\t')) {
      return { type: 'tabs', length: indent.length, content: indent };
    } else {
      return { type: 'spaces', length: indent.length, content: indent };
    }
  }

  /**
   * Calculate the expected indentation level for a line
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number (1-based)
   * @param {Object} indentStyle - Detected indentation style
   * @returns {number} Expected indentation level
   * @private
   */
  calculateExpectedIndentation(code, lineNumber, indentStyle) {
    const lines = code.split('\n');
    let indentLevel = 0;
    let inMultiLineExpression = false;
    let multiLineIndentLevel = 0;

    // Analyze lines before the target line to determine nesting level
    for (let i = 0; i < lineNumber - 1; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;

      // Check for opening brackets/braces that increase indent
      const openingCount = this.countOpeningBrackets(line);
      const closingCount = this.countClosingBrackets(line);
      
      indentLevel += openingCount - closingCount;

      // Handle multi-line expressions (arrays, objects, function calls)
      if (this.isMultiLineExpressionStart(line) && !inMultiLineExpression) {
        inMultiLineExpression = true;
        multiLineIndentLevel = indentLevel;
      }

      if (inMultiLineExpression && this.isMultiLineExpressionEnd(line)) {
        inMultiLineExpression = false;
        multiLineIndentLevel = 0;
      }
    }

    // Check if the current line closes brackets
    const currentLine = lines[lineNumber - 1].trim();
    if (this.startsWithClosingBracket(currentLine)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Handle special cases for multi-line expressions
    if (inMultiLineExpression) {
      indentLevel = Math.max(indentLevel, multiLineIndentLevel + 1);
    }

    return Math.max(0, indentLevel) * indentStyle.size;
  }

  /**
   * Count opening brackets in a line
   * @param {string} line - The line to analyze
   * @returns {number} Number of opening brackets
   * @private
   */
  countOpeningBrackets(line) {
    let count = 0;
    const openingChars = ['{', '[', '('];
    
    for (let i = 0; i < line.length; i++) {
      if (openingChars.includes(line[i])) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Count closing brackets in a line
   * @param {string} line - The line to analyze
   * @returns {number} Number of closing brackets
   * @private
   */
  countClosingBrackets(line) {
    let count = 0;
    const closingChars = ['}', ']', ')'];
    
    for (let i = 0; i < line.length; i++) {
      if (closingChars.includes(line[i])) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Check if line starts a multi-line expression
   * @param {string} line - The line to check
   * @returns {boolean} True if starts multi-line expression
   * @private
   */
  isMultiLineExpressionStart(line) {
    // Look for patterns that typically start multi-line expressions
    const patterns = [
      /\{\s*$/, // Object literal starting
      /\[\s*$/, // Array literal starting
      /\(\s*$/, // Function call/expression starting
      /=\s*\{\s*$/, // Assignment to object
      /=\s*\[\s*$/, // Assignment to array
    ];

    return patterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line ends a multi-line expression
   * @param {string} line - The line to check
   * @returns {boolean} True if ends multi-line expression
   * @private
   */
  isMultiLineExpressionEnd(line) {
    return /^\s*[}\])]/.test(line);
  }

  /**
   * Check if line starts with a closing bracket
   * @param {string} line - The line to check
   * @returns {boolean} True if starts with closing bracket
   * @private
   */
  startsWithClosingBracket(line) {
    return /^[}\])]/.test(line);
  }

  /**
   * Apply the indentation fix to a specific line
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number to fix (1-based)
   * @param {number} expectedIndent - Expected indentation level
   * @param {Object} indentStyle - Indentation style to use
   * @returns {string} Fixed code
   * @private
   */
  applyIndentationFix(code, lineNumber, expectedIndent, indentStyle) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    // Remove existing indentation and apply correct indentation
    const trimmedLine = targetLine.replace(/^\s*/, '');
    const newIndent = indentStyle.unit.repeat(expectedIndent / indentStyle.size);
    
    lines[lineNumber - 1] = newIndent + trimmedLine;
    
    return lines.join('\n');
  }

  /**
   * Enhanced validation for indent fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Additional validation: ensure bracket structure is preserved
    try {
      const originalBrackets = this.countAllBrackets(originalCode);
      const fixedBrackets = this.countAllBrackets(fixedCode);
      
      return (originalBrackets.opening === fixedBrackets.opening &&
              originalBrackets.closing === fixedBrackets.closing);
              
    } catch (error) {
      return false;
    }
  }

  /**
   * Count all brackets in code for validation
   * @param {string} code - The source code
   * @returns {Object} Bracket counts
   * @private
   */
  countAllBrackets(code) {
    let opening = 0;
    let closing = 0;
    
    for (let i = 0; i < code.length; i++) {
      if (!this.contextAnalyzer.isInString(code, i) && 
          !this.contextAnalyzer.isInComment(code, i)) {
        
        const char = code[i];
        if (['{', '[', '('].includes(char)) {
          opening++;
        } else if (['}', ']', ')'].includes(char)) {
          closing++;
        }
      }
    }
    
    return { opening, closing };
  }
}

export default IndentFixer;
export { IndentFixer };