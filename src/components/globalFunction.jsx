import ContextAnalyzer from './codeFixer/shared/contextAnalyzer.js';
import CodeValidator from './codeFixer/shared/codeValidator.js';

// Create shared instances for utilities
const contextAnalyzer = new ContextAnalyzer();
const codeValidator = new CodeValidator();

export const extractLines = (code, error) => {
    const startLine = error.line;
    const endLine = error.endLine || error.line;

    const lines = code.split('\n');

    // Validate line numbers
    if (startLine < 1 || startLine > lines.length) {
        console.warn(`Invalid line number: ${startLine}`);
        return '';
    }

    // Extract the line(s) - handle both single line and range
    if (endLine && endLine !== startLine) {
        return lines.slice(startLine - 1, endLine).join('\n');
    }

    return lines[startLine - 1] || '';
}

export const findName = (msg) => {
    const regex = /'([^']*)'/g;
    let match;

    while ((match = regex.exec(msg)) !== null) {
        return match[1];
    }

    return null;
}

export const functionNode = (code, indicator) => {
    try {
        const startOfFunc = code.indexOf(indicator);

        if (startOfFunc === -1) {
            console.warn(`Function indicator "${indicator}" not found in code`);
            return '';
        }

        const endOfFunc = findEndOfFunction(code, startOfFunc);

        if (endOfFunc === -1) {
            console.warn(`Could not find end of function starting at position ${startOfFunc}`);
            return indicator; // Return the indicator if we can't find the full function
        }

        const extractedCode = code.substring(startOfFunc, endOfFunc + 1);

        // Validate the extracted code using the code validator
        const validation = codeValidator.validateSyntax(extractedCode);
        if (!validation.isValid) {
            console.warn(`Extracted function code has syntax issues: ${validation.error}`);
            // Return the indicator as fallback
            return indicator;
        }

        return extractedCode;
    } catch (error) {
        console.error('Error in functionNode extraction:', error);
        return indicator; // Return the indicator as fallback
    }
}

export const declarationNode = (code, indicator) => {
    try {
        const extract = findEndOfVariableDeclaration(code, indicator);

        if (typeof extract === 'string' && extract === '') {
            console.warn(`Variable declaration for "${indicator}" not found`);
            return '';
        }

        if (Array.isArray(extract) && extract.length === 2) {
            const [declaration, lineNumber] = extract;

            // Validate the extracted declaration
            const validation = codeValidator.validateSyntax(declaration);
            if (!validation.isValid) {
                console.warn(`Extracted declaration has syntax issues: ${validation.error}`);
            }

            console.log(`Found declaration: ${declaration} at line ${lineNumber}`);
            return extract;
        }

        console.log(extract);
        return extract;
    } catch (error) {
        console.error('Error in declarationNode extraction:', error);
        return '';
    }
}

const findEndOfFunction = (code, start) => {
    let stack = [];

    for (let i = start; i < code.length; i++) {
        const char = code[i];

        // Convert position to line/column for context analysis
        const lines = code.substring(0, i).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        // Use the new context analyzer to check if we're in a safe context
        const context = contextAnalyzer.analyzePosition(code, line, column);

        // Only process structural characters if we're not in strings or comments
        if (!context.inString && !context.inComment) {
            if (char === '{') {
                stack.push('{');
            } else if (char === '}') {
                stack.pop();
                if (stack.length === 0) {
                    return i;
                }
            }
        }
    }

    return -1; // In case no matching closing brace is found
}

const findEndOfVariableDeclaration = (code, variableName) => {
    const varRegex = new RegExp(`\\b(var|let|const)\\s+${variableName}\\b`);
    const match = code.match(varRegex);

    if (!match) {
        return ''; // Variable declaration not found
    }

    // Find the index where the variable declaration starts
    const declarationStartIndex = match.index;
    let declarationEndIndex = declarationStartIndex;

    for (let i = declarationStartIndex; i < code.length; i++) {
        const char = code[i];

        // Convert position to line/column for context analysis
        const lines = code.substring(0, i).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        // Use the new context analyzer to check if we're in a safe context
        const context = contextAnalyzer.analyzePosition(code, line, column);

        // Only process structural characters if we're not in strings or comments
        if (!context.inString && !context.inComment) {
            // Check for the end of the declaration (semicolon or end of line)
            if (char === ';') {
                declarationEndIndex = i + 1;
                break;
            }
        }
    }

    const linesBeforeDeclaration = code.substring(0, declarationStartIndex).split(/\r\n|\r|\n/).length;
    return [code.substring(declarationStartIndex, declarationEndIndex).trim(), linesBeforeDeclaration];
}

export const addCommentsToEachLine = (inputString) => {
    try {
        if (typeof inputString !== 'string') {
            console.warn('addCommentsToEachLine: Input is not a string');
            return '';
        }

        if (inputString.trim() === '') {
            return '';
        }

        // Split the input string into an array of lines
        const lines = inputString.split('\n');

        // Add // to the beginning of each line, preserving existing indentation
        const commentedLines = lines.map(line => {
            // Preserve leading whitespace
            const leadingWhitespace = line.match(/^\s*/)[0];
            const content = line.substring(leadingWhitespace.length);

            if (content === '') {
                return line; // Keep empty lines as-is
            }

            return `${leadingWhitespace}// ${content}`;
        });

        // Join the array of commented lines back into a single string
        const result = commentedLines.join('\n');

        return result;
    } catch (error) {
        console.error('Error in addCommentsToEachLine:', error);
        return inputString; // Return original input as fallback
    }
}

