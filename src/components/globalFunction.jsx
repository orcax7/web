import ContextAnalyzer from './codeFixer/shared/contextAnalyzer.js';
import CodeValidator from './codeFixer/shared/codeValidator.js';

// Create shared instances for utilities
const contextAnalyzer = new ContextAnalyzer();
const codeValidator = new CodeValidator();

/**
 * Extract lines from code based on error information
 * Enhanced with context awareness and validation
 * @param {string} code - The source code
 * @param {Object} error - ESLint error object
 * @returns {string} The extracted line content
 */
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

/**
 * Find quoted names in error messages
 * @param {string} msg - Error message
 * @returns {string|null} The extracted name or null
 */
export const findName = (msg) => {
    const regex = /'([^']*)'/g;
    let match;

    while ((match = regex.exec(msg)) !== null) {
        return match[1];
    }

    return null;
}

/**
 * Extract function node from code using enhanced context-aware analysis
 * @param {string} code - The source code
 * @param {string} indicator - Function identifier or line content
 * @returns {string} The extracted function code
 */
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

/**
 * Extract variable declaration node (enhanced with context awareness)
 * @param {string} code - The source code
 * @param {string} indicator - Variable identifier
 * @returns {Array|string} Array with declaration and line number, or empty string
 */
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

/**
 * Find the end of a function using context-aware bracket matching
 * @param {string} code - The source code
 * @param {number} start - Starting position
 * @returns {number} End position or -1 if not found
 * @private
 */
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

/**
 * Find the end of a variable declaration using context-aware analysis
 * @param {string} code - The source code
 * @param {string} variableName - Variable name to find
 * @returns {Array|string} Array with declaration and line number, or empty string
 * @private
 */
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

/**
 * Add comment markers to each line of input string
 * Enhanced with validation and context awareness
 * @param {string} inputString - Input string to comment
 * @returns {string} String with comment markers added
 */
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

// ============================================================================
// Enhanced Context Analysis Functions using new ContextAnalyzer
// ============================================================================

/**
 * Enhanced context analysis using the new ContextAnalyzer
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {Object} Context information
 */
export const analyzeContext = (code, line, column) => {
    return contextAnalyzer.analyzePosition(code, line, column);
}

/**
 * Backward compatibility function - now uses enhanced context analysis
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {boolean} True if inside string or comment
 */
export const isInsideStringOrComment = (code, line, column) => {
    const context = contextAnalyzer.analyzePosition(code, line, column);
    return context.inString || context.inComment;
}

/**
 * Enhanced function using new ContextAnalyzer capabilities
 * @param {string} code - The source code
 * @param {Object} error - ESLint error object
 * @returns {Object} Safe zone information
 */
export const findSafeFixZone = (code, error) => {
    return contextAnalyzer.findSafeFixZone(code, error);
}

/**
 * Check if position is inside a string literal
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {boolean} True if inside string
 */
export const isInString = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInString(code, position);
}

/**
 * Check if position is inside a comment
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {boolean} True if inside comment
 */
export const isInComment = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInComment(code, position);
}

/**
 * Check if position is inside a regular expression
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {boolean} True if inside regex
 */
export const isInRegex = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInRegex(code, position);
}

/**
 * Check if position is inside a template string
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {boolean} True if inside template string
 */
export const isInTemplateString = (code, line, column) => {
    const position = contextAnalyzer.getAbsolutePosition(code, line, column);
    return contextAnalyzer.isInTemplateString(code, position);
}

// ============================================================================
// Utility Functions for Shared Operations
// ============================================================================

/**
 * Get the shared context analyzer instance
 * @returns {ContextAnalyzer} The shared context analyzer
 */
export const getContextAnalyzer = () => {
    return contextAnalyzer;
}

/**
 * Get the shared code validator instance
 * @returns {CodeValidator} The shared code validator
 */
export const getCodeValidator = () => {
    return codeValidator;
}

/**
 * Convert line/column position to absolute position
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @returns {number} Absolute position (0-based)
 */
export const getAbsolutePosition = (code, line, column) => {
    return contextAnalyzer.getAbsolutePosition(code, line, column);
}

/**
 * Get line content at specified line number
 * @param {string} code - The source code
 * @param {number} line - Line number (1-based)
 * @returns {string} The line content
 */
export const getLineContent = (code, line) => {
    const lines = code.split('\n');
    return lines[line - 1] || '';
}

