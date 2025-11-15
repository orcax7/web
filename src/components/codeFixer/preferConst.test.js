import { describe, it, expect, beforeEach } from 'vitest'
import { PreferConstFixer } from './preferConst.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('PreferConstFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new PreferConstFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('prefer-const')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should convert let to const for never reassigned variables', () => {
      const code = `let x = 1;
console.log(x);`
      const expected = `const x = 1;
console.log(x);`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should not convert let to const for reassigned variables', () => {
      const code = `let x = 1;
x = 2;`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle multiple let declarations', () => {
      const code = `let a = 1, b = 2;
console.log(a, b);`
      const expected = `const a = 1, b = 2;
console.log(a, b);`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `let x = 1;`
      const error = global.createMockESLintError({ ruleId: 'prefer-const' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify let inside strings', () => {
      const code = `const str = "let x = 1;"`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 13
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify let inside comments', () => {
      const code = `// let x = 1;
const y = 2;`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 3
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify let inside template literals', () => {
      const code = `const template = \`let x = 1;\``
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 18
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should analyze variable usage within scope', () => {
      const code = `function test() {
  let x = 1;
  let y = 2;
  y = 3;
  return x + y;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('const x = 1;')
      expect(result.code).toContain('let y = 2;')
    })
  })

  describe('edge cases', () => {
    it('should handle let in for loops', () => {
      const code = `for (let i = 0; i < 10; i++) {
  console.log(i);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 6
      })

      // Loop variables are typically reassigned, so should not be converted
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle let with destructuring', () => {
      const code = `let { a, b } = obj;
console.log(a, b);`
      const expected = `const { a, b } = obj;
console.log(a, b);`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle let with array destructuring', () => {
      const code = `let [x, y] = arr;
console.log(x, y);`
      const expected = `const [x, y] = arr;
console.log(x, y);`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle let without initialization', () => {
      const code = `let x;
x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      // Variables without initialization that are later assigned should not be converted
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should preserve whitespace and formatting', () => {
      const code = `  let   x   =   1  ;`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toMatch(/^\s*const\s+x\s+=\s+1\s*;$/)
    })

    it('should handle complex scoping scenarios', () => {
      const code = `function outer() {
  let x = 1;
  function inner() {
    let x = 2;
    console.log(x);
  }
  console.log(x);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle partial destructuring reassignment', () => {
      const code = `let { a, b } = obj;
a = 2;
console.log(a, b);`
      const error = global.createMockESLintError({ 
        ruleId: 'prefer-const',
        line: 1,
        column: 1
      })

      // If any destructured variable is reassigned, the whole declaration should not be converted
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `let x = 1;`
      const fixed = `const x = 1;`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `let x = 1;`
      const invalidFixed = `const x = 1`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })

    it('should handle validation of unchanged code', () => {
      const code = `const x = 1;`
      
      const isValid = fixer.validate(code, code)
      expect(isValid).toBe(true)
    })
  })
})