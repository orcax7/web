/**
 * @fileoverview Fixer for prefer-for-of ESLint rule
 * Converts traditional for loops to for-of loops when iterating over arrays
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for prefer-for-of rule
 * Converts for(let i=0; i<arr.length; i++) to for(const item of arr)
 */
class PreferForOfFixer extends FixerBase {
  constructor() {
    super('prefer-for-of', 'complex');
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
    // Check if it's a for loop
    return /\bfor\s*\(/.test(line);
  }

  /**
   * Apply the prefer-for-of fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const forLoopInfo = this.extractForLoopInfo(code, error.line);
      
      if (!forLoopInfo) {
        return this.createFailureResult(code, 'Could not parse for loop');
      }

      // Check if this is a simple array iteration pattern
      if (!this.isSimpleArrayIteration(forLoopInfo)) {
        return this.createFailureResult(
          code, 
          'Loop is too complex for automatic conversion',
          ['Only simple array iterations can be converted']
        );
      }

      const forOfLoop = this.convertToForOf(forLoopInfo);
      
      if (!forOfLoop) {
        return this.createFailureResult(code, 'Could not convert to for-of loop');
      }

      const fixedCode = this.replaceForLoop(code, error.line, forLoopInfo, forOfLoop);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode,
        'Converted for loop to for-of loop'
      );

    } catch (error) {
      return this.handleError(error, code, 'prefer-for-of fix');
    }
  }

  /**
   * Extract information about the for loop
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number of the for loop
   * @returns {Object|null} For loop information or null
   * @private
   */
  extractForLoopInfo(code, lineNumber) {
    const lines = code.split('\n');
    let forLoopText = '';
    let startLine = lineNumber;
    let endLine = lineNumber;
    
    // Find the complete for loop (might span multiple lines)
    let braceCount = 0;
    let foundFor = false;
    
    for (let i = lineNumber - 1; i < lines.length; i++) {
      const line = lines[i];
      forLoopText += line + '\n';
      
      if (/\bfor\s*\(/.test(line)) {
        foundFor = true;
      }
      
      // Count braces to find the loop body
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      endLine = i + 1;
      
      // If we found the for and closed all braces, we're done
      if (foundFor && braceCount === 0 && /}/.test(line)) {
        break;
      }
    }

    // Parse the for loop header: for (init; condition; update)
    const forHeaderMatch = forLoopText.match(/for\s*\(\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/);
    
    if (!forHeaderMatch) {
      return null;
    }

    const [, init, condition, update] = forHeaderMatch;
    
    // Extract variable name from init (e.g., "let i = 0" -> "i")
    const initMatch = init.match(/(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*0/);
    if (!initMatch) {
      return null;
    }
    const indexVar = initMatch[1];

    // Extract array name from condition (e.g., "i < arr.length" -> "arr")
    const conditionMatch = condition.match(new RegExp(`${indexVar}\\s*<\\s*([a-zA-Z_$][a-zA-Z0-9_$.]*)(?:\\.length)?`));
    if (!conditionMatch) {
      return null;
    }
    const arrayName = conditionMatch[1].replace(/\.length$/, '');

    // Get the loop body
    const bodyMatch = forLoopText.match(/\{([\s\S]*)\}/);
    const body = bodyMatch ? bodyMatch[1] : '';

    return {
      fullText: forLoopText.trim(),
      startLine,
      endLine,
      indexVar,
      arrayName,
      body,
      init,
      condition,
      update
    };
  }

  /**
   * Check if this is a simple array iteration that can be converted
   * @param {Object} forLoopInfo - For loop information
   * @returns {boolean} True if it's a simple iteration
   * @private
   */
  isSimpleArrayIteration(forLoopInfo) {
    const { indexVar, arrayName, body, update } = forLoopInfo;

    // Check if update is i++ or ++i or i += 1
    const validUpdate = new RegExp(`^\\s*(${indexVar}\\+\\+|\\+\\+${indexVar}|${indexVar}\\s*\\+=\\s*1)\\s*$`);
    if (!validUpdate.test(update)) {
      return false;
    }

    // Check if index is only used for array access
    // Pattern: arr[i] should be the only use of i
    const indexUsagePattern = new RegExp(`\\b${indexVar}\\b`, 'g');
    const indexMatches = body.match(indexUsagePattern) || [];
    
    // Check if all uses are in the form arrayName[indexVar]
    const arrayAccessPattern = new RegExp(`${arrayName}\\[${indexVar}\\]`, 'g');
    const arrayAccessMatches = body.match(arrayAccessPattern) || [];
    
    // If index is used for anything other than array access, it's too complex
    // Allow one extra usage if it's just the array access
    if (indexMatches.length > arrayAccessMatches.length) {
      return false;
    }

    return true;
  }

  /**
   * Convert for loop to for-of loop
   * @param {Object} forLoopInfo - For loop information
   * @returns {string|null} The for-of loop or null
   * @private
   */
  convertToForOf(forLoopInfo) {
    const { indexVar, arrayName, body } = forLoopInfo;

    // Determine the element variable name
    // If array is plural, make it singular (e.g., items -> item)
    let elementVar = this.getElementVarName(arrayName, indexVar);

    // Replace array[index] with element variable in the body
    const arrayAccessPattern = new RegExp(`${arrayName}\\[${indexVar}\\]`, 'g');
    const newBody = body.replace(arrayAccessPattern, elementVar);

    // Build the for-of loop
    return `for (const ${elementVar} of ${arrayName}) {${newBody}}`;
  }

  /**
   * Get a good variable name for the element
   * @param {string} arrayName - Name of the array
   * @param {string} indexVar - Current index variable name
   * @returns {string} Element variable name
   * @private
   */
  getElementVarName(arrayName, indexVar) {
    // Try to make singular from plural
    if (arrayName.endsWith('s') && arrayName.length > 1) {
      return arrayName.slice(0, -1);
    }
    
    // If array name ends with 'List' or 'Array', remove it
    if (arrayName.endsWith('List')) {
      return arrayName.slice(0, -4);
    }
    if (arrayName.endsWith('Array')) {
      return arrayName.slice(0, -5);
    }
    
    // Default: use 'item' or 'element'
    return 'item';
  }

  /**
   * Replace the for loop with for-of loop in the code
   * @param {string} code - The source code
   * @param {number} lineNumber - Starting line number
   * @param {Object} forLoopInfo - For loop information
   * @param {string} forOfLoop - The for-of loop replacement
   * @returns {string} Fixed code
   * @private
   */
  replaceForLoop(code, lineNumber, forLoopInfo, forOfLoop) {
    const lines = code.split('\n');
    
    // Find the exact range of the for loop
    let startIdx = lineNumber - 1;
    let endIdx = startIdx;
    let braceCount = 0;
    let foundFor = false;
    
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      
      if (/\bfor\s*\(/.test(line)) {
        foundFor = true;
      }
      
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      if (foundFor && braceCount === 0 && /}/.test(line)) {
        endIdx = i;
        break;
      }
    }

    // Get indentation from the original for loop line
    const indent = lines[startIdx].match(/^(\s*)/)[1];
    
    // Format the for-of loop with proper indentation
    const formattedForOf = this.formatForOfLoop(forOfLoop, indent);
    
    // Replace the lines
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    
    return [...before, formattedForOf, ...after].join('\n');
  }

  /**
   * Format the for-of loop with proper indentation
   * @param {string} forOfLoop - The for-of loop
   * @param {string} indent - Base indentation
   * @returns {string} Formatted loop
   * @private
   */
  formatForOfLoop(forOfLoop, indent) {
    // Split into header and body
    const match = forOfLoop.match(/^(for\s*\([^)]+\)\s*\{)([\s\S]*)\}$/);
    
    if (!match) {
      return indent + forOfLoop;
    }

    const [, header, body] = match;
    
    // Format body with proper indentation
    const bodyLines = body.split('\n').filter(line => line.trim());
    const formattedBody = bodyLines.map(line => {
      const trimmed = line.trim();
      return trimmed ? indent + '  ' + trimmed : '';
    }).join('\n');

    return `${indent}${header}\n${formattedBody}\n${indent}}`;
  }

  /**
   * Enhanced validation for prefer-for-of fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Check that we added a for-of loop
    const originalForOf = (originalCode.match(/\bfor\s*\([^)]+\bof\b/g) || []).length;
    const fixedForOf = (fixedCode.match(/\bfor\s*\([^)]+\bof\b/g) || []).length;
    
    // Should have at least one more for-of loop
    return fixedForOf > originalForOf;
  }
}

export default PreferForOfFixer;
export { PreferForOfFixer };