/**
 * Validate code syntax using the shared validator
 * @param {string} code - The code to validate
 * @returns {Object} Validation result
 */
export const validateCodeSyntax = (code) => {
    return codeValidator.validateSyntax(code);
}

/**
 * Validate semantic correctness between original and fixed code
 * @param {string} originalCode - The original code
 * @param {string} fixedCode - The fixed code
 * @returns {Object} Validation result
 */
export const validateSemanticChanges = (originalCode, fixedCode) => {
    return codeValidator.validateSemantics(originalCode, fixedCode);
}

/**
 * Record a fix operation in the validator history
 * @param {string} ruleId - The rule that was fixed
 * @param {number} line - Line where fix was applied
 * @param {number} column - Column where fix was applied
 * @param {string} originalText - Original text before fix
 * @param {string} fixedText - Text after fix
 */
export const recordFixOperation = (ruleId, line, column, originalText, fixedText) => {
    codeValidator.recordFix(ruleId, line, column, originalText, fixedText);
}

/**
 * Create a code snapshot for later comparison
 * @param {string} code - The code to snapshot
 * @param {string} snapshotId - Identifier for the snapshot
 */
export const createCodeSnapshot = (code, snapshotId) => {
    codeValidator.createSnapshot(code, snapshotId);
}

/**
 * Compare current code with a snapshot
 * @param {string} currentCode - The current code
 * @param {string} snapshotId - Identifier of the snapshot
 * @returns {Object} Comparison result
 */
export const compareWithSnapshot = (currentCode, snapshotId) => {
    return codeValidator.compareWithSnapshot(currentCode, snapshotId);
}

/**
 * Enhanced safe replacement with context validation
 * @param {string} code - Original code
 * @param {number} line - Line number (1-based)
 * @param {number} column - Column number (1-based)
 * @param {number} length - Length of text to replace
 * @param {string} replacement - Replacement text
 * @returns {Object} Result with success status and modified code
 */
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

/**
 * Find all occurrences of a pattern in code with context awareness
 * @param {string} code - The source code
 * @param {RegExp|string} pattern - Pattern to search for
 * @param {Object} options - Search options
 * @returns {Array} Array of match objects with position and context info
 */
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

/**
 * Legacy compatibility wrapper for old isFixAble function
 * @deprecated Use fixerRegistry.getFixableRules() instead
 * @param {string} ruleId - The ESLint rule ID
 * @returns {boolean} True if rule can be fixed
 */
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

/**
 * Clear all cached data and reset utilities
 * Useful for testing and memory management
 */
export const clearUtilityCache = () => {
    contextAnalyzer.clearCache();
    codeValidator.clear();
}

/**
 * Get statistics about utility usage
 * @returns {Object} Statistics from all utilities
 */
export const getUtilityStats = () => {
    return {
        contextAnalyzer: contextAnalyzer.getCacheStats(),
        codeValidator: codeValidator.getStats(),
        timestamp: new Date().toISOString()
    };
}

// ============================================================================
// Migration Guide for Developers
// ============================================================================

/*
MIGRATION NOTES:

1. Context Analysis Functions:
   - All functions now use the enhanced ContextAnalyzer
   - Better accuracy in detecting strings, comments, regex, and templates
   - New functions provide more detailed context information

2. Shared Utilities:
   - getContextAnalyzer() - Access to shared context analyzer instance
   - getCodeValidator() - Access to shared code validator instance
   - Enhanced error handling and validation throughout

3. New Enhanced Functions:
   - safeReplace() - Context-aware text replacement
   - findPatternOccurrences() - Pattern matching with context filtering
   - validateCodeSyntax() - Syntax validation using shared validator
   - validateSemanticChanges() - Semantic validation between code versions

4. Backward Compatibility:
   - All existing functions maintained with enhanced implementations
   - Legacy isFixAble() function provided for compatibility
   - Function signatures unchanged for external dependencies

5. Performance Improvements:
   - Caching in context analyzer for repeated operations
   - Shared instances to reduce memory usage
   - Better error handling to prevent crashes

6. Usage Recommendations:
   - Use new enhanced functions for better reliability
   - Migrate to fixerRegistry for rule management
   - Use shared utilities for consistent behavior across fixers
   - Implement proper error handling in calling code

7. Breaking Changes:
   - None - all changes are backward compatible
   - Deprecation warnings for old patterns
   - Enhanced validation may catch previously undetected issues
*/