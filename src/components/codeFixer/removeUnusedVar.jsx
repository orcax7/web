import ContextAnalyzer from './shared/contextAnalyzer.js';
import FixerBase from './shared/fixerBase.js';
import CodeValidator from './shared/codeValidator.js';
import { functionNode } from '../globalFunction';

/**
 * Enhanced unused variable remover using the new architecture
 * Handles variable, function, and parameter removal with improved validation
 */
class RemoveUnusedVarFixer extends FixerBase {
  constructor() {
    super('no-unused-vars', 'complex');
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

    // Check if we're in a safe zone for variable removal
    const safeZone = this.contextAnalyzer.findSafeFixZone(code, error);

    if (!safeZone.isSafe) {
      return false;
    }

    // Must be an unused variable error
    return this.isUnusedVariableError(error.message);
  }

  /**
   * Apply the unused variable removal fix
   * @param {string} code - The source code to fix
   * @param {Object} error - The ESLint error to fix
   * @returns {Object} The result of the fix operation
   */
  fix(code, error) {
    const targetLine = this.getLine(code, error.line);
    const category = this.classify(targetLine, error.column - 1, error.endColumn - 1);

    try {
      const context = this.contextAnalyzer.analyzePosition(code, error.line, error.column);

      // Enhanced context checking
      if (context.inString || context.inComment || context.inRegex) {
        return this.createFailureResult(code, `Cannot remove variables inside ${this.getContextType(context)}`);
      }

      let fixedCode;
      let operation;

      switch (category) {
        case 'function-parameters':
          fixedCode = this.removeUnusedFunctionArgument(code, error);
          operation = 'function parameter';
          break;
        case 'function-declaration':
          fixedCode = this.removeUnusedFunction(code, error);
          operation = 'function declaration';
          break;
        case 'variable_reassignment':
        case 'variable':
          fixedCode = this.removeUnusedVariable(code, error);
          operation = 'variable declaration';
          break;
        default:
          return this.createFailureResult(code, 'Unknown unused variable type');
      }

      if (fixedCode === code) {
        return this.createFailureResult(code, 'No changes needed or removal not safe');
      }

      // Enhanced validation
      // const syntaxValidation = this.validator.validateSyntax(fixedCode);
      // if (!syntaxValidation.isValid) {
      //   return this.createFailureResult(code, `Removal would create syntax error: ${syntaxValidation.error}`);
      // }

      // Semantic validation to ensure removal doesn't break code
      // const semanticValidation = this.validator.validateSemantics(code, fixedCode);
      // if (!semanticValidation.isValid) {
      //   return this.createFailureResult(code, `Removal would change code semantics: ${semanticValidation.error}`);
      // }

      return this.createSuccessResult(fixedCode, `Removed unused ${operation} successfully`);
    } catch (error) {
      return this.handleError(error, code, 'unused variable removal');
    }
  }

