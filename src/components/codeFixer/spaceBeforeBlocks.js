/**
 * @fileoverview Fixer for space-before-blocks ESLint rule
 * Ensures consistent spacing before opening braces in control structures and functions
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for space-before-blocks rule
 * Handles spacing before opening braces in if, for, while, function, and object literals
 */
class SpaceBeforeBlocksFixer extends FixerBase {
  constructor() {
    super('space-before-blocks', 'simple');
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
   * Apply the space-before-blocks fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const absolutePos = this.getAbsolutePosition(code, error.line, error.column);
      
      // Determine if we need to add or remove space
      const fixType = this.determineFix(error.message, code, absolutePos);
      
      if (fixType === 'add') {
        return this.addSpaceBeforeBlock(code, error, absolutePos);
      } else if (fixType === 'remove') {
        return this.removeSpaceBeforeBlock(code, error, absolutePos);
      }
      
      return this.createFailureResult(code, 'Unable to determine space-before-blocks fix type');
      
    } catch (error) {
      return this.handleError(error, code, 'space-before-blocks fix');
    }
  }

  /**
   * Determine whether to add or remove space based on error message and context
   * @param {string} message - ESLint error message
   * @param {string} code - The source code
   * @param {number} absolutePos - Absolute position in code
   * @returns {'add'|'remove'|null} The type of fix needed
   * @private
   */
  determineFix(message, code, absolutePos) {
    if (message.includes('Missing space before opening brace') ||
        message.includes('Expected space before')) {
      return 'add';
    }
    
    if (message.includes('Unexpected space before opening brace') ||
        message.includes('Unexpected space before')) {
      return 'remove';
    }
    
    // Analyze the context to determine what's needed
    const bracePos = this.findOpeningBrace(code, absolutePos);
    if (bracePos !== -1) {
      const charBeforeBrace = bracePos > 0 ? code[bracePos - 1] : '';
      
      if (charBeforeBrace === ' ') {
        return 'remove';
      } else if (charBeforeBrace !== ' ' && charBeforeBrace !== '\n' && charBeforeBrace !== '\t') {
        return 'add';
      }
    }
    
    return null;
  }

  /**
   * Add space before opening brace
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {number} absolutePos - Absolute position in code
   * @returns {FixResult} The result of the fix operation
   * @private
   */
  addSpaceBeforeBlock(code, error, absolutePos) {
    const bracePos = this.findOpeningBrace(code, absolutePos);
    
    if (bracePos === -1) {
      return this.createFailureResult(code, 'Could not find opening brace');
    }
    
    // Check if there's already whitespace before the brace
    const charBeforeBrace = bracePos > 0 ? code[bracePos - 1] : '';
    
    if (charBeforeBrace === ' ') {
      return this.createFailureResult(code, 'Space already exists before brace');
    }
    
    // Insert space before the brace
    const fixedCode = this.safeReplace(code, bracePos, bracePos, ' ');
    
    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }
    
    return this.createSuccessResult(fixedCode, 'Added space before opening brace');
  }

  /**
   * Remove space before opening brace
   * @param {string} code - The source code
   * @param {ESLintError} error - The ESLint error
   * @param {number} absolutePos - Absolute position in code
   * @returns {FixResult} The result of the fix operation
   * @private
   */
  removeSpaceBeforeBlock(code, error, absolutePos) {
    const bracePos = this.findOpeningBrace(code, absolutePos);
    
    if (bracePos === -1) {
      return this.createFailureResult(code, 'Could not find opening brace');
    }
    
    // Find and remove spaces before the brace
    let spaceStart = bracePos - 1;
    let spaceCount = 0;
    
    while (spaceStart >= 0 && code[spaceStart] === ' ') {
      spaceCount++;
      spaceStart--;
    }
    
    if (spaceCount === 0) {
      return this.createFailureResult(code, 'No spaces found before brace');
    }
    
    // Remove the spaces
    const fixedCode = this.safeReplace(code, spaceStart + 1, bracePos, '');
    
    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }
    
    return this.createSuccessResult(fixedCode, `Removed ${spaceCount} space(s) before opening brace`);
  }

  /**
   * Find the opening brace near the error position
   * @param {string} code - The source code
   * @param {number} absolutePos - Absolute position to search around
   * @returns {number} Position of opening brace, or -1 if not found
   * @private
   */
  findOpeningBrace(code, absolutePos) {
    // Search in a small window around the error position
    const searchStart = Math.max(0, absolutePos - 20);
    const searchEnd = Math.min(code.length, absolutePos + 20);
    
    for (let i = searchStart; i < searchEnd; i++) {
      if (code[i] === '{') {
        // Verify this brace is in a safe context
        if (!this.contextAnalyzer.isInString(code, i) && 
            !this.contextAnalyzer.isInComment(code, i)) {
          
          // Check if this is the type of brace we're looking for
          if (this.isBlockOpeningBrace(code, i)) {
            return i;
          }
        }
      }
    }
    
    return -1;
  }

  /**
   * Check if a brace at the given position is a block opening brace
   * @param {string} code - The source code
   * @param {number} bracePos - Position of the brace
   * @returns {boolean} True if this is a block opening brace
   * @private
   */
  isBlockOpeningBrace(code, bracePos) {
    // Look backwards to find what precedes this brace
    let pos = bracePos - 1;
    
    // Skip whitespace
    while (pos >= 0 && /\s/.test(code[pos])) {
      pos--;
    }
    
    if (pos < 0) return false;
    
    // Check for control structure keywords or function declarations
    const precedingContext = this.getPrecedingContext(code, pos);
    
    return this.isControlStructureOrFunction(precedingContext);
  }

  /**
   * Get the context that precedes a brace
   * @param {string} code - The source code
   * @param {number} endPos - End position to search backwards from
   * @returns {string} The preceding context
   * @private
   */
  getPrecedingContext(code, endPos) {
    let start = endPos;
    
    // Find the start of the preceding token/keyword
    while (start >= 0 && /[a-zA-Z0-9_$)]/.test(code[start])) {
      start--;
    }
    
    // Extract the context (up to 50 characters for analysis)
    const contextStart = Math.max(0, endPos - 50);
    return code.slice(contextStart, endPos + 1).trim();
  }

  /**
   * Check if the context indicates a control structure or function
   * @param {string} context - The preceding context
   * @returns {boolean} True if this is a control structure or function
   * @private
   */
  isControlStructureOrFunction(context) {
    // Keywords that should have space before opening brace
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally',
      'function', 'class', 'with'
    ];
    
    // Check for exact keyword matches
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(context)) {
        return true;
      }
    }
    
    // Check for function expressions and arrow functions
    if (context.includes('=>') || context.includes('function')) {
      return true;
    }
    
    // Check for closing parenthesis (indicating condition or parameter list)
    if (context.endsWith(')')) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhanced validation for space-before-blocks fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }
    
    // Additional validation: ensure we didn't break the code structure
    try {
      // Check that brace count remains the same
      const originalBraces = (originalCode.match(/{/g) || []).length;
      const fixedBraces = (fixedCode.match(/{/g) || []).length;
      
      if (originalBraces !== fixedBraces) {
        return false;
      }
      
      // Ensure we didn't create invalid spacing patterns
      if (fixedCode.includes('  {') || fixedCode.includes('\t {')) {
        return false; // Multiple spaces or tab+space before brace
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
}

export default SpaceBeforeBlocksFixer;
export { SpaceBeforeBlocksFixer };