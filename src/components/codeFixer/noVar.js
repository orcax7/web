/**
 * @fileoverview Fixer for no-var ESLint rule
 * Converts var declarations to let or const based on variable usage patterns
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for no-var rule
 * Analyzes variable usage to determine whether to convert var to let or const
 */
class NoVarFixer extends FixerBase {
  constructor() {
    super('no-var', 'complex');
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

    // Ensure we can find the var declaration
    const line = this.getLine(code, error.line);
    return /\bvar\b/.test(line);
  }

  /**
   * Apply the no-var fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const varDeclaration = this.extractVarDeclaration(line);
      
      if (!varDeclaration) {
        return this.createFailureResult(code, 'Could not find var declaration');
      }

      const variableNames = this.extractVariableNames(varDeclaration);
      const replacement = this.determineReplacement(code, error.line, variableNames);
      
      const fixedCode = this.applyVarReplacement(code, error.line, replacement);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode, 
        `Converted var to ${replacement}: ${variableNames.join(', ')}`
      );

    } catch (error) {
      return this.handleError(error, code, 'no-var fix');
    }
  }

  /**
   * Extract the var declaration from a line
   * @param {string} line - The line containing the var declaration
   * @returns {string|null} The var declaration or null if not found
   * @private
   */
  extractVarDeclaration(line) {
    const match = line.match(/\bvar\s+[^;]+/);
    return match ? match[0] : null;
  }

  /**
   * Extract variable names from a var declaration
   * @param {string} declaration - The var declaration string
   * @returns {string[]} Array of variable names
   * @private
   */
  extractVariableNames(declaration) {
    // Remove 'var' keyword and split by comma
    const withoutVar = declaration.replace(/^\s*var\s+/, '');
    const variables = withoutVar.split(',').map(v => v.trim());
    
    return variables.map(variable => {
      // Extract just the variable name (before = or destructuring)
      const match = variable.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      return match ? match[1] : variable.split('=')[0].trim();
    }).filter(name => name.length > 0);
  }

  /**
   * Determine whether to use 'let' or 'const' based on variable usage
   * @param {string} code - The source code
   * @param {number} declarationLine - Line number of the declaration
   * @param {string[]} variableNames - Names of variables being declared
   * @returns {'let'|'const'} The replacement keyword
   * @private
   */
  determineReplacement(code, declarationLine, variableNames) {
    // Analyze variable usage in the scope
    const scope = this.findVariableScope(code, declarationLine);
    const usageAnalysis = this.analyzeVariableUsage(code, scope, variableNames);
    
    // If any variable is reassigned, use 'let'
    for (const varName of variableNames) {
      if (usageAnalysis[varName] && usageAnalysis[varName].isReassigned) {
        return 'let';
      }
    }
    
    // If no variables are reassigned, use 'const'
    return 'const';
  }

  /**
   * Find the scope boundaries for variable analysis
   * @param {string} code - The source code
   * @param {number} declarationLine - Line number of the declaration
   * @returns {Object} Scope boundaries
   * @private
   */
  findVariableScope(code, declarationLine) {
    const lines = code.split('\n');
    let scopeStart = 0;
    let scopeEnd = lines.length - 1;
    let braceLevel = 0;
    let foundDeclaration = false;

    // Find the function or block scope containing the declaration
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Count braces to track scope levels
      for (let j = 0; j < line.length; j++) {
        if (!this.contextAnalyzer.isInString(code, this.getAbsolutePosition(code, i + 1, j + 1)) &&
            !this.contextAnalyzer.isInComment(code, this.getAbsolutePosition(code, i + 1, j + 1))) {
          
          if (line[j] === '{') {
            if (!foundDeclaration && i < declarationLine - 1) {
              scopeStart = i;
            }
            braceLevel++;
          } else if (line[j] === '}') {
            braceLevel--;
            if (foundDeclaration && braceLevel === 0) {
              scopeEnd = i;
              break;
            }
          }
        }
      }
      
      if (i === declarationLine - 1) {
        foundDeclaration = true;
      }
    }

    return { start: scopeStart, end: scopeEnd };
  }

  /**
   * Analyze how variables are used within their scope
   * @param {string} code - The source code
   * @param {Object} scope - Scope boundaries
   * @param {string[]} variableNames - Variable names to analyze
   * @returns {Object} Usage analysis for each variable
   * @private
   */
  analyzeVariableUsage(code, scope, variableNames) {
    const lines = code.split('\n');
    const usage = {};
    
    // Initialize usage tracking
    variableNames.forEach(name => {
      usage[name] = {
        isReassigned: false,
        assignments: [],
        references: []
      };
    });

    // Analyze lines within the scope
    for (let i = scope.start; i <= scope.end && i < lines.length; i++) {
      const line = lines[i];
      
      variableNames.forEach(varName => {
        // Look for assignments (excluding the initial declaration)
        const assignmentPattern = new RegExp(`\\b${varName}\\s*[+\\-*/%&|^]?=`, 'g');
        const assignments = [...line.matchAll(assignmentPattern)];
        
        assignments.forEach(match => {
          const position = this.getAbsolutePosition(code, i + 1, match.index + 1);
          
          // Skip if in string or comment
          if (!this.contextAnalyzer.isInString(code, position) &&
              !this.contextAnalyzer.isInComment(code, position)) {
            
            usage[varName].assignments.push({ line: i + 1, column: match.index + 1 });
            
            // If this is not the declaration line, it's a reassignment
            if (i !== scope.start) {
              usage[varName].isReassigned = true;
            }
          }
        });

        // Look for other references
        const referencePattern = new RegExp(`\\b${varName}\\b`, 'g');
        const references = [...line.matchAll(referencePattern)];
        
        references.forEach(match => {
          const position = this.getAbsolutePosition(code, i + 1, match.index + 1);
          
          if (!this.contextAnalyzer.isInString(code, position) &&
              !this.contextAnalyzer.isInComment(code, position)) {
            
            usage[varName].references.push({ line: i + 1, column: match.index + 1 });
          }
        });
      });
    }

    return usage;
  }

  /**
   * Apply the var to let/const replacement
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number containing the var declaration
   * @param {'let'|'const'} replacement - The replacement keyword
   * @returns {string} Fixed code
   * @private
   */
  applyVarReplacement(code, lineNumber, replacement) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    // Replace 'var' with the determined replacement
    const fixedLine = targetLine.replace(/\bvar\b/, replacement);
    lines[lineNumber - 1] = fixedLine;
    
    return lines.join('\n');
  }

  /**
   * Enhanced validation for no-var fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Additional validation: ensure var was actually replaced
    const originalVarCount = (originalCode.match(/\bvar\b/g) || []).length;
    const fixedVarCount = (fixedCode.match(/\bvar\b/g) || []).length;
    
    // Should have one less var declaration
    if (fixedVarCount !== originalVarCount - 1) {
      return false;
    }

    // Ensure let or const was added
    const letConstCount = (fixedCode.match(/\b(let|const)\b/g) || []).length;
    const originalLetConstCount = (originalCode.match(/\b(let|const)\b/g) || []).length;
    
    return letConstCount > originalLetConstCount;
  }
}

export default NoVarFixer;
export { NoVarFixer };