  tokenize(code) {
    const keywords = new Set([
      "function", "let", "const", "var", "return"
    ]);
    const tokens = [];
    let i = 0;

    while (i < code.length) {
      const ch = code[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // identifier or keyword
      if (/[a-zA-Z_$]/.test(ch)) {
        let start = i;
        while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
        const text = code.slice(start, i);
        tokens.push({
          type: keywords.has(text) ? "keyword" : "identifier",
          value: text,
          start,
          end: i
        });
        continue;
      }

      // numbers
      if (/[0-9]/.test(ch)) {
        let start = i;
        while (i < code.length && /[0-9.]/.test(code[i])) i++;
        tokens.push({ type: "number", value: code.slice(start, i), start, end: i });
        continue;
      }

      // punctuation
      if ("(){}[]=,;=>".includes(ch)) {
        // handle =>
        if (ch === "=" && code[i + 1] === ">") {
          tokens.push({ type: "punct", value: "=>", start: i, end: i + 2 });
          i += 2;
          continue;
        }
        tokens.push({ type: "punct", value: ch, start: i, end: i + 1 });
        i++;
        continue;
      }

      // strings
      if (ch === '"' || ch === "'") {
        let quote = ch;
        let start = i++;
        while (i < code.length && code[i] !== quote) i++;
        i++;
        tokens.push({ type: "string", value: code.slice(start, i), start, end: i });
        continue;
      }

      // other characters
      tokens.push({ type: "other", value: ch, start: i, end: i + 1 });
      i++;
    }

    return tokens;
  }

  findToken(tokens, start, end) {
    return tokens.find(t => t.start <= start && t.end >= end);
  }

  analyzeContext(tokens, index) {
    const target = tokens[index];
    const before = tokens.slice(0, index);

    // Check if inside parameter list (...)
    let depth = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const t = before[i];

      if (t.value === ")") depth++;
      if (t.value === "(") {
        if (depth === 0) {
          const prev = before[i - 1];
          if (prev && prev.type === "keyword" && prev.value === "function") {
            return "function-parameters";
          }
          return "function-parameters"; // arrow function parameter
        }
        depth--;
      }

      // If we reached a function body, stop
      if (t.value === "{" || t.value === "}") break;
    }

    // Variable declaration (let/const/var)
    const prevKeyword = [...before].reverse().find(t => t.type === "keyword");
    if (prevKeyword && ["let", "const", "var"].includes(prevKeyword.value)) {
      return "variable";
    }

    // Function declaration (normal)
    if (before.some(t => t.type === "keyword" && t.value === "function")) {
      return "function-declaration";
    }

    // Arrow function
    if (before.some(t => t.value === "=>")) {
      return "function-declaration";
    }

    // Variable Reassignment: identifier = ...
    const next = tokens[index + 1];
    if (
      next &&
      next.type === "punct" &&
      next.value === "=" &&
      !before.some(t => t.type === "keyword" && ["let", "const", "var"].includes(t.value)) &&
      !before.some(t => t.value === "=>")
    ) {
      return "variable_reassignment";
    }

    return "unknown";
  }

  classify(code, start, end) {
    const tokens = this.tokenize(code);
    const tok = this.findToken(tokens, start, end);
    if (!tok) return "unknown";

    const idx = tokens.indexOf(tok);
    return this.analyzeContext(tokens, idx);
  }

  isUnusedVariableError(message) {
    return message.includes('is defined but never used') ||
      message.includes('is assigned a value but never used') ||
      message.includes('Unused variable') ||
      message.includes('no-unused-vars');
  }

  getContextType(context) {
    if (context.inString) return 'string literal';
    if (context.inComment) return 'comment';
    if (context.inRegex) return 'regular expression';
    if (context.inTemplate) return 'template literal';
    return 'unknown context';
  }

  removeUnusedVariable(code, error) {
    const codeLines = code.split('\n');
    const targetLine = codeLines[error.line - 1];
    const declarationRegex = /^(let|const|var)\s+/;

    if (!declarationRegex.test(targetLine)) {
      // Handle simple reassignment
      const tokens = targetLine.trim().split('=');
      const leftSide = tokens[0]?.trim();

      if (this.isSimpleReassignment(targetLine, leftSide)) {
        codeLines.splice(error.line - 1, 1);
        return codeLines.join('\n');
      }

      return code;
    }

    const keywordMatch = targetLine.match(declarationRegex);
    if (!keywordMatch) return code;

    const keyword = keywordMatch[0];
    const variables = this.parseVariableDeclarations(targetLine.replace(keyword, ''));

    // Find the variable to remove based on error position
    const variableToRemove = this.findVariableAtPosition(targetLine, variables, error.column - 1);

    if (!variableToRemove) return code;

    // Enhanced removal logic
    const updatedVariables = variables.filter(v =>
      this.normalizeVariableName(v) !== this.normalizeVariableName(variableToRemove)
    );

    if (updatedVariables.length === 0) {
      // Remove entire line if no variables remain
      codeLines.splice(error.line - 1, 1);
    } else {
      // Reconstruct declaration
      codeLines[error.line - 1] = `${keyword}${updatedVariables.join(', ')};`;
    }

    return codeLines.join('\n');
  }

  removeUnusedFunctionArgument(code, error) {
    const codeLines = code.split('\n');
    const targetLine = codeLines[error.line - 1];

    const functionInfo = this.analyzeFunctionSignature(targetLine);
    if (!functionInfo) return code;

    const paramToRemove = this.findParameterAtPosition(
      targetLine,
      functionInfo.params,
      error.column - 1
    );

    if (!paramToRemove) return code;

    const updatedParams = functionInfo.params.filter(p =>
      p.trim() !== paramToRemove.trim()
    );

    const updatedLine = this.reconstructFunctionSignature(
      targetLine,
      functionInfo,
      updatedParams
    );

    codeLines[error.line - 1] = updatedLine;
    return codeLines.join('\n');
  }

