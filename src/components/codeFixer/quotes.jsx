import ContextAnalyzer from './shared/contextAnalyzer.js';
import FixerBase from './shared/fixerBase.js';

/**
 * Enhanced quotes fixer using the new architecture
 * Handles quote style conversion with improved context awareness
 */
class QuotesFixer extends FixerBase {
  constructor() {
    super('quotes', 'complex');
    this.contextAnalyzer = new ContextAnalyzer();
  }

  /**
   * Check if this fixer can handle the given error
   * @param {string} code - The source code
   * @param {Object} error - The ESLint error to fix
   * @returns {boolean} True if this fixer can handle the error
   */
  canFix(code, error) {
    if (!super.canFix(code, error)) {
      return false;
    }

    // Check if we're in a safe zone for quote fixing
    const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);
    
    // For quotes, we expect to be in a string, but not in comments or regex
    if (safeZone.context.inComment || safeZone.context.inRegex) {
      return false;
    }

    // Must be able to determine target quote style
    const targetQuote = this.getTargetQuoteStyle(error.message);
    return targetQuote !== null;
  }

  /**
   * Apply the quote style fix
   * @param {string} code - The source code to fix
   * @param {Object} error - The ESLint error to fix
   * @returns {Object} The result of the fix operation
   */
  fix(code, error) {
    try {
      const targetQuote = this.getTargetQuoteStyle(error.message);
      if (!targetQuote) {
        return this.createFailureResult(code, 'Could not determine target quote style');
      }

      const context = this.contextAnalyzer.analyzePosition(code, error.line, error.column);
      
      // Enhanced context checking
      if (context.inComment) {
        return this.createFailureResult(code, 'Cannot fix quotes inside comments');
      }

      if (context.inRegex) {
        return this.createFailureResult(code, 'Cannot fix quotes inside regular expressions');
      }

      // Handle template literals specially
      if (context.inTemplate && !context.inTemplateExpression) {
        return this.createFailureResult(code, 'Cannot convert template literal quotes');
      }

      const fixedCode = this.convertQuoteStyle(code, error, targetQuote);
      
      if (fixedCode === code) {
        return this.createFailureResult(code, 'No changes needed or conversion not safe');
      }

      // Validate the fix
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(fixedCode, `Converted to ${targetQuote === '"' ? 'double' : 'single'} quotes`);
    } catch (error) {
      return this.handleError(error, code, 'quote conversion');
    }
  }

  /**
   * Convert quote style in the code
   * @param {string} code - The source code
   * @param {Object} error - The ESLint error
   * @param {string} targetQuote - Target quote character (' or ")
   * @returns {string} Code with converted quotes
   * @private
   */
  convertQuoteStyle(code, error, targetQuote) {
    const lines = code.split('\n');
    const targetLine = lines[error.line - 1];
    
    // Find the string boundaries more accurately
    const stringBounds = this.findStringBounds(targetLine, error.column - 1);
    
    if (!stringBounds) {
      return code;
    }

    const { start, end, currentQuote } = stringBounds;
    const stringContent = targetLine.substring(start + 1, end);
    
    // Enhanced safety checks
    if (!this.canSafelyConvert(stringContent, currentQuote, targetQuote)) {
      return code;
    }

    // Perform the conversion
    const before = targetLine.substring(0, start);
    const after = targetLine.substring(end + 1);
    const convertedContent = this.escapeQuotesInContent(stringContent, currentQuote, targetQuote);
    
    const newLine = before + targetQuote + convertedContent + targetQuote + after;
    lines[error.line - 1] = newLine;
    
    return lines.join('\n');
  }

  /**
   * Find string boundaries with improved accuracy
   * @param {string} line - The line of code
   * @param {number} column - Column position (0-based)
   * @returns {Object|null} String bounds or null if not found
   * @private
   */
  findStringBounds(line, column) {
    // Look for the string that contains the error position
    let inString = false;
    let stringStart = -1;
    let currentQuote = null;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';
      
      // Handle escape sequences
      if (prevChar === '\\') {
        continue;
      }
      
      if ((char === '"' || char === "'") && !inString) {
        // Start of string
        inString = true;
        stringStart = i;
        currentQuote = char;
      } else if (char === currentQuote && inString) {
        // End of string
        if (column >= stringStart && column <= i) {
          return {
            start: stringStart,
            end: i,
            currentQuote
          };
        }
        inString = false;
        stringStart = -1;
        currentQuote = null;
      }
    }
    
    return null;
  }

  /**
   * Check if quote conversion is safe
   * @param {string} content - String content (without quotes)
   * @param {string} currentQuote - Current quote character
   * @param {string} targetQuote - Target quote character
   * @returns {boolean} True if conversion is safe
   * @private
   */
  canSafelyConvert(content, currentQuote, targetQuote) {
    // Don't convert if target quote exists unescaped in content
    const targetQuoteRegex = new RegExp(`(?<!\\\\)\\${targetQuote}`, 'g');
    if (targetQuoteRegex.test(content)) {
      return false;
    }
    
    // Don't convert if it would create ambiguous escaping
    if (content.includes('\\' + targetQuote)) {
      return false;
    }
    
    return true;
  }

  /**
   * Escape quotes in string content during conversion
   * @param {string} content - String content
   * @param {string} currentQuote - Current quote character
   * @param {string} targetQuote - Target quote character
   * @returns {string} Content with properly escaped quotes
   * @private
   */
  escapeQuotesInContent(content, currentQuote, targetQuote) {
    // Remove escaping of current quote type
    const unescapedContent = content.replace(new RegExp(`\\\\\\${currentQuote}`, 'g'), currentQuote);
    
    // Add escaping for target quote type
    const escapedContent = unescapedContent.replace(new RegExp(`\\${targetQuote}`, 'g'), '\\' + targetQuote);
    
    return escapedContent;
  }

  /**
   * Determine target quote style from error message
   * @param {string} message - ESLint error message
   * @returns {string|null} Target quote character or null
   * @private
   */
  getTargetQuoteStyle(message) {
    if (message.includes('single')) {
      return "'";
    } else if (message.includes('double')) {
      return '"';
    }
    
    // Try to extract from message patterns like "Expected single quotes"
    const singleMatch = message.match(/single\s+quote/i);
    const doubleMatch = message.match(/double\s+quote/i);
    
    if (singleMatch) return "'";
    if (doubleMatch) return '"';
    
    return null;
  }
}

// Create instance and export both class and legacy function
const quotesFixer = new QuotesFixer();

// Legacy function for backward compatibility
export const quotes = (code, error) => {
  const result = quotesFixer.fix(code, error);
  return result.code;
};

// Export the fixer class for use in registry
export { QuotesFixer };
export default QuotesFixer;