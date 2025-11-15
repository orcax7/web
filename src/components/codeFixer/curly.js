/**
 * @fileoverview Fixer for curly ESLint rule
 * Adds braces to control statements (if, else, for, while, do-while)
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for curly rule
 * Adds braces to control statements that are missing them
 */
class CurlyFixer extends FixerBase {
  constructor() {
    super('curly', 'complex');
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

    // Ensure we can identify the control statement
    const controlStatement = this.identifyControlStatement(code, error.line);
    return controlStatement !== null;
  }

  /**
   * Apply the curly fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const controlStatement = this.identifyControlStatement(code, error.line);
      
      if (!controlStatement) {
        return this.createFailureResult(code, 'Could not identify control statement');
      }

      const fixedCode = this.addBracesToStatement(code, controlStatement);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode, 
        `Added braces to ${controlStatement.type} statement`
      );

    } catch (error) {
      return this.handleError(error, code, 'curly fix');
    }
  }

  /**
   * Identify the control statement that needs braces
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number of the error
   * @returns {Object|null} Control statement info or null if not found
   * @private
   */
  identifyControlStatement(code, lineNumber) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    // Check for different types of control statements
    const controlPatterns = [
      { type: 'if', pattern: /\bif\s*\([^)]*\)\s*(?!{)/ },
      { type: 'else', pattern: /\belse\s+(?!if\s*\(|{)/ },
      { type: 'else-if', pattern: /\belse\s+if\s*\([^)]*\)\s*(?!{)/ },
      { type: 'for', pattern: /\bfor\s*\([^)]*\)\s*(?!{)/ },
      { type: 'while', pattern: /\bwhile\s*\([^)]*\)\s*(?!{)/ },
      { type: 'do-while', pattern: /\bdo\s+(?!{)/ },
    ];

    for (const { type, pattern } of controlPatterns) {
      const match = targetLine.match(pattern);
      if (match) {
        return {
          type,
          line: lineNumber,
          match: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        };
      }
    }

    // Check previous lines for multi-line control statements
    for (let i = Math.max(0, lineNumber - 3); i < lineNumber; i++) {
      const line = lines[i];
      for (const { type, pattern } of controlPatterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            type,
            line: i + 1,
            match: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            statementLine: lineNumber
          };
        }
      }
    }

    return null;
  }

  /**
   * Add braces to the identified control statement
   * @param {string} code - The source code
   * @param {Object} controlStatement - Control statement info
   * @returns {string} Fixed code with braces added
   * @private
   */
  addBracesToStatement(code, controlStatement) {
    const lines = code.split('\n');
    const statementLine = controlStatement.statementLine || controlStatement.line;
    
    if (controlStatement.type === 'do-while') {
      return this.addBracesToDoWhile(code, controlStatement);
    }
    
    // Find the statement that needs to be wrapped
    const statementInfo = this.findStatementToWrap(lines, statementLine);
    
    if (!statementInfo) {
      throw new Error('Could not find statement to wrap with braces');
    }

    return this.wrapStatementWithBraces(code, controlStatement, statementInfo);
  }

  /**
   * Handle special case for do-while statements
   * @param {string} code - The source code
   * @param {Object} controlStatement - Control statement info
   * @returns {string} Fixed code
   * @private
   */
  addBracesToDoWhile(code, controlStatement) {
    const lines = code.split('\n');
    const doLine = controlStatement.line - 1;
    
    // Find the while part of the do-while
    let whileLine = -1;
    for (let i = doLine + 1; i < lines.length; i++) {
      if (/\bwhile\s*\(/.test(lines[i])) {
        whileLine = i;
        break;
      }
    }
    
    if (whileLine === -1) {
      throw new Error('Could not find while part of do-while statement');
    }

    // Add opening brace after 'do'
    const doLineContent = lines[doLine];
    const doMatch = doLineContent.match(/(\bdo\s*)/);
    if (doMatch) {
      lines[doLine] = doLineContent.replace(/(\bdo\s*)/, '$1{');
    }

    // Add closing brace before 'while'
    const whileLineContent = lines[whileLine];
    const indent = this.getIndentation(whileLineContent);
    lines[whileLine] = indent + '} ' + whileLineContent.trim();

    return lines.join('\n');
  }

  /**
   * Find the statement that needs to be wrapped with braces
   * @param {string[]} lines - Array of code lines
   * @param {number} startLine - Line number to start searching (1-based)
   * @returns {Object|null} Statement info or null if not found
   * @private
   */
  findStatementToWrap(lines, startLine) {
    const startIndex = startLine - 1;
    
    // Look for the next non-empty line that contains the statement
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length === 0) continue; // Skip empty lines
      if (line.startsWith('//') || line.startsWith('/*')) continue; // Skip comments
      
      // Check if this line contains a complete statement
      if (this.isCompleteStatement(line)) {
        return {
          startLine: i + 1,
          endLine: i + 1,
          content: lines[i]
        };
      }
      
      // Handle multi-line statements
      const multiLineStatement = this.findMultiLineStatement(lines, i);
      if (multiLineStatement) {
        return multiLineStatement;
      }
      
      break; // Stop at first non-empty, non-comment line
    }
    
