# Design Document

## Overview

This design enhances the existing JavaScript ESLint auto-fix web application by implementing a more robust, extensible architecture for code fixers. The enhancement focuses on adding support for 8 new ESLint rules, improving context-aware fixing, implementing batch operations, and creating a more maintainable codebase structure.

The current system uses a simple switch-case pattern in `fileUpload.jsx` to route fixes to individual fixer functions. This design will evolve that into a plugin-based architecture with shared utilities, better error handling, and comprehensive testing.

## Architecture

### Current Architecture Analysis
```
fileUpload.jsx (Main Component)
├── applyFix() - Switch statement routing
├── Individual fixer imports
└── Manual rule registration in isFixAble()

codeFixer/ (Fixer Functions)
├── removeUnusedVar.jsx - Complex AST-like parsing
├── quotes.jsx - Context-aware string handling  
├── semi.jsx - Simple line-based fixes
└── [other simple fixers] - Basic regex patterns
```

### Enhanced Architecture
```
fileUpload.jsx (Main Component)
├── FixerRegistry - Centralized fixer management
├── BatchFixProcessor - Multi-fix operations
├── FixValidation - Pre/post fix validation
└── UIFeedback - Enhanced user experience

codeFixer/ (Fixer Functions)
├── registry/
│   └── fixerRegistry.js - Auto-discovery and registration
├── shared/
│   ├── contextAnalyzer.js - Advanced context detection
│   ├── codeValidator.js - Syntax validation utilities
│   └── fixerBase.js - Base class for all fixers
├── simple/ - Pattern-based fixers
│   ├── commaDangle.js
│   ├── spaceBeforeBlocks.js
│   └── braceStyle.js
├── complex/ - Context-aware fixers
│   ├── indent.js
│   ├── noVar.js
│   └── preferConst.js
└── existing/ - Enhanced versions of current fixers
    ├── quotes.js (improved)
    ├── semi.js (improved)
    └── removeUnusedVar.js (improved)
```

## Components and Interfaces

### 1. Fixer Registry System

**Interface: IFixer**
```javascript
interface IFixer {
  ruleId: string;
  complexity: 'simple' | 'complex';
  canFix(code: string, error: ESLintError): boolean;
  fix(code: string, error: ESLintError): FixResult;
  validate(originalCode: string, fixedCode: string): boolean;
}

interface FixResult {
  success: boolean;
  code: string;
  message?: string;
  warnings?: string[];
}
```

**FixerRegistry Class**
```javascript
class FixerRegistry {
  private fixers: Map<string, IFixer>;
  
  register(fixer: IFixer): void;
  getFixer(ruleId: string): IFixer | null;
  getFixableRules(): string[];
  autoDiscoverFixers(): void;
}
```

### 2. Context Analyzer (Enhanced)

**ContextAnalyzer Class**
```javascript
class ContextAnalyzer {
  analyzePosition(code: string, line: number, column: number): Context;
  isInString(code: string, position: number): boolean;
  isInComment(code: string, position: number): boolean;
  isInRegex(code: string, position: number): boolean;
  isInTemplateString(code: string, position: number): boolean;
  findSafeFixZone(code: string, error: ESLintError): SafeZone;
}

interface Context {
  inString: boolean;
  inComment: boolean;
  inRegex: boolean;
  inTemplate: boolean;
  stringChar?: string;
  commentType?: 'single' | 'multi';
}
```

### 3. Batch Fix Processor

**BatchFixProcessor Class**
```javascript
class BatchFixProcessor {
  async processBatch(
    code: string, 
    errors: ESLintError[], 
    onProgress?: (progress: BatchProgress) => void
  ): Promise<BatchResult>;
  
  private async applyFixSafely(
    code: string, 
    error: ESLintError
  ): Promise<FixResult>;
  
  private async relintCode(code: string): Promise<ESLintError[]>;
}

interface BatchResult {
  finalCode: string;
  appliedFixes: FixSummary[];
  failedFixes: FixSummary[];
  totalErrors: number;
  fixedErrors: number;
}
```

### 4. Enhanced UI Components

**FixStatusIndicator Component**
```javascript
const FixStatusIndicator = ({ 
  isFixable, 
  isApplying, 
  fixResult 
}) => {
  // Visual indicators for fix status
  // Loading states, success/error feedback
};
```

**BatchFixControls Component**
```javascript
const BatchFixControls = ({ 
  fixableCount, 
  totalCount, 
  onBatchFix,
  isProcessing 
}) => {
  // "Fix All" button with progress
  // Fix summary display
};
```

## Data Models