  removeUnusedFunction(code, error) {
    const targetLine = this.getLine(code, error.line);

    // Use existing functionNode utility but with enhanced validation
    const subCode = functionNode(code, targetLine);

    if (!subCode) return code;

    const startIndex = code.indexOf(subCode);
    if (startIndex === -1) return code;

    const endIndex = startIndex + subCode.length;

    // Enhanced removal with proper cleanup
    let beforeFunction = code.slice(0, startIndex);
    let afterFunction = code.slice(endIndex);

    // Clean up extra whitespace and newlines
    beforeFunction = beforeFunction.replace(/\s+$/, '');
    afterFunction = afterFunction.replace(/^\s+/, '');

    // Ensure proper spacing
    const updatedCode = beforeFunction +
      (beforeFunction && afterFunction ? '\n\n' : '') +
      afterFunction;

    return updatedCode.trim();
  }

  parseVariableDeclarations(declarationPart) {
    const variables = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < declarationPart.length; i++) {
      const char = declarationPart[i];
      const prevChar = i > 0 ? declarationPart[i - 1] : '';

      // Handle string literals
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      if (!inString) {
        // Track nesting depth for objects and arrays
        if (char === '{' || char === '[' || char === '(') {
          depth++;
        } else if (char === '}' || char === ']' || char === ')') {
          depth--;
        } else if (char === ',' && depth === 0) {
          // Found a variable separator at top level
          variables.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      variables.push(current.trim());
    }

    return variables;
  }

  normalizeVariableName(variable) {
    // Extract variable name from declarations like "a = 5" or "{a, b} = obj"
    const assignmentMatch = variable.match(/^([^=]+)/);
    if (assignmentMatch) {
      return assignmentMatch[1].trim();
    }
    return variable.trim();
  }

  analyzeFunctionSignature(line) {
    // Arrow functions
    if (line.includes('=>')) {
      // Arrow function assignments: var/let/const name = (params) => ...
      const arrowAssignmentMatch = /^\s*(const|let|var)\s+\w+\s*=\s*\(([^)]*)\)\s*=>/.exec(line);
      if (arrowAssignmentMatch) {
        const paramString = arrowAssignmentMatch[2];
        return {
          type: 'arrow-assignment',
          params: paramString ? paramString.split(',').map(p => p.trim()).filter(p => p) : [],
          hasParens: true
        };
      }

      // Arrow function assignments (single param): var/let/const name = param => ...
      const arrowSingleAssignmentMatch = /^\s*(const|let|var)\s+\w+\s*=\s*(\w+)\s*=>/.exec(line);
      if (arrowSingleAssignmentMatch) {
        return {
          type: 'arrow-assignment-single',
          params: [arrowSingleAssignmentMatch[2]],
          hasParens: false
        };
      }

      // Callback arrow functions (existing patterns)
      const arrowMultiMatch = /,\s*\(([^)]*)\)\s*=>|^\s*\(([^)]*)\)\s*=>/.exec(line);
      if (arrowMultiMatch) {
        const paramString = arrowMultiMatch[1] || arrowMultiMatch[2];
        return {
          type: 'arrow-multi',
          params: paramString ? paramString.split(',').map(p => p.trim()).filter(p => p) : [],
          hasParens: true
        };
      }