    return null;
  }

  /**
   * Check if a line contains a complete statement
   * @param {string} line - The line to check
   * @returns {boolean} True if line contains a complete statement
   * @private
   */
  isCompleteStatement(line) {
    // Simple heuristics for complete statements
    return (
      line.endsWith(';') ||
      line.includes('return ') ||
      line.includes('break') ||
      line.includes('continue') ||
      line.includes('throw ') ||
      /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*;?\s*$/.test(line) // Function call
    );
  }

  /**
   * Find multi-line statement boundaries
   * @param {string[]} lines - Array of code lines
   * @param {number} startIndex - Starting line index (0-based)
   * @returns {Object|null} Multi-line statement info or null if not found
   * @private
   */
  findMultiLineStatement(lines, startIndex) {
    let braceCount = 0;
    let parenCount = 0;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Count braces and parentheses
      for (const char of line) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
      }
      
      // Check if statement is complete
      if (braceCount === 0 && parenCount === 0 && 
          (line.trim().endsWith(';') || line.trim().endsWith('}'))) {
        endIndex = i;
        break;
      }
      
      // Prevent infinite loops
      if (i - startIndex > 10) break;
    }
    
    if (endIndex > startIndex) {
      return {
        startLine: startIndex + 1,
        endLine: endIndex + 1,
        content: lines.slice(startIndex, endIndex + 1).join('\n')
      };
    }
    
    return null;
  }

  /**
   * Wrap a statement with braces
   * @param {string} code - The source code
   * @param {Object} controlStatement - Control statement info
   * @param {Object} statementInfo - Statement to wrap info
   * @returns {string} Code with braces added
   * @private
   */
  wrapStatementWithBraces(code, controlStatement, statementInfo) {
    const lines = code.split('\n');
    const controlLineIndex = controlStatement.line - 1;
    const statementStartIndex = statementInfo.startLine - 1;
    const statementEndIndex = statementInfo.endLine - 1;
    
    // Get indentation from the control statement
    const controlIndent = this.getIndentation(lines[controlLineIndex]);
    const statementIndent = controlIndent + '  '; // Add 2 spaces for statement
    
    // Add opening brace after control statement
    if (controlLineIndex === statementStartIndex) {
      // Control and statement are on the same line
      const controlLine = lines[controlLineIndex];
      const parts = this.splitControlAndStatement(controlLine, controlStatement);
      lines[controlLineIndex] = parts.control + ' {';
      lines.splice(controlLineIndex + 1, 0, statementIndent + parts.statement);
      lines.splice(controlLineIndex + 2, 0, controlIndent + '}');
    } else {
      // Control and statement are on different lines
      lines[controlLineIndex] += ' {';
      
      // Indent the statement lines
      for (let i = statementStartIndex; i <= statementEndIndex; i++) {
        if (lines[i].trim().length > 0) {
          lines[i] = statementIndent + lines[i].trim();
        }
      }
      
      // Add closing brace
      lines.splice(statementEndIndex + 1, 0, controlIndent + '}');
    }
    
    return lines.join('\n');
  }

  /**
   * Split control statement and following statement on the same line
   * @param {string} line - The line containing both
   * @param {Object} controlStatement - Control statement info
   * @returns {Object} Split parts
   * @private
   */
  splitControlAndStatement(line, controlStatement) {
    const controlEnd = controlStatement.endIndex;
    const control = line.substring(0, controlEnd).trim();
    const statement = line.substring(controlEnd).trim();
    
    return { control, statement };
  }

  /**
   * Get the indentation of a line
   * @param {string} line - The line to analyze
   * @returns {string} The indentation string
   * @private
   */
  getIndentation(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  /**
   * Enhanced validation for curly fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Additional validation: ensure braces were added
    const originalBraceCount = (originalCode.match(/[{}]/g) || []).length;
    const fixedBraceCount = (fixedCode.match(/[{}]/g) || []).length;
    
    // Should have at least 2 more braces (opening and closing)
    return fixedBraceCount >= originalBraceCount + 2;
  }
}

export default CurlyFixer;
export { CurlyFixer };