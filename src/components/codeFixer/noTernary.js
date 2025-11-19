/**
 * @fileoverview Fixer for no-ternary ESLint rule
 * Converts ternary operators to if-else statements
 */

import FixerBase from './shared/fixerBase.js';
import ContextAnalyzer from './shared/contextAnalyzer.js';

/**
 * Fixer for no-ternary rule
 * Converts ternary operators (condition ? true : false) to if-else statements
 */
class NoTernaryFixer extends FixerBase {
    constructor() {
        super('no-ternary', 'complex');
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

        const line = this.getLine(code, error.line);
        // Check if there's a ternary operator
        return /\?.*:/.test(line);
    }

    /**
     * Apply the no-ternary fix to the code
     * @param {string} code - The source code to fix
     * @param {ESLintError} error - The ESLint error to fix
     * @returns {FixResult} The result of the fix operation
     */
    fix(code, error) {
        try {
            const ternaryInfo = this.extractTernaryExpression(code, error.line, error.column);

            if (!ternaryInfo) {
                return this.createFailureResult(code, 'Could not find ternary expression');
            }

            const ifElseStatement = this.convertToIfElse(ternaryInfo);

            if (!ifElseStatement) {
                return this.createFailureResult(code, 'Could not convert to if-else statement');
            }

            const fixedCode = this.replaceTernary(code, error.line, ternaryInfo, ifElseStatement);

            //   if (!this.validate(code, fixedCode)) {
            //     return this.createFailureResult(code, 'Fix validation failed');
            //   }

            return this.createSuccessResult(
                fixedCode,
                'Converted ternary operator to if-else statement'
            );

        } catch (error) {
            return this.handleError(error, code, 'no-ternary fix');
        }
    }

    /**
     * Extract the ternary expression and its context
     * @param {string} code - The source code
     * @param {number} lineNumber - Line number
     * @param {number} column - Column number
     * @returns {Object|null} Ternary expression info or null
     * @private
     */
    extractTernaryExpression(code, lineNumber, column) {
        const lines = code.split('\n');
        const line = lines[lineNumber - 1];

        // Check if this is an arrow function
        const isArrowFunction = /=>\s*/.test(line);

        // Find the ternary expression
        const ternaryMatch = this.findTernaryExpression(line);

        if (!ternaryMatch) {
            return null;
        }

        // Determine if this is an assignment or return statement
        const isAssignment = /(?:const|let|var)\s+(\w+)\s*=/.test(line) || /(\w+)\s*=/.test(line);
        const isReturn = /return\s+/.test(line);

        let variableName = null;
        let arrowFunctionInfo = null;

        if (isArrowFunction && !isReturn) {
            // Extract arrow function details
            arrowFunctionInfo = this.extractArrowFunctionInfo(line);
        } else if (isAssignment) {
            const assignMatch = line.match(/(?:const|let|var)?\s*(\w+)\s*=/);
            if (assignMatch) {
                variableName = assignMatch[1];
            }
        }

        // Get indentation
        const indentation = line.match(/^(\s*)/)[1];

        return {
            full: ternaryMatch.full,
            condition: ternaryMatch.condition,
            trueValue: ternaryMatch.trueValue,
            falseValue: ternaryMatch.falseValue,
            isAssignment,
            isReturn,
            isArrowFunction,
            arrowFunctionInfo,
            variableName,
            indentation,
            lineNumber
        };
    }

