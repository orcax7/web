import { describe, it, expect, beforeEach } from 'vitest'
import { IndentFixer } from './indent.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('IndentFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new IndentFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('indent')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should fix basic indentation issues', () => {
      const code = `function test() {
if (true) {
console.log('hello');
}
}`
      const expected = `function test() {
  if (true) {
    console.log('hello');
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle nested blocks', () => {
      const code = `if (true) {
if (false) {
console.log('nested');
}
}`
      const expected = `if (true) {
  if (false) {
    console.log('nested');
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should fix object indentation', () => {
      const code = `const obj = {
a: 1,
b: 2
}`
      const expected = `const obj = {
  a: 1,
  b: 2
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `function test() {\nconsole.log('test');\n}`
      const error = global.createMockESLintError({ ruleId: 'indent' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify indentation inside strings', () => {
      const code = `const str = "function test() {
  console.log('hello');
}"`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 3
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify indentation inside template literals', () => {
      const code = `const template = \`
function test() {
console.log('hello');
}
\``
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 3,
        column: 1
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle comments correctly', () => {
      const code = `function test() {
// This is a comment
console.log('hello');
}`
      const expected = `function test() {
  // This is a comment
  console.log('hello');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('// This is a comment')
    })
  })

  describe('edge cases', () => {
    it('should handle empty lines', () => {
      const code = `function test() {

console.log('hello');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 3,
        column: 1
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle mixed indentation', () => {
      const code = `function test() {
\tif (true) {
  console.log('mixed');
\t}
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should preserve relative indentation within blocks', () => {
      const code = `function test() {
const obj = {
a: 1,
  b: 2
};
}`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle array indentation', () => {
      const code = `const arr = [
1,
2,
3
]`
      const expected = `const arr = [
  1,
  2,
  3
]`
      const error = global.createMockESLintError({ 
        ruleId: 'indent',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `function test() {\nconsole.log('hello');\n}`
      const fixed = `function test() {\n  console.log('hello');\n}`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `function test() {\nconsole.log('hello');\n}`
      const invalidFixed = `function test() {\n  console.log('hello';\n}`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })

    it('should handle validation of unchanged code', () => {
      const code = `function test() {\n  console.log('hello');\n}`
      
      const isValid = fixer.validate(code, code)
      expect(isValid).toBe(true)
    })
  })
})