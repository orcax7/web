/**
 * @fileoverview Fixer for prefer-template ESLint rule
 * Converts string concatenation using + to template literals
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for prefer-template rule
 * Converts string concatenation to template literals
 */
class PreferTemplateFixer extends FixerBase {
  constructor() {
    super('prefer-template', 'complex');
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

    const line = this.getLine(code, error.line);
    // Check if there's string concatenation with +
    return /['"`].*\+|\\+.*['"`]/.test(line);
  }

  /**
   * Apply the prefer-template fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const concatenation = this.extractConcatenation(code, error.line, error.column);
      
      if (!concatenation) {
        return this.createFailureResult(code, 'Could not find string concatenation');
      }

      const templateLiteral = this.convertToTemplateLiteral(concatenation);
      
      if (!templateLiteral) {
        return this.createFailureResult(code, 'Could not convert to template literal');
      }

      const fixedCode = this.replaceConcatenation(code, error.line, concatenation, templateLiteral);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode,
        'Converted string concatenation to template literal'
      );

    } catch (error) {
      return this.handleError(error, code, 'prefer-template fix');
    }
  }

  /**
   * Extract the full concatenation expression from the line
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number
   * @param {number} column - Column number
   * @returns {string|null} The concatenation expression or null
   * @private
   */
  extractConcatenation(code, lineNumber, column) {
    const line = this.getLine(code, lineNumber);
    
    // Find the concatenation expression
    // Look for patterns like: 'string' + variable + 'string'
    const patterns = [
      // Simple: 'str' + var or var + 'str'
      /(['"`][^'"`]*['"`]\s*\+\s*[^+;,)\]}\s]+|[^+;,(\[{\s]+\s*\+\s*['"`][^'"`]*['"`])/,
      // Multiple concatenations
      /(['"`][^'"`]*['"`](?:\s*\+\s*(?:[^+;,)\]}\s]+|['"`][^'"`]*['"`]))+)/,
      // Variable + string + variable
      /([a-zA-Z_$][a-zA-Z0-9_$]*\s*\+\s*['"`][^'"`]*['"`](?:\s*\+\s*[^;,)\]}\s]+)*)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return null;
  }

  /**
   * Convert string concatenation to template literal
   * @param {string} concatenation - The concatenation expression
   * @returns {string|null} The template literal or null
   * @private
   */
  convertToTemplateLiteral(concatenation) {
    try {
      // Remove extra spaces around +
      let expr = concatenation.replace(/\s*\+\s*/g, '+');
      
      // Split by + but respect quotes
      const parts = this.splitConcatenation(expr);
      
      if (parts.length === 0) {
        return null;
      }

      // Build template literal
      let template = '`';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        
        if (this.isStringLiteral(part)) {
          // Remove quotes and add content
          const content = part.slice(1, -1);
          // Escape backticks and ${ in the content
          const escaped = content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
          template += escaped;
        } else {
          // It's a variable or expression
          template += '${' + part + '}';
        }
      }
      
      template += '`';
      
      return template;
    } catch (error) {
      console.error('Error converting to template literal:', error);
      return null;
    }
  }

  /**
   * Split concatenation by + while respecting quotes
   * @param {string} expr - The concatenation expression
   * @returns {string[]} Array of parts
   * @private
   */
  splitConcatenation(expr) {
    const parts = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let depth = 0;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      const prevChar = i > 0 ? expr[i - 1] : '';

      // Handle string boundaries
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
          current += char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
          current += char;
        } else {
          current += char;
        }
        continue;
      }

      // Track parentheses depth
      if (!inString) {
        if (char === '(' || char === '[' || char === '{') {
          depth++;
        } else if (char === ')' || char === ']' || char === '}') {
          depth--;
        }
      }

      // Split on + when not in string and at depth 0
      if (char === '+' && !inString && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Check if a string is a string literal
   * @param {string} str - The string to check
   * @returns {boolean} True if it's a string literal
   * @private
   */
  isStringLiteral(str) {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    );
  }

  /**
   * Replace the concatenation with template literal in the code
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number
   * @param {string} concatenation - The concatenation to replace
   * @param {string} templateLiteral - The template literal replacement
   * @returns {string} Fixed code
   * @private
   */
  replaceConcatenation(code, lineNumber, concatenation, templateLiteral) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    // Escape special regex characters in concatenation
    const escapedConcat = concatenation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedConcat);
    
    const fixedLine = targetLine.replace(regex, templateLiteral);
    lines[lineNumber - 1] = fixedLine;
    
    return lines.join('\n');
  }

  /**
   * Enhanced validation for prefer-template fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Check that we added a template literal
    const originalBackticks = (originalCode.match(/`/g) || []).length;
    const fixedBackticks = (fixedCode.match(/`/g) || []).length;
    
    // Should have at least 2 more backticks (opening and closing)
    return fixedBackticks >= originalBackticks + 2;
  }
}

export default PreferTemplateFixer;
export { PreferTemplateFixer };
