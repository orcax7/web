/**
* Enhanced context analyzer for JavaScript code
* Provides comprehensive analysis of code context to ensure safe fixing
*/
class ContextAnalyzer {
  constructor() {
    // Cache for performance optimization
    this.contextCache = new Map();
  }

  analyzePosition(code, line, column) {
    const absolutePos = this.getAbsolutePosition(code, line, column);
    const cacheKey = `${code.length}-${absolutePos}`;

    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey);
    }

    const context = this.analyzeAbsolutePosition(code, absolutePos);
    this.contextCache.set(cacheKey, context);

    return context;
  }

  isInString(code, position) {
    const context = this.analyzeAbsolutePosition(code, position);
    return context.inString;
  }

  isInComment(code, position) {
    const context = this.analyzeAbsolutePosition(code, position);
    return context.inComment;
  }

  isInRegex(code, position) {
    const context = this.analyzeAbsolutePosition(code, position);
    return context.inRegex;
  }

  isInTemplateString(code, position) {
    const context = this.analyzeAbsolutePosition(code, position);
    return context.inTemplate;
  }

  findSafeFixZone(code, error) {
    const context = this.analyzePosition(code, error.line, error.column);

    if (context.inString) {
      return {
        isSafe: false,
        reason: `Position is inside a string literal (${context.stringChar})`,
        context
      };
    }

    if (context.inComment) {
      return {
        isSafe: false,
        reason: `Position is inside a ${context.commentType} comment`,
        context
      };
    }

    if (context.inRegex) {
      return {
        isSafe: false,
        reason: 'Position is inside a regular expression literal',
        context
      };
    }

    if (context.inTemplate && !context.inTemplateExpression) {
      return {
        isSafe: false,
        reason: 'Position is inside template literal text',
        context
      };
    }

    return {
      isSafe: true,
      reason: 'Position is safe for modifications',
      context
    };
  }

  analyzeAbsolutePosition(code, position) {
    const context = {
      inString: false,
      inComment: false,
      inRegex: false,
      inTemplate: false,
      inTemplateExpression: false
    };

    let i = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let inSingleComment = false;
    let inMultiComment = false;
    let inRegex = false;
    let templateDepth = 0;
    let regexContext = false;

    while (i < position && i < code.length) {
      const char = code[i];
      const nextChar = code[i + 1];
      const prevChar = i > 0 ? code[i - 1] : '';

      // Handle escape sequences
      if (char === '\\' && (inSingleQuote || inDoubleQuote || inTemplate || inRegex)) {
        i += 2; // Skip escaped character
        continue;
      }

      // Handle single-line comments
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && !inMultiComment && !inRegex) {
        if (char === '/' && nextChar === '/') {
          inSingleComment = true;
          i += 2;
          continue;
        }
      }

      // End single-line comment at newline
      if (inSingleComment && char === '\n') {
        inSingleComment = false;
      }

      // Handle multi-line comments
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && !inSingleComment && !inRegex) {
        if (char === '/' && nextChar === '*') {
          inMultiComment = true;
          i += 2;
          continue;
        }
      }

      // End multi-line comment
      if (inMultiComment && char === '*' && nextChar === '/') {
        inMultiComment = false;
        i += 2;
        continue;
      }

      // Skip if in any comment
      if (inSingleComment || inMultiComment) {
        i++;
        continue;
      }

      // Handle regular expressions
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && char === '/') {
        // Check if this could be a regex
        if (this.couldBeRegexStart(code, i)) {
          inRegex = true;
          regexContext = true;
        }
      }

      // End regex
      if (inRegex && char === '/' && !this.isEscaped(code, i)) {
        inRegex = false;
        regexContext = false;
      }

      // Handle strings and templates (skip if in regex or comment)
      if (!inRegex) {
        // Single quotes
        if (char === "'" && !inDoubleQuote && !inTemplate) {
          inSingleQuote = !inSingleQuote;
        }

        // Double quotes
        if (char === '"' && !inSingleQuote && !inTemplate) {
          inDoubleQuote = !inDoubleQuote;
        }

        // Template literals
        if (char === '`' && !inSingleQuote && !inDoubleQuote) {
          if (inTemplate) {
            templateDepth--;
            if (templateDepth === 0) {
              inTemplate = false;
            }
          } else {
            inTemplate = true;
            templateDepth = 1;
          }
        }

        // Template expressions
        if (inTemplate && char === '$' && nextChar === '{') {
          templateDepth++;
          i += 2;
          continue;
        }

        if (inTemplate && char === '}' && templateDepth > 1) {
          templateDepth--;
        }
      }

      i++;
    }

    // Set context based on current state
    context.inString = inSingleQuote || inDoubleQuote;
    context.inComment = inSingleComment || inMultiComment;
    context.inRegex = inRegex;
    context.inTemplate = inTemplate;
    context.inTemplateExpression = inTemplate && templateDepth > 1;

    if (context.inString) {
      context.stringChar = inSingleQuote ? "'" : '"';
    }

    if (context.inComment) {
      context.commentType = inSingleComment ? 'single' : 'multi';
    }

    if (context.inTemplate) {
      context.stringChar = '`';
    }

    return context;
  }

  couldBeRegexStart(code, position) {
    // Look backwards to find the previous non-whitespace character
    let i = position - 1;
    while (i >= 0 && /\s/.test(code[i])) {
      i--;
    }

    if (i < 0) return true;

    const prevChar = code[i];

    // Regex can follow these characters/tokens
    const regexPreceders = [
      '(', '[', '{', ',', ';', ':', '!', '&', '|', '?', '+', '-', '*', '/', '%', '=', '<', '>', '^', '~'
    ];

    if (regexPreceders.includes(prevChar)) {
      return true;
    }

    // Check for keywords that can precede regex
    const keywords = ['return', 'throw', 'case', 'in', 'of', 'delete', 'void', 'typeof', 'new', 'instanceof'];

    // Look for keyword before this position
    let wordStart = i;
    while (wordStart >= 0 && /[a-zA-Z_$]/.test(code[wordStart])) {
      wordStart--;
    }

    const word = code.slice(wordStart + 1, i + 1);
    return keywords.includes(word);
  }

  isEscaped(code, position) {
    let escapeCount = 0;
    let i = position - 1;

    while (i >= 0 && code[i] === '\\') {
      escapeCount++;
      i--;
    }

    return escapeCount % 2 === 1;
  }

  getAbsolutePosition(code, line, column) {
    const lines = code.split('\n');
    let position = 0;

    for (let i = 0; i < line - 1; i++) {
      position += lines[i].length + 1; // +1 for newline character
    }

    return position + column - 1;
  }

  /**
   * Clear the context cache (useful for memory management)
   */
  clearCache() {
    this.contextCache.clear();
  }

  getCacheStats() {
    return {
      size: this.contextCache.size,
      maxSize: 1000 // Could be configurable
    };
  }
}

export default ContextAnalyzer;
export { ContextAnalyzer };