### ESLint Error Model (Enhanced)
```javascript
interface ESLintError {
  ruleId: string;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning';
  nodeType?: string;
  source?: string;
  fix?: ESLintFix;
}
```

### Fix Result Models
```javascript
interface FixSummary {
  ruleId: string;
  line: number;
  column: number;
  success: boolean;
  message: string;
  appliedAt: Date;
}

interface BatchProgress {
  current: number;
  total: number;
  currentRule: string;
  phase: 'analyzing' | 'fixing' | 'validating' | 'complete';
}
```

## New Fixer Implementations

### 1. Simple Pattern-Based Fixers

**Comma Dangle Fixer**
- Adds or removes trailing commas in objects/arrays
- Uses regex patterns with context awareness
- Handles multiline structures

**Space Before Blocks Fixer**
- Ensures proper spacing before `{` in control structures
- Simple regex replacement with context checking

**Brace Style Fixer**
- Enforces consistent brace placement (1tbs, allman, etc.)
- Line-based transformations with indentation preservation

### 2. Complex Context-Aware Fixers

**Indent Fixer**
- Analyzes code structure to determine proper indentation
- Handles nested blocks, arrays, objects
- Preserves relative indentation within blocks

**No-Var Fixer**
- Converts `var` declarations to `let` or `const`
- Analyzes variable usage to determine appropriate replacement
- Handles hoisting implications

**Prefer-Const Fixer**
- Converts `let` to `const` for variables that are never reassigned
- Requires variable usage analysis within scope
- Handles destructuring assignments

## Error Handling

### Validation Strategy
1. **Pre-fix Validation**: Check if fix can be safely applied
2. **Context Validation**: Ensure fix location is not in string/comment
3. **Post-fix Validation**: Verify JavaScript syntax is still valid
4. **Semantic Validation**: Ensure fix doesn't change code behavior

### Error Recovery
```javascript
class FixValidator {
  validateSyntax(code: string): ValidationResult;
  validateSemantics(original: string, fixed: string): ValidationResult;
  canRevert(fixHistory: FixSummary[]): boolean;
  revertLastFix(code: string, lastFix: FixSummary): string;
}
```

### User Feedback System
- Clear error messages for failed fixes
- Warnings for potentially unsafe fixes
- Progress indicators for batch operations
- Detailed logs for debugging

## Testing Strategy

### Unit Testing Framework
```javascript
// Test structure for each fixer
describe('CommaDangleFixer', () => {
  describe('basic functionality', () => {
    it('should add trailing comma to object');
    it('should remove trailing comma from object');
    it('should handle arrays correctly');
  });
  
  describe('context awareness', () => {
    it('should not modify commas in strings');
    it('should not modify commas in comments');
    it('should handle template literals');
  });
  
  describe('edge cases', () => {
    it('should handle empty objects');
    it('should handle single-line vs multi-line');
    it('should preserve formatting');
  });
});
```

### Integration Testing
- Test fixer registry auto-discovery
- Test batch processing with multiple rules
- Test UI integration and feedback
- Test error handling and recovery

### Test Data Management
```
tests/
├── fixtures/
│   ├── input/
│   │   ├── comma-dangle.js
│   │   ├── indent.js
│   │   └── mixed-rules.js
│   └── expected/
│       ├── comma-dangle.fixed.js
│       ├── indent.fixed.js
│       └── mixed-rules.fixed.js
└── utils/
    ├── testRunner.js
    └── fixtureLoader.js
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load fixers only when needed
2. **Caching**: Cache context analysis results
3. **Incremental Processing**: Process fixes in small batches
4. **Worker Threads**: Use web workers for heavy processing

### Memory Management
- Limit concurrent fix operations
- Clean up intermediate results
- Use streaming for large files
- Implement fix result pagination

### Scalability
- Support for multiple files in batch
- Progress tracking for long operations
- Cancellation support for batch operations
- Configurable batch sizes

## Security Considerations

### Code Safety
- Validate all user input
- Sanitize file contents before processing
- Prevent code injection through fix operations
- Limit file sizes and processing time

### Data Protection
- Don't log sensitive code content
- Secure file upload handling
- Clean up temporary files
- Validate file types strictly

## Migration Strategy

### Phase 1: Foundation
- Implement fixer registry system
- Enhance context analyzer
- Add validation framework

### Phase 2: New Fixers
- Implement 8 new fixer rules
- Add comprehensive testing
- Enhance error handling

### Phase 3: UI Enhancement
- Add batch fix functionality
- Improve visual feedback
- Add progress indicators

### Phase 4: Optimization
- Performance improvements
- Advanced features
- Documentation and training