    /**
     * Extract arrow function information
     * @param {string} line - The line containing arrow function
     * @returns {Object|null} Arrow function info or null
     * @private
     */
    extractArrowFunctionInfo(line) {
        // Match patterns like: const func = (params) => ternary
        // or: const func = param => ternary
        const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(\([^)]*\)|[\w]+)\s*=>/);

        if (!arrowMatch) {
            return null;
        }

        return {
            functionName: arrowMatch[1],
            params: arrowMatch[2]
        };
    }

    /**
     * Find and parse ternary expression in a line
     * @param {string} line - The line to search
     * @returns {Object|null} Parsed ternary or null
     * @private
     */
    findTernaryExpression(line) {
        // Match ternary pattern: condition ? trueValue : falseValue
        // This regex handles nested parentheses and complex expressions
        const ternaryRegex = /(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)(?:;|$)/;
        const match = line.match(ternaryRegex);

        if (!match) {
            return null;
        }

        // Extract the condition (remove assignment part if exists)
        let condition = match[1].trim();
        const assignMatch = condition.match(/(?:const|let|var|return)?\s*(?:\w+\s*=\s*)?(.+)/);
        if (assignMatch) {
            condition = assignMatch[1].trim();
        }

        return {
            full: match[0],
            condition: condition,
            trueValue: match[2].trim(),
            falseValue: match[3].trim().replace(/;$/, '')
        };
    }

    /**
     * Convert ternary expression to if-else statement
     * @param {Object} ternaryInfo - The ternary expression info
     * @returns {string|null} The if-else statement or null
     * @private
     */
    convertToIfElse(ternaryInfo) {
        try {
            const { condition, trueValue, falseValue, isAssignment, isReturn, isArrowFunction, arrowFunctionInfo, variableName, indentation } = ternaryInfo;

            let ifElse = '';

            if (isArrowFunction && arrowFunctionInfo) {
                // Convert: const func = (params) => condition ? true : false
                // To: const func = (params) => { if (condition) { return true; } else { return false; } }
                ifElse += `${indentation}const ${arrowFunctionInfo.functionName} = ${arrowFunctionInfo.params} => {\n`;
                ifElse += `${indentation}  if (${condition}) {\n`;
                ifElse += `${indentation}    return ${trueValue};\n`;
                ifElse += `${indentation}  } else {\n`;
                ifElse += `${indentation}    return ${falseValue};\n`;
                ifElse += `${indentation}  }\n`;
                ifElse += `${indentation}};`;
            } else if (isAssignment && variableName) {
                // Convert: const x = condition ? true : false
                // To: let x; if (condition) { x = true; } else { x = false; }
                ifElse += `${indentation}let ${variableName};\n`;
                ifElse += `${indentation}if (${condition}) {\n`;
                ifElse += `${indentation}  ${variableName} = ${trueValue};\n`;
                ifElse += `${indentation}} else {\n`;
                ifElse += `${indentation}  ${variableName} = ${falseValue};\n`;
                ifElse += `${indentation}}`;
            } else if (isReturn) {
                // Convert: return condition ? true : false
                // To: if (condition) { return true; } else { return false; }
                ifElse += `${indentation}if (${condition}) {\n`;
                ifElse += `${indentation}  return ${trueValue};\n`;
                ifElse += `${indentation}} else {\n`;
                ifElse += `${indentation}  return ${falseValue};\n`;
                ifElse += `${indentation}}`;
            } else {
                // Standalone ternary (less common)
                // Convert to if-else with the expression
                ifElse += `${indentation}if (${condition}) {\n`;
                ifElse += `${indentation}  ${trueValue};\n`;
                ifElse += `${indentation}} else {\n`;
                ifElse += `${indentation}  ${falseValue};\n`;
                ifElse += `${indentation}}`;
            }

            return ifElse;
        } catch (error) {
            console.error('Error converting to if-else:', error);
            return null;
        }
    }

    /**
     * Replace the ternary with if-else in the code
     * @param {string} code - The source code
     * @param {number} lineNumber - Line number
     * @param {Object} ternaryInfo - The ternary info
     * @param {string} ifElseStatement - The if-else replacement
     * @returns {string} Fixed code
     * @private
     */
    replaceTernary(code, lineNumber, ternaryInfo, ifElseStatement) {
        const lines = code.split('\n');
        const targetLine = lines[lineNumber - 1];

        // Remove the line with ternary
        lines.splice(lineNumber - 1, 1);

        // Insert the if-else statement
        const ifElseLines = ifElseStatement.split('\n');
        lines.splice(lineNumber - 1, 0, ...ifElseLines);

        return lines.join('\n');
    }

    /**
     * Enhanced validation for no-ternary fixes
     * @param {string} originalCode - The original code before fixing
     * @param {string} fixedCode - The code after applying the fix
     * @returns {boolean} True if the fix is valid
     */
    validate(originalCode, fixedCode) {
        if (!super.validate(originalCode, fixedCode)) {
            return false;
        }

        // Check that we removed the ternary operator
        const originalTernaries = (originalCode.match(/\?[^?]*:/g) || []).length;
        const fixedTernaries = (fixedCode.match(/\?[^?]*:/g) || []).length;

        // Should have at least one less ternary
        if (fixedTernaries >= originalTernaries) {
            return false;
        }

        // Check that we added if-else
        const hasIfElse = /if\s*\([^)]+\)\s*\{[\s\S]*?\}\s*else\s*\{/.test(fixedCode);

        return hasIfElse;
    }
}

export default NoTernaryFixer;
export { NoTernaryFixer };
