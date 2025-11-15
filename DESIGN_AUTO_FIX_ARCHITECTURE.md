# Design: Auto-Fix Architecture & Implementation

## Current Architecture Analysis

### Existing Flow
```
User clicks "Apply Fix" 
→ fileUpload.jsx:applyFix(message)
→ Switch statement routes to specific fixer
→ Fixer function processes code
→ Re-lint updated code via API
→ Update UI with new results
```

### Current File Structure
```
src/components/
├── fileUpload.jsx          # Main component with applyFix()
├── globalFunction.jsx      # Utilities + isFixAble()
└── codeFixer/
    ├── removeUnusedVar.jsx # Complex multi-case fixer
    └── eqeqeq.jsx         # Simple regex replacement
```

## Design Patterns

### Pattern 1: Simple Regex Replacement (eqeqeq style)
**Best for**: `no-extra-semi`, `no-trailing-spaces`, `eol-last`
```javascript
export const ruleName = (code, error) => {
  const lines = code.split('\n');
  const targetLine = lines[error.line - 1];
  
  // Apply regex transformation
  const fixedLine = targetLine.replace(/pattern/g, 'replacement');
  
  lines[error.line - 1] = fixedLine;
  return lines.join('\n');
}
```

### Pattern 2: Context-Aware Replacement (removeUnusedVar style)  
**Best for**: `semi`, `quotes`, `comma-dangle`, `indent`
```javascript
export const ruleName = (code, error) => {
  const lines = code.split('\n');
  const targetLine = lines[error.line - 1];
  
  // Analyze context (inside string? comment? etc.)
  const context = analyzeContext(code, error.line, error.column);
  
  if (context.inString || context.inComment) {
    return code; // Don't modify
  }
  
  // Apply smart transformation
  const fixedLine = applyContextualFix(targetLine, error);
  
  lines[error.line - 1] = fixedLine;
  return lines.join('\n');
}
```

## Implementation Strategy

### Phase 1: Foundation Utilities
Create shared utilities in `globalFunction.jsx`:

```javascript
// Context analysis for avoiding fixes inside strings/comments
export const analyzeContext = (code, line, column) => {
  // Returns: { inString: bool, inComment: bool, stringChar: '"'|"'"|"`" }
}

// Safe regex replacement that respects context
export const safeReplace = (line, pattern, replacement, startCol = 0) => {
  // Only replace if not inside string/comment
}

// Line-based vs file-based fix detection
export const getFixScope = (ruleId) => {
  // Returns: 'line' | 'file' | 'block'
}
```

### Phase 2: Individual Rule Implementation

#### 1. `no-extra-semi` (Simplest)
```javascript
export const noExtraSemi = (code, error) => {
  const lines = code.split('\n');
  const line = lines[error.line - 1];
  
  // Remove double semicolons
  const fixed = line.replace(/;;+/g, ';');
  
  lines[error.line - 1] = fixed;
  return lines.join('\n');
}
```

#### 2. `no-trailing-spaces`
```javascript
export const noTrailingSpaces = (code, error) => {
  const lines = code.split('\n');
  const line = lines[error.line - 1];
  
  // Remove trailing whitespace
  const fixed = line.replace(/\s+$/, '');
  
  lines[error.line - 1] = fixed;
  return lines.join('\n');
}
```

#### 3. `eol-last`
```javascript
export const eolLast = (code, error) => {
  // Add newline at end if missing
  if (!code.endsWith('\n')) {
    return code + '\n';
  }
  return code;
}
```

### Phase 3: Integration Updates

#### Update `globalFunction.jsx`
```javascript
export const isFixAble = (ruleId) => {
  const fixableRules = [
    'no-unused-vars',
    'eqeqeq',
    'no-extra-semi',
    'no-trailing-spaces', 
    'eol-last',
    'semi',
    'quotes',
    'comma-dangle',
    'indent'
  ];
  
  return fixableRules.includes(ruleId);
}
```

#### Update `fileUpload.jsx`
```javascript
// Add imports
import { noExtraSemi } from './codeFixer/noExtraSemi';
import { noTrailingSpaces } from './codeFixer/noTrailingSpaces';
import { eolLast } from './codeFixer/eolLast';

// Extend switch statement
const applyFix = async (message) => {
  let updatedCode = selectedFileContent.source;

  switch (message.ruleId) {
    case "no-unused-vars":
      updatedCode = removeUnusedVars(updatedCode, message);
      break;
    case "eqeqeq":
      updatedCode = eqeqeq(updatedCode, message);
      break;
    case "no-extra-semi":
      updatedCode = noExtraSemi(updatedCode, message);
      break;
    case "no-trailing-spaces":
      updatedCode = noTrailingSpaces(updatedCode, message);
      break;
    case "eol-last":
      updatedCode = eolLast(updatedCode, message);
      break;
    // ... more cases
  }
  
  // Rest of existing logic...
}
```

## Error Handling Strategy

### Common Edge Cases
1. **Inside Strings**: Don't modify content inside quotes
2. **Inside Comments**: Don't modify commented code  
3. **Template Literals**: Handle backtick strings specially
4. **Regex Literals**: Don't modify `/pattern/` content
5. **Already Fixed**: Return original if no change needed

### Validation Pattern
```javascript
export const validateFix = (originalCode, fixedCode, ruleId) => {
  // Basic validation that fix was applied correctly
  if (originalCode === fixedCode) {
    console.warn(`No changes applied for ${ruleId}`);
  }
  
  // Rule-specific validation
  switch (ruleId) {
    case 'no-extra-semi':
      return !fixedCode.includes(';;');
    case 'no-trailing-spaces':
      return !fixedCode.split('\n').some(line => /\s+$/.test(line));
    // ... more validations
  }
}
```

## Testing Framework

### Test Structure
```javascript
// Create test files for each rule
src/tests/
├── fixtures/
│   ├── semi.input.js
│   ├── semi.expected.js
│   ├── quotes.input.js
│   └── quotes.expected.js
└── fixers/
    ├── semi.test.js
    ├── quotes.test.js
    └── ...
```

### Test Cases Per Rule
1. **Basic functionality** - Simple case works
2. **Multiple occurrences** - Fixes all instances  
3. **Context awareness** - Ignores strings/comments
4. **Edge cases** - Handles unusual syntax
5. **No-op cases** - Returns unchanged when appropriate

## Performance Considerations

### Optimization Strategies
1. **Line-based processing** - Only process affected lines when possible
2. **Regex compilation** - Compile patterns once, reuse
3. **Early returns** - Skip processing if no fix needed
4. **Batch processing** - Handle multiple errors in single pass

### Memory Management
- Process large files in chunks if needed
- Avoid creating unnecessary string copies
- Clean up temporary variables

Ready to start implementing Phase 1?