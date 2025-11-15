/**
 * @fileoverview Fixer for prefer-const ESLint rule
 * Converts let declarations to const for variables that are never reassigned
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for prefer-const rule
 * Analyzes variable usage to determine if let can be safely converted to const
 */
class PreferConstFixer extends FixerBase {
  constructor() {
    super('prefer-const', 'complex');
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

    // Ensure we can find the let declaration
    const line = this.getLine(code, error.line);
    return /\blet\b/.test(line);
  }

  /**
   * Apply the prefer-const fix to the code
   * @param {string} code - The source code to fix
   * @param {ESLintError} error - The ESLint error to fix
   * @returns {FixResult} The result of the fix operation
   */
  fix(code, error) {
    try {
      const line = this.getLine(code, error.line);
      const letDeclaration = this.extractLetDeclaration(line);
      
      if (!letDeclaration) {
        return this.createFailureResult(code, 'Could not find let declaration');
      }

      const variableNames = this.extractVariableNames(letDeclaration);
      const reassignmentAnalysis = this.analyzeReassignments(code, error.line, variableNames);
      
      // Check if any variables are reassigned
      const hasReassignments = variableNames.some(name => 
        reassignmentAnalysis[name] && reassignmentAnalysis[name].isReassigned
      );
      
      if (hasReassignments) {
        return this.createFailureResult(
          code, 
          'Cannot convert to const: variables are reassigned',
          ['Some variables in this declaration are reassigned later']
        );
      }

      const fixedCode = this.applyLetToConstReplacement(code, error.line);
      
      if (!this.validate(code, fixedCode)) {
        return this.createFailureResult(code, 'Fix validation failed');
      }

      return this.createSuccessResult(
        fixedCode, 
        `Converted let to const: ${variableNames.join(', ')}`
      );

    } catch (error) {
      return this.handleError(error, code, 'prefer-const fix');
    }
  }

  /**
   * Extract the let declaration from a line
   * @param {string} line - The line containing the let declaration
   * @returns {string|null} The let declaration or null if not found
   * @private
   */
  extractLetDeclaration(line) {
    const match = line.match(/\blet\s+[^;]+/);
    return match ? match[0] : null;
  }

  /**
   * Extract variable names from a let declaration
   * @param {string} declaration - The let declaration string
   * @returns {string[]} Array of variable names
   * @private
   */
  extractVariableNames(declaration) {
    // Remove 'let' keyword and split by comma
    const withoutLet = declaration.replace(/^\s*let\s+/, '');
    const variables = withoutLet.split(',').map(v => v.trim());
    
    return variables.map(variable => {
      // Handle destructuring assignments
      if (variable.includes('{') || variable.includes('[')) {
        return this.extractDestructuredNames(variable);
      }
      
      // Extract simple variable name (before = if present)
      const match = variable.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      return match ? [match[1]] : [];
    }).flat().filter(name => name.length > 0);
  }

  /**
   * Extract variable names from destructuring assignments
   * @param {string} destructuring - The destructuring pattern
   * @returns {string[]} Array of variable names
   * @private
   */
  extractDestructuredNames(destructuring) {
    const names = [];
    
    // Simple object destructuring: { a, b, c }
    const objectMatch = destructuring.match(/\{\s*([^}]+)\s*\}/);
    if (objectMatch) {
      const props = objectMatch[1].split(',').map(p => p.trim());
      props.forEach(prop => {
        // Handle renamed properties: { a: newName }
        const renamed = prop.match(/^\s*[^:]+:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (renamed) {
          names.push(renamed[1]);
        } else {
          // Simple property: { a }
          const simple = prop.match(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
          if (simple) {
            names.push(simple[1]);
          }
        }
      });
    }
    
    // Simple array destructuring: [a, b, c]
    const arrayMatch = destructuring.match(/\[\s*([^\]]+)\s*\]/);
    if (arrayMatch) {
      const elements = arrayMatch[1].split(',').map(e => e.trim());
      elements.forEach(element => {
        const match = element.match(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match) {
          names.push(match[1]);
        }
      });
    }
    
    return names;
  }

