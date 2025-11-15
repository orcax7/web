import ContextAnalyzer from './shared/contextAnalyzer.js';
import FixerBase from './shared/fixerBase.js';
import CodeValidator from './shared/codeValidator.js';

/**
 * Enhanced semicolon fixer using the new architecture
 * Handles semicolon addition/removal with improved context awareness
 */
class SemiFixer extends FixerBase {
  constructor() {
    super('semi', 'simple');
    this.contextAnalyzer = new ContextAnalyzer();
    this.validator = new CodeValidator();
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

    // Check if we're in a safe zone for semicolon fixing
    const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);
    
    if (!safeZone.isSafe) {
      return false;
    }

    // Must be a semicolon-related error
    return this.isSemicolonError(error.message);
  }

  /**
   * Apply the semicolon fix
   * @param {string} code - The source code to fix
   * @param {Object} error - The ESLint error to fix
   * @returns {Object} The result of the fix operation
   */
  fix(code, error) {
    try {
      const context = this.contextAnalyzer.analyzePosition(code, error.line, error.column);
      
      // Enhanced context checking
      if (context.inString || context.inComment || context.inRegex) {
        return this.createFailureResult(code, `Cannot fix semicolons inside ${this.getContextType(context)}`);
      }

      let fixedCode;
      let operation;

      if (this.isMissingSemicolon(error.message)) {
        fixedCode = this.addMissingSemicolon(code, error);
        operation = 'added';
      } else if (this.isExtraSemicolon(error.message)) {
        fixedCode = this.removeExtraSemicolon(code, error);
        operation = 'removed';
      } else {
        return this.createFailureResult(code, 'Unknown semicolon error type');
      }

      if (fixedCode === code) {
        return this.createFailureResult(code, 'No changes needed');
      }

      // Enhanced validation
      const syntaxValidation = this.validator.validateSyntax(fixedCode);
      if (!syntaxValidation.isValid) {
        return this.createFailureResult(code, `Fix would create syntax error: ${syntaxValidation.error}`);
      }

      // Additional semantic validation for semicolon changes
      if (!this.validateSemicolonFix(code, fixedCode, error)) {
        return this.createFailureResult(code, 'Semicolon fix would change code semantics');
      }

      return this.createSuccessResult(fixedCode, `Semicolon ${operation} successfully`);
    } catch (error) {
      return this.handleError(error, code, 'semicolon fixing');
    }
  }

  /**
   * Add missing semicolon with improved logic
   * @param {string} code - The source code
   * @param {Object} error - The ESLint error
   * @returns {string} Code with added semicolon
   * @private
   */
  addMissingSemicolon(code, error) {
    const lines = code.split('\n');
    const targetLine = lines[error.line - 1];
    
    // Find the best position to insert semicolon
    const insertPosition = this.findSemicolonInsertPosition(targetLine, error.column - 1);
    
    if (insertPosition === -1) {
      return code;
    }

    const before = targetLine.substring(0, insertPosition);
    const after = targetLine.substring(insertPosition);
    
    // Handle different insertion scenarios
    let newLine;
    if (after.trim().startsWith('//')) {
      // Insert before comment
      newLine = before.trimEnd() + '; ' + after;
    } else if (after.trim() === '') {
      // Insert at end of line
      newLine = before.trimEnd() + ';';
    } else {
      // Insert in middle of line
      newLine = before + ';' + after;
    }
    
    lines[error.line - 1] = newLine;
    return lines.join('\n');
  }

  /**
   * Remove extra semicolon with improved logic
   * @param {string} code - The source code
   * @param {Object} error - The ESLint error
   * @returns {string} Code with removed semicolon
   * @private
   */
  removeExtraSemicolon(code, error) {
    const lines = code.split('\n');
    const targetLine = lines[error.line - 1];
    const column = error.column - 1;
    
    // Verify there's actually a semicolon at the error position
    if (targetLine[column] !== ';') {
      // Look for semicolon near the error position
      const semicolonPos = this.findNearestSemicolon(targetLine, column);
      if (semicolonPos === -1) {
        return code;
      }
      
      const before = targetLine.substring(0, semicolonPos);
      const after = targetLine.substring(semicolonPos + 1);
      lines[error.line - 1] = before + after;
    } else {
      // Remove semicolon at exact position
      const before = targetLine.substring(0, column);
      const after = targetLine.substring(column + 1);
      lines[error.line - 1] = before + after;
    }
    
    return lines.join('\n');
  }

  /**
   * Find the best position to insert a semicolon
   * @param {string} line - The line of code
   * @param {number} errorColumn - Column where error was reported (0-based)
   * @returns {number} Position to insert semicolon or -1 if not found
   * @private
   */
  findSemicolonInsertPosition(line, errorColumn) {
    // Look for end of statement patterns
    const commentIndex = line.indexOf('//');
    const blockCommentIndex = line.indexOf('/*');
    
    // If there's a comment, insert before it
    if (commentIndex !== -1) {
      return commentIndex;
    }
    
    if (blockCommentIndex !== -1) {
      return blockCommentIndex;
    }
    
    // Look for other statement terminators
    const terminators = ['{', '}', ')', ']'];
    let bestPosition = line.length;
    
    for (const terminator of terminators) {
      const pos = line.lastIndexOf(terminator);
      if (pos > errorColumn && pos < bestPosition) {
        bestPosition = pos + 1;
      }
    }
    
    return bestPosition;
  }

  /**
   * Find nearest semicolon to the error position
   * @param {string} line - The line of code
   * @param {number} column - Column position (0-based)
   * @returns {number} Position of nearest semicolon or -1
   * @private
   */
  findNearestSemicolon(line, column) {
    // Look within a small range around the error position
    const searchRange = 5;
    
    for (let i = Math.max(0, column - searchRange); i <= Math.min(line.length - 1, column + searchRange); i++) {
      if (line[i] === ';') {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Validate that semicolon fix doesn't change semantics
   * @param {string} originalCode - Original code
   * @param {string} fixedCode - Fixed code
   * @param {Object} error - The ESLint error
   * @returns {boolean} True if fix is semantically safe
   * @private
   */
  validateSemicolonFix(originalCode, fixedCode, error) {
    // Check for automatic semicolon insertion (ASI) implications
    const originalLines = originalCode.split('\n');
    const fixedLines = fixedCode.split('\n');
    
    const targetLineIndex = error.line - 1;
    const originalLine = originalLines[targetLineIndex];
    const fixedLine = fixedLines[targetLineIndex];
    
    // Ensure we're not breaking ASI rules
    if (this.wouldBreakASI(originalLine, fixedLine)) {
      return false;
    }
    
    // Check for control structure integrity
    if (this.wouldBreakControlStructure(originalLine, fixedLine)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if fix would break Automatic Semicolon Insertion rules
   * @param {string} originalLine - Original line
   * @param {string} fixedLine - Fixed line
   * @returns {boolean} True if would break ASI
   * @private
   */
  wouldBreakASI(originalLine, fixedLine) {
    // Check for problematic patterns where ASI behavior might change
    const problematicPatterns = [
      /\breturn\s*$/,  // return at end of line
      /\bthrow\s*$/,   // throw at end of line
      /\bbreak\s*$/,   // break at end of line
      /\bcontinue\s*$/ // continue at end of line
    ];
    
    return problematicPatterns.some(pattern => 
      pattern.test(originalLine) && !pattern.test(fixedLine)
    );
  }

  /**
   * Check if fix would break control structure syntax
   * @param {string} originalLine - Original line
   * @param {string} fixedLine - Fixed line
   * @returns {boolean} True if would break control structure
   * @private
   */
  wouldBreakControlStructure(originalLine, fixedLine) {
    // Check for control structures that shouldn't have semicolons
    const controlPatterns = [
      /\bif\s*\([^)]*\)\s*;/,     // if (condition);
      /\bwhile\s*\([^)]*\)\s*;/,  // while (condition);
      /\bfor\s*\([^)]*\)\s*;/     // for (...);
    ];
    
    return controlPatterns.some(pattern => pattern.test(fixedLine));
  }

  /**
   * Check if error message indicates a semicolon-related issue
   * @param {string} message - Error message
   * @returns {boolean} True if semicolon-related
   * @private
   */
  isSemicolonError(message) {
    return this.isMissingSemicolon(message) || this.isExtraSemicolon(message);
  }

  /**
   * Check if error indicates missing semicolon
   * @param {string} message - Error message
   * @returns {boolean} True if missing semicolon
   * @private
   */
  isMissingSemicolon(message) {
    return message.includes('Missing semicolon') || 
           message.includes('Expected ";"') ||
           message.includes('semicolon is required');
  }

  /**
   * Check if error indicates extra semicolon
   * @param {string} message - Error message
   * @returns {boolean} True if extra semicolon
   * @private
   */
  isExtraSemicolon(message) {
    return message.includes('Extra semicolon') ||
           message.includes('Unnecessary semicolon') ||
           message.includes('Unexpected token ";"');
  }

  /**
   * Get context type description for error messages
   * @param {Object} context - Context object
   * @returns {string} Context type description
   * @private
   */
  getContextType(context) {
    if (context.inString) return 'string literal';
    if (context.inComment) return 'comment';
    if (context.inRegex) return 'regular expression';
    if (context.inTemplate) return 'template literal';
    return 'unknown context';
  }
}

// Create instance and export both class and legacy function
const semiFixer = new SemiFixer();

// Legacy function for backward compatibility
export const semi = (code, error) => {
  const result = semiFixer.fix(code, error);
  return result.code;
};

// Export the fixer class for use in registry
export { SemiFixer };
export default SemiFixer;