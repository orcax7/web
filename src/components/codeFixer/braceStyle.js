import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for brace-style rule
 * Handles different brace styles: 1tbs (one true brace style), allman, stroustrup
 */
class BraceStyleFixer extends FixerBase {
  constructor() {
    super('brace-style', 'simple');
    this.contextAnalyzer = new ContextAnalyzer();
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

      // Determine the brace style and fix type needed
      const fixInfo = this.determineFix(error.message, code, absolutePos);

      if (!fixInfo) {
        return this.createFailureResult(code, 'Unable to determine brace-style fix type');
      }

      switch (fixInfo.type) {
        case 'move-to-same-line':
          return this.moveBraceToSameLine(code, error, fixInfo);
        case 'move-to-new-line':
          return this.moveBraceToNewLine(code, error, fixInfo);
        case 'fix-else-brace':
          return this.fixElseBraceStyle(code, error, fixInfo);
        default:
          return this.createFailureResult(code, `Unknown fix type: ${fixInfo.type}`);
      }

    } catch (error) {
      return this.handleError(error, code, 'brace-style fix');
    }
  }

  determineFix(message, code, absolutePos) {
    const bracePos = this.findBracePosition(code, absolutePos);

    if (bracePos === -1) {
      return null;
    }

    const fixInfo = {
      bracePos,
      type: null,
      style: this.detectBraceStyle(message)
    };

    if (message.includes('Opening curly brace does not appear on the same line')) {
      fixInfo.type = 'move-to-same-line';
    } else if (message.includes('Opening curly brace appears on the same line')) {
      fixInfo.type = 'move-to-new-line';
    } else if (message.includes('Closing curly brace should be on the same line')) {
      fixInfo.type = 'fix-else-brace';
    } else if (message.includes('Statement inside of curly braces should be on next line')) {
      fixInfo.type = 'move-to-new-line';
    }

    return fixInfo.type ? fixInfo : null;
  }

  detectBraceStyle(message) {
    if (message.includes('1tbs') || message.includes('same line')) {
      return '1tbs';
    } else if (message.includes('allman') || message.includes('new line')) {
      return 'allman';
    } else if (message.includes('stroustrup')) {
      return 'stroustrup';
    }

    // Default to 1tbs if can't determine
    return '1tbs';
  }

  moveBraceToSameLine(code, error, fixInfo) {
    const bracePos = fixInfo.bracePos;

    // Find the end of the previous line
    let prevLineEnd = bracePos - 1;
    while (prevLineEnd >= 0 && code[prevLineEnd] !== '\n') {
      prevLineEnd--;
    }

    if (prevLineEnd < 0) {
      return this.createFailureResult(code, 'Could not find previous line');
    }

    // Find the start of the line containing the brace
    let braceLineStart = bracePos;
    while (braceLineStart > 0 && code[braceLineStart - 1] !== '\n') {
      braceLineStart--;
    }

    // Extract the indentation before the brace
    let indentEnd = braceLineStart;
    while (indentEnd < bracePos && /\s/.test(code[indentEnd])) {
      indentEnd++;
    }

    // Replace the newline and indentation with a single space
    const fixedCode = this.safeReplace(code, prevLineEnd, indentEnd, ' ');

    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }

    return this.createSuccessResult(fixedCode, 'Moved opening brace to same line');
  }

  moveBraceToNewLine(code, error, fixInfo) {
    const bracePos = fixInfo.bracePos;

    // Find the position before the brace (skip any spaces)
    let insertPos = bracePos;
    while (insertPos > 0 && code[insertPos - 1] === ' ') {
      insertPos--;
    }

    // Determine the indentation level
    const indentation = this.getIndentationForBrace(code, bracePos);

    // Insert newline and indentation before the brace
    const replacement = '\n' + indentation;
    const fixedCode = this.safeReplace(code, insertPos, bracePos, replacement + '{');

    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }

    return this.createSuccessResult(fixedCode, 'Moved opening brace to new line');
  }

  fixElseBraceStyle(code, error, fixInfo) {
    // This handles cases where } else { should be on the same line
    const line = this.getLine(code, error.line);
    const lineStart = this.getAbsolutePosition(code, error.line, 1);

    // Look for the pattern of closing brace followed by else
    const elseMatch = line.match(/^(\s*)}(\s*)(else)/);

    if (!elseMatch) {
      return this.createFailureResult(code, 'Could not find else pattern to fix');
    }

    const indentation = elseMatch[1];
    const replacement = indentation + '} else';

    // Replace the entire line with the corrected version
    const lineEnd = lineStart + line.length;
    const fixedCode = this.safeReplace(code, lineStart, lineEnd, replacement);

    if (!this.validate(code, fixedCode)) {
      return this.createFailureResult(code, 'Fix validation failed');
    }

    return this.createSuccessResult(fixedCode, 'Fixed else brace style');
  }

  findBracePosition(code, absolutePos) {
    // Search in a window around the error position
    const searchStart = Math.max(0, absolutePos - 30);
    const searchEnd = Math.min(code.length, absolutePos + 30);

    for (let i = searchStart; i < searchEnd; i++) {
      if (code[i] === '{' || code[i] === '}') {
        // Verify this brace is in a safe context
        if (!this.contextAnalyzer.isInString(code, i) &&
          !this.contextAnalyzer.isInComment(code, i)) {
          return i;
        }
      }
    }

    return -1;
  }

  getIndentationForBrace(code, bracePos) {
    // Find the line that contains the control structure
    let lineStart = bracePos;
    while (lineStart > 0 && code[lineStart - 1] !== '\n') {
      lineStart--;
    }

    // Move to previous line to find the control structure
    if (lineStart > 0) {
      lineStart--; // Move past the newline
      while (lineStart > 0 && code[lineStart - 1] !== '\n') {
        lineStart--;
      }
    }

    // Extract indentation from the control structure line
    let indentEnd = lineStart;
    while (indentEnd < code.length && /[ \t]/.test(code[indentEnd])) {
      indentEnd++;
    }

    return code.slice(lineStart, indentEnd);
  }

  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    try {
      // Check that brace counts remain the same
      const originalOpenBraces = (originalCode.match(/{/g) || []).length;
      const originalCloseBraces = (originalCode.match(/}/g) || []).length;
      const fixedOpenBraces = (fixedCode.match(/{/g) || []).length;
      const fixedCloseBraces = (fixedCode.match(/}/g) || []).length;

      if (originalOpenBraces !== fixedOpenBraces ||
        originalCloseBraces !== fixedCloseBraces) {
        return false;
      }

      // Ensure we didn't create malformed brace patterns
      if (fixedCode.includes('{{') || fixedCode.includes('}}')) {
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }
}

export default BraceStyleFixer;
export { BraceStyleFixer };