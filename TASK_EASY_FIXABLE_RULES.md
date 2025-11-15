# Task: Implement Easy ESLint Auto-Fix Rules

## Overview
Extend the existing auto-fix functionality by implementing 7 additional ESLint rules that are straightforward to implement using string manipulation and regex patterns.

## Current State
- ✅ `no-unused-vars` - Remove unused variables/functions/parameters
- ✅ `eqeqeq` - Convert `==`/`!=` to `===`/`!==`

## Target Rules to Implement

### 1. `semi` - Semicolon Management
**Purpose**: Add or remove semicolons consistently
**Complexity**: Easy
**Examples**:
```javascript
// Missing semicolon
let x = 5     // → let x = 5;
console.log() // → console.log();

// Extra semicolon in wrong place
if (true); { } // → if (true) { }
```

### 2. `quotes` - Quote Style Consistency  
**Purpose**: Convert between single/double quotes
**Complexity**: Easy
**Examples**:
```javascript
// Convert to single quotes
let name = "John"  // → let name = 'John'
let msg = "Hello"  // → let msg = 'Hello'

// Or convert to double quotes
let name = 'John'  // → let name = "John"
```

### 3. `no-extra-semi` - Remove Unnecessary Semicolons
**Purpose**: Remove redundant semicolons
**Complexity**: Easy
**Examples**:
```javascript
let x = 5;;        // → let x = 5;
function test() {; // → function test() {
};;                // → }
```

### 4. `comma-dangle` - Trailing Comma Management
**Purpose**: Add or remove trailing commas in objects/arrays
**Complexity**: Easy
**Examples**:
```javascript
// Add trailing commas
let obj = {
  a: 1,
  b: 2     // → b: 2,
}

// Remove trailing commas  
let arr = [1, 2, 3,] // → let arr = [1, 2, 3]
```

### 5. `indent` - Fix Indentation
**Purpose**: Standardize indentation (spaces vs tabs, count)
**Complexity**: Easy-Medium
**Examples**:
```javascript
// Fix inconsistent indentation
function test() {
   let x = 1;    // 3 spaces → 2 spaces
  let y = 2;     // 2 spaces ✓
}
```

### 6. `no-trailing-spaces` - Remove Trailing Whitespace
**Purpose**: Remove spaces/tabs at end of lines
**Complexity**: Easy
**Examples**:
```javascript
let x = 5;   // (3 trailing spaces) → let x = 5;
let y = 10;  // (2 trailing spaces) → let y = 10;
```

### 7. `eol-last` - End of Line Management
**Purpose**: Ensure newline at end of file
**Complexity**: Easy
**Examples**:
```javascript
// File without final newline
console.log('end'); // → console.log('end');\n
```

## Implementation Priority

### Phase 1 (Start Here)
1. **`no-extra-semi`** - Simplest regex replacement
2. **`no-trailing-spaces`** - Simple line-by-line cleanup
3. **`eol-last`** - Single check at file end

### Phase 2 
4. **`semi`** - Requires AST-like parsing to avoid strings
5. **`quotes`** - Need to handle escaped quotes properly

### Phase 3
6. **`comma-dangle`** - Requires bracket matching
7. **`indent`** - Most complex, needs scope awareness

## Technical Requirements

### File Structure
Create new files in `src/components/codeFixer/`:
- `noExtraSemi.jsx`
- `noTrailingSpaces.jsx` 
- `eolLast.jsx`
- `semi.jsx`
- `quotes.jsx`
- `commaDangle.jsx`
- `indent.jsx`

### Integration Points
1. **Update `globalFunction.jsx`**:
   - Add new rule IDs to `isFixAble()` function
   
2. **Update `fileUpload.jsx`**:
   - Import new fixer functions
   - Add cases to `applyFix()` switch statement

### Function Signature
Each fixer should follow this pattern:
```javascript
export const ruleName = (code, error) => {
  // code: string - full file content
  // error: object - ESLint error details with line, column, etc.
  // return: string - modified code
}
```

## Success Criteria
- [ ] All 7 rules implemented and working
- [ ] No regression in existing functionality
- [ ] Proper error handling for edge cases
- [ ] Code follows existing patterns and style
- [ ] Each rule handles common JavaScript syntax correctly

## Testing Strategy
For each rule, test with:
- Simple cases (basic variable declarations)
- Complex cases (nested objects, functions)
- Edge cases (strings containing the target pattern)
- Multiple occurrences in same file
- Already correct code (should not change)

## Estimated Timeline
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours  
- Phase 3: 4-5 hours
- Testing & Integration: 2-3 hours
- **Total**: 11-15 hours

Ready to start with Phase 1?