import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

class NoConsoleFixer extends FixerBase {
  constructor() {
    super('no-console', 'simple');
    this.contextAnalyzer = new ContextAnalyzer();

    // Configuration for fix
    this.fixMode = 'comment'; // 'remove' or 'comment'
    this.consoleMethods = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'dir', 'time', 'timeEnd'];
  }

  canFix(code, error) {
    if (!super.canFix(code, error)) {
      return false;
    }

    // Check if the position is safe for modification
    const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);
    return safeZone.isSafe;
  }

  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const absolutePos = this.getAbsolutePosition(code, error.line, error.column);

      // Find the console statement
      const consoleInfo = this.findConsoleStatement(code, error, line);

      if (!consoleInfo) {
        return this.createFailureResult(code, 'Could not locate console statement');
      }

      // Apply the appropriate fix based on configuration
      if (this.fixMode === 'remove') {
        return this.removeConsoleStatement(code, consoleInfo);
      } else {
        return this.commentConsoleStatement(code, consoleInfo);
      }

    } catch (error) {
      return this.handleError(error, code, 'no-console fix');
    }
  }

  findConsoleStatement(code, error, line) {
    const absolutePos = this.getAbsolutePosition(code, error.line, error.column);

    // Look for console.method pattern in the line
    const consoleMatch = line.match(/console\.(\w+)/);

    if (!consoleMatch) {
      return null;
    }

    const method = consoleMatch[1];

    if (!this.consoleMethods.includes(method)) {
      return null;
    }

    // Find the full statement boundaries
    const statementInfo = this.findStatementBoundaries(code, error.line, line);

    return {
      method,
      line: error.line,
      lineContent: line,
      statementStart: statementInfo.start,
      statementEnd: statementInfo.end,
      isStandalone: statementInfo.isStandalone
    };
  }

  /**
   * Find the boundaries of the console statement
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number (1-based)
   * @param {string} line - The line content
   * @returns {Object} Statement boundary information
   * @private
   */
  findStatementBoundaries(code, lineNumber, line) {
    const lineStart = this.getAbsolutePosition(code, lineNumber, 1);

    // Check if this is a standalone console statement
    const trimmedLine = line.trim();
    const isStandalone = trimmedLine.startsWith('console.') &&
      (trimmedLine.endsWith(';') || trimmedLine.endsWith(')'));

    if (isStandalone) {
      // For standalone statements, include the entire line
      return {
        start: lineStart,
        end: lineStart + line.length,
        isStandalone: true
      };
    }

    // For inline console statements, find the exact boundaries
    const consoleStart = line.indexOf('console.');
    const statementStart = lineStart + consoleStart;

    // Find the end of the console call
    let statementEnd = this.findConsoleCallEnd(code, statementStart);

    return {
      start: statementStart,
      end: statementEnd,
      isStandalone: false
    };
  }

  /**
   * Find the end of a console call
   * @param {string} code - The source code
   * @param {number} startPos - Start position of console call
   * @returns {number} End position of console call
   * @private
   */
  findConsoleCallEnd(code, startPos) {
    let pos = startPos;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';

    // Skip to the opening parenthesis
    while (pos < code.length && code[pos] !== '(') {
      pos++;
    }

    if (pos >= code.length) {
      return startPos + 10; // Fallback
    }

    // Track parentheses to find the end of the call
    while (pos < code.length) {
      const char = code[pos];

      // Handle string literals
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && code[pos - 1] !== '\\') {
        inString = false;
        stringChar = '';
      }

      // Count parentheses only when not in string
      if (!inString) {
        if (char === '(') {
          parenCount++;
        } else if (char === ')') {
          parenCount--;
          if (parenCount === 0) {
            // Found the end of the console call
            pos++; // Include the closing parenthesis

            // Check for semicolon
            if (pos < code.length && code[pos] === ';') {
              pos++;
            }

            return pos;
          }
        }
      }

      pos++;
    }

    return pos;
  }

  /**
   * Remove the console statement entirely
   * @param {string} code - The source code
   * @param {Object} consoleInfo - Console statement information
   * @returns {FixResult} The result of the fix operation
   * @private
   */
  removeConsoleStatement(code, consoleInfo) {
    let fixedCode;

    if (consoleInfo.isStandalone) {
      // Remove the entire line including newline
      let start = consoleInfo.statementStart;
      let end = consoleInfo.statementEnd;

      // Include the newline character if present
      if (end < code.length && code[end] === '\n') {
        end++;
      }

      fixedCode = this.safeReplace(code, start, end, '');
    } else {
      // Remove just the console call
      fixedCode = this.safeReplace(code, consoleInfo.statementStart, consoleInfo.statementEnd, '');
    }

    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }

    return this.createSuccessResult(fixedCode, `Removed console.${consoleInfo.method} statement`);
  }

  commentConsoleStatement(code, consoleInfo) {
    let fixedCode;

    if (consoleInfo.isStandalone) {
      // Comment out the entire line
      const lineStart = consoleInfo.statementStart;
      const indentMatch = consoleInfo.lineContent.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      const commentedLine = indent + '// ' + consoleInfo.lineContent.trim();

      fixedCode = this.safeReplace(code, lineStart, consoleInfo.statementEnd, commentedLine);
    } else {
      // Comment out just the console call
      const consoleCall = code.slice(consoleInfo.statementStart, consoleInfo.statementEnd);
      const commentedCall = `/* ${consoleCall} */`;

      fixedCode = this.safeReplace(code, consoleInfo.statementStart, consoleInfo.statementEnd, commentedCall);
    }

    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }

    return this.createSuccessResult(fixedCode, `Commented out console.${consoleInfo.method} statement`);
  }

  setFixMode(mode) {
    if (mode === 'remove' || mode === 'comment') {
      this.fixMode = mode;
    } else {
      throw new Error('Fix mode must be either "remove" or "comment"');
    }
  }

  getFixMode() {
    return this.fixMode;
  }

  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    try {
      // If we're removing, ensure console statements are actually reduced
      if (this.fixMode === 'remove') {
        const originalConsoleCount = (originalCode.match(/console\.\w+/g) || []).length;
        const fixedConsoleCount = (fixedCode.match(/console\.\w+/g) || []).length;

        if (fixedConsoleCount >= originalConsoleCount) {
          return false; // Should have fewer console statements
        }
      }

      // If we're commenting, ensure we didn't break comment syntax
      if (this.fixMode === 'comment') {
        // Check for malformed comments
        if (fixedCode.includes('/**/') || fixedCode.includes('// //')) {
          return false;
        }
      }

      // Ensure we didn't create syntax errors with parentheses
      const originalParens = (originalCode.match(/[()]/g) || []).length;
      const fixedParens = (fixedCode.match(/[()]/g) || []).length;

      // Allow for slight differences due to commenting, but not major changes
      if (Math.abs(originalParens - fixedParens) > 2) {
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }
}

export default NoConsoleFixer;
export { NoConsoleFixer };