export const analyzeContext = (code, line, column) => {
    return contextAnalyzer.analyzePosition(code, line, column);
}

export const isInsideStringOrComment = (code, line, column) => {
    const context = contextAnalyzer.analyzePosition(code, line, column);
    return context.inString || context.inComment;
}

export const findSafeFixZone = (code, error) => {
    return contextAnalyzer.findSafeFixZone(code, error);
}

export const isInString = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInString(code, position);
}

export const isInComment = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInComment(code, position);
}

export const isInRegex = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInRegex(code, position);
}

export const isInTemplateString = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInTemplateString(code, position);
}

// ============================================================================
// Utility Functions for Shared Operations
// ============================================================================

export const getContextAnalyzer = () => {
    return contextAnalyzer;
}

export const getCodeValidator = () => {
    return codeValidator;
}

export const getAbsolutePosition = (code, line, column) => {
    return contextAnalyzer.getAbsolutePosition(code, line, column);
}

export const getLineContent = (code, line) => {
    const lines = code.split('\n');
    return lines[line - 1] || '';
}

export const validateCodeSyntax = (code) => {
    return codeValidator.validateSyntax(code);
}

export const validateSemanticChanges = (originalCode, fixedCode) => {
    return codeValidator.validateSemantics(originalCode, fixedCode);
}

export const recordFixOperation = (ruleId, line, column, originalText, fixedText) => {
    codeValidator.recordFix(ruleId, line, column, originalText, fixedText);
}

export const createCodeSnapshot = (code, snapshotId) => {
    codeValidator.createSnapshot(code, snapshotId);
}

export const compareWithSnapshot = (currentCode, snapshotId) => {
    return codeValidator.compareWithSnapshot(currentCode, snapshotId);
}

export const safeReplace = (code, line, column, length, replacement) => {
    try {
        // Check if the position is safe for modification
        const safeZone = contextAnalyzer.findSafeFixZone(code, { line, column });

        if (!safeZone.isSafe) {
            return {
                success: false,
                code: code,
                message: `Cannot replace text: ${safeZone.reason}`,
                warnings: ['Position is not safe for modification']
            };
        }

        const absolutePos = contextAnalyzer.getAbsolutePosition(code, line, column);
        const beforeText = code.substring(0, absolutePos);
        const afterText = code.substring(absolutePos + length);
        const newCode = beforeText + replacement + afterText;

        // Validate the result
        const validation = codeValidator.validateSyntax(newCode);
        if (!validation.isValid) {
            return {
                success: false,
                code: code,
                message: `Replacement would create invalid syntax: ${validation.error}`,
                warnings: validation.warnings
            };
        }

        return {
            success: true,
            code: newCode,
            message: 'Text replaced successfully',
            warnings: []
        };
    } catch (error) {
        return {
            success: false,
            code: code,
            message: `Error during replacement: ${error.message}`,
            warnings: ['Unexpected error occurred during text replacement']
        };
    }
}

export const findPatternOccurrences = (code, pattern, options = {}) => {
    const {
        skipStrings = true,
        skipComments = true,
        skipRegex = true,
        skipTemplates = true
    } = options;

    const matches = [];
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
    let match;

    while ((match = regex.exec(code)) !== null) {
        const position = match.index;
        const lines = code.substring(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        const context = contextAnalyzer.analyzePosition(code, line, column);

        // Skip matches in unwanted contexts
        if (skipStrings && context.inString) continue;
        if (skipComments && context.inComment) continue;
        if (skipRegex && context.inRegex) continue;
        if (skipTemplates && context.inTemplate) continue;

        matches.push({
            match: match[0],
            index: position,
            line: line,
            column: column,
            context: context,
            groups: match.slice(1)
        });
    }

    return matches;
}

// ============================================================================
// Legacy Support and Migration Notes
// ============================================================================

export const isFixAble = (ruleId) => {
    console.warn('isFixAble is deprecated. Use fixerRegistry.getFixableRules() instead.');

    // Legacy rule support for backward compatibility
    const legacyRules = [
        'no-unused-vars',
        'eqeqeq',
        'no-extra-semi',
        'no-trailing-spaces',
        'eol-last',
        'semi',
        'quotes',
        'comma-dangle',
        'indent',
        'no-var',
        'prefer-const',
        'no-console',
        'curly',
        'brace-style',
        'space-before-blocks'
    ];

    return legacyRules.includes(ruleId);
}

export const clearUtilityCache = () => {
    contextAnalyzer.clearCache();
    codeValidator.clear();
}

export const getUtilityStats = () => {
    return {
        contextAnalyzer: contextAnalyzer.getCacheStats(),
        codeValidator: codeValidator.getStats(),
        timestamp: new Date().toISOString()
    };
}