  /**
   * Analyze variable reassignments within scope
   * @param {string} code - The source code
   * @param {number} declarationLine - Line number of the declaration
   * @param {string[]} variableNames - Names of variables to analyze
   * @returns {Object} Reassignment analysis for each variable
   * @private
   */
  analyzeReassignments(code, declarationLine, variableNames) {
    const scope = this.findVariableScope(code, declarationLine);
    const analysis = {};
    
    // Initialize analysis for each variable
    variableNames.forEach(name => {
      analysis[name] = {
        isReassigned: false,
        reassignments: []
      };
    });

    const lines = code.split('\n');
    
    // Analyze lines after the declaration within the scope
    for (let i = declarationLine; i <= scope.end && i < lines.length; i++) {
      const line = lines[i];
      
      variableNames.forEach(varName => {
        // Look for reassignment patterns
        const reassignmentPatterns = [
          new RegExp(`\\b${varName}\\s*=(?!=)`, 'g'), // Simple assignment
          new RegExp(`\\b${varName}\\s*[+\\-*/%&|^]=`, 'g'), // Compound assignment
          new RegExp(`\\+\\+\\s*${varName}\\b`, 'g'), // Pre-increment
          new RegExp(`\\b${varName}\\s*\\+\\+`, 'g'), // Post-increment
          new RegExp(`\\-\\-\\s*${varName}\\b`, 'g'), // Pre-decrement
          new RegExp(`\\b${varName}\\s*\\-\\-`, 'g'), // Post-decrement
        ];
        
        reassignmentPatterns.forEach(pattern => {
          const matches = [...line.matchAll(pattern)];
          
          matches.forEach(match => {
            const position = this.getAbsolutePosition(code, i + 1, match.index + 1);
            
            // Skip if in string or comment
            if (!this.contextAnalyzer.isInString(code, position) &&
                !this.contextAnalyzer.isInComment(code, position)) {
              
              analysis[varName].isReassigned = true;
              analysis[varName].reassignments.push({
                line: i + 1,
                column: match.index + 1,
                type: this.getReassignmentType(match[0])
              });
            }
          });
        });
      });
    }

    return analysis;
  }

  /**
   * Determine the type of reassignment
   * @param {string} matchText - The matched reassignment text
   * @returns {string} Type of reassignment
   * @private
   */
  getReassignmentType(matchText) {
    if (matchText.includes('++')) return 'increment';
    if (matchText.includes('--')) return 'decrement';
    if (matchText.includes('+=')) return 'add-assign';
    if (matchText.includes('-=')) return 'subtract-assign';
    if (matchText.includes('*=')) return 'multiply-assign';
    if (matchText.includes('/=')) return 'divide-assign';
    if (matchText.includes('%=')) return 'modulo-assign';
    if (matchText.includes('&=')) return 'bitwise-and-assign';
    if (matchText.includes('|=')) return 'bitwise-or-assign';
    if (matchText.includes('^=')) return 'bitwise-xor-assign';
    return 'assignment';
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
    let scopeStart = declarationLine - 1;
    let scopeEnd = lines.length - 1;
    let braceLevel = 0;
    let inScope = false;

    // Find the block scope containing the declaration
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Count braces to track scope levels
      for (let j = 0; j < line.length; j++) {
        const position = this.getAbsolutePosition(code, i + 1, j + 1);
        
        if (!this.contextAnalyzer.isInString(code, position) &&
            !this.contextAnalyzer.isInComment(code, position)) {
          
          if (line[j] === '{') {
            if (i < declarationLine - 1) {
              scopeStart = i;
            }
            braceLevel++;
          } else if (line[j] === '}') {
            braceLevel--;
            if (inScope && braceLevel === 0) {
              scopeEnd = i;
              break;
            }
          }
        }
      }
      
      if (i === declarationLine - 1) {
        inScope = true;
      }
    }

    return { start: scopeStart, end: scopeEnd };
  }

  /**
   * Apply the let to const replacement
   * @param {string} code - The source code
   * @param {number} lineNumber - Line number containing the let declaration
   * @returns {string} Fixed code
   * @private
   */
  applyLetToConstReplacement(code, lineNumber) {
    const lines = code.split('\n');
    const targetLine = lines[lineNumber - 1];
    
    // Replace 'let' with 'const'
    const fixedLine = targetLine.replace(/\blet\b/, 'const');
    lines[lineNumber - 1] = fixedLine;
    
    return lines.join('\n');
  }

  /**
   * Enhanced validation for prefer-const fixes
   * @param {string} originalCode - The original code before fixing
   * @param {string} fixedCode - The code after applying the fix
   * @returns {boolean} True if the fix is valid
   */
  validate(originalCode, fixedCode) {
    if (!super.validate(originalCode, fixedCode)) {
      return false;
    }

    // Additional validation: ensure let was actually replaced with const
    const originalLetCount = (originalCode.match(/\blet\b/g) || []).length;
    const fixedLetCount = (fixedCode.match(/\blet\b/g) || []).length;
    
    // Should have one less let declaration
    if (fixedLetCount !== originalLetCount - 1) {
      return false;
    }

    // Ensure const was added
    const constCount = (fixedCode.match(/\bconst\b/g) || []).length;
    const originalConstCount = (originalCode.match(/\bconst\b/g) || []).length;
    
    return constCount > originalConstCount;
  }
}

export default PreferConstFixer;
export { PreferConstFixer };