      const arrowSingleMatch = /,\s*(\w+)\s*=>|^\s*(\w+)\s*=>/.exec(line);
      if (arrowSingleMatch) {
        return {
          type: 'arrow-single',
          params: [arrowSingleMatch[1] || arrowSingleMatch[2]],
          hasParens: false
        };
      }
    }

    // Traditional functions
    const funcMatch = /function\s+\w*\s*\(([^)]*)\)/.exec(line);
    if (funcMatch) {
      return {
        type: 'function',
        params: funcMatch[1].split(',').map(p => p.trim()).filter(p => p)
      };
    }

    // Method definitions
    const methodMatch = /\w+\s*\(([^)]*)\)\s*{/.exec(line);
    if (methodMatch) {
      return {
        type: 'method',
        params: methodMatch[1].split(',').map(p => p.trim()).filter(p => p)
      };
    }

    return null;
  }

  reconstructFunctionSignature(originalLine, functionInfo, updatedParams) {
    const newParamString = updatedParams.join(', ');

    switch (functionInfo.type) {
      case 'arrow-assignment':
        // Handle: var/let/const name = (params) => ...
        return originalLine.replace(
          /^\s*(const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>/,
          (match) => {
            const prefix = match.substring(0, match.lastIndexOf('('));
            return `${prefix}(${newParamString}) =>`;
          }
        );

      case 'arrow-assignment-single':
        // Handle: var/let/const name = param => ...
        if (updatedParams.length === 0) {
          return originalLine.replace(
            /^\s*(const|let|var)\s+\w+\s*=\s*\w+\s*=>/,
            (match) => {
              const prefix = match.substring(0, match.lastIndexOf('=', match.lastIndexOf('=') - 1) + 1);
              return `${prefix} () =>`;
            }
          );
        } else if (updatedParams.length === 1) {
          return originalLine.replace(
            /^\s*(const|let|var)\s+\w+\s*=\s*\w+\s*=>/,
            (match) => {
              const prefix = match.substring(0, match.lastIndexOf('=', match.lastIndexOf('=') - 1) + 1);
              return `${prefix} ${updatedParams[0]} =>`;
            }
          );
        } else {
          return originalLine.replace(
            /^\s*(const|let|var)\s+\w+\s*=\s*\w+\s*=>/,
            (match) => {
              const prefix = match.substring(0, match.lastIndexOf('=', match.lastIndexOf('=') - 1) + 1);
              return `${prefix} (${newParamString}) =>`;
            }
          );
        }

      case 'arrow-multi':
        return originalLine.replace(
          /,\s*\(([^)]*)\)\s*=>|^\s*\(([^)]*)\)\s*=>/,
          (match) => match.startsWith(',') ?
            `, (${newParamString}) =>` :
            `(${newParamString}) =>`
        );

      case 'arrow-single':
        if (updatedParams.length === 0) {
          return originalLine.replace(/,\s*\w+\s*=>|^\s*\w+\s*=>/,
            match => match.startsWith(',') ? ', () =>' : '() =>');
        } else if (updatedParams.length === 1) {
          return originalLine.replace(/,\s*\w+\s*=>|^\s*\w+\s*=>/,
            match => match.startsWith(',') ?
              `, ${updatedParams[0]} =>` :
              `${updatedParams[0]} =>`);
        } else {
          return originalLine.replace(/,\s*\w+\s*=>|^\s*\w+\s*=>/,
            match => match.startsWith(',') ?
              `, (${newParamString}) =>` :
              `(${newParamString}) =>`);
        }

      case 'function':
      case 'method':
        return originalLine.replace(/\([^)]*\)/, `(${newParamString})`);

      default:
        return originalLine;
    }
  }

  findParameterAtPosition(line, params, column) {
    if (params.length === 1) {
      return params[0];
    }

    const parenIndex = line.indexOf('(');
    if (parenIndex === -1) return null;

    let currentPos = parenIndex + 1;

    for (const param of params) {
      const paramEnd = currentPos + param.length;

      if (column >= currentPos && column <= paramEnd) {
        return param;
      }

      currentPos = paramEnd + 2; // +2 for ", "
    }

    return null;
  }

  findVariableAtPosition(line, variables, column) {
    const declarationStart = line.search(/^(let|const|var)\s+/) +
      line.match(/^(let|const|var)\s+/)[0].length;

    let currentPos = declarationStart;

    for (const variable of variables) {
      const variableEnd = currentPos + variable.length;

      if (column >= currentPos && column <= variableEnd) {
        return variable;
      }

      currentPos = variableEnd + 2; // +2 for ", "
    }

    return null;
  }

  isSimpleReassignment(lineText, variable) {
    const regex = new RegExp(`^\\s*${variable}\\s*=`);
    return regex.test(lineText.trim());
  }
}

// Create instance and export both class and legacy function
const removeUnusedVarFixer = new RemoveUnusedVarFixer();

// Legacy function for backward compatibility
export const removeUnusedVars = (code, error) => {
  const result = removeUnusedVarFixer.fix(code, error);
  return result.code;
};

// Export the fixer class for use in registry
export { RemoveUnusedVarFixer };
export default RemoveUnusedVarFixer;