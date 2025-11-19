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

  canFix(code, error) {
    if (error.ruleId !== this.ruleId) {
      return false;
    }

    // Basic validation - subclasses can override for more specific checks
    return this.isValidPosition(code, error.line, error.column);
  }

  fix(code, error) {
    throw new Error(`Fix method must be implemented by ${this.constructor.name}`);
  }

  validate(originalCode, fixedCode) {
    // Basic validation - ensure code is different and still valid JavaScript
    if (originalCode === fixedCode) {
      return false;
    }

    return this.isValidJavaScript(fixedCode);
  }

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

  isValidJavaScript(code) {
    try {
      // Basic syntax check - try to parse as JavaScript
      new Function(code);
      return true;
    } catch (error) {
      return false;
    }
  }

  createSuccessResult(code, message, warnings = []) {
    return {
      success: true,
      code,
      message: message || `Applied ${this.ruleId} fix`,
      warnings
    };
  }

  createFailureResult(originalCode, message, warnings = []) {
    return {
      success: false,
      code: originalCode,
      message: message || `Failed to apply ${this.ruleId} fix`,
      warnings
    };
  }

  safeReplace(code, start, end, replacement) {
    if (start < 0 || end > code.length || start > end) {
      throw new Error('Invalid replacement bounds');
    }

    return code.slice(0, start) + replacement + code.slice(end);
  }

  getAbsolutePosition(code, line, column) {
    const lines = code.split('\n');
    let position = 0;

    for (let i = 0; i < line - 1; i++) {
      position += lines[i].length + 1; // +1 for newline character
    }

    return position + column - 1;
  }

  getLine(code, line) {
    const lines = code.split('\n');
    return lines[line - 1] || '';
  }

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