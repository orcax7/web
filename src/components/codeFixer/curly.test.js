import { describe, it, expect, beforeEach } from 'vitest'
import { CurlyFixer } from './curly.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('CurlyFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new CurlyFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('curly')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should add braces to if statements', () => {
      const code = `if (true) console.log('test');`
      const expected = `if (true) {
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 11
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add braces to else statements', () => {
      const code = `if (true) {
  console.log('if');
} else console.log('else');`
      const expected = `if (true) {
  console.log('if');
} else {
  console.log('else');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 3,
        column: 8
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add braces to while loops', () => {
      const code = `while (true) console.log('loop');`
      const expected = `while (true) {
  console.log('loop');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 14
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add braces to for loops', () => {
      const code = `for (let i = 0; i < 10; i++) console.log(i);`
      const expected = `for (let i = 0; i < 10; i++) {
  console.log(i);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 30
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `if (true) console.log('test');`
      const error = global.createMockESLintError({ ruleId: 'curly' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify statements inside strings', () => {
      const code = `const str = "if (true) console.log('test');"`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 20
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify statements inside comments', () => {
      const code = `// if (true) console.log('test');
const x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 10
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify statements inside template literals', () => {
      const code = `const template = \`if (true) console.log('test');\``
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 25
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle nested if statements', () => {
      const code = `if (true) if (false) console.log('nested');`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 11
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should preserve indentation', () => {
      const code = `  if (true) console.log('indented');`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 13
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toMatch(/^\s{2}if \(true\) \{/)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle multiline statements', () => {
      const code = `if (condition)
  console.log('multiline');`
      const expected = `if (condition) {
  console.log('multiline');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle else if chains', () => {
      const code = `if (a) console.log('a');
else if (b) console.log('b');
else console.log('c');`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 8
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle complex expressions', () => {
      const code = `if (user && user.name) console.log(user.name.toUpperCase());`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 24
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle return statements', () => {
      const code = `if (error) return false;`
      const expected = `if (error) {
  return false;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 12
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle throw statements', () => {
      const code = `if (error) throw new Error('Something went wrong');`
      const expected = `if (error) {
  throw new Error('Something went wrong');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'curly',
        line: 1,
        column: 12
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `if (true) console.log('test');`
      const fixed = `if (true) {\n  console.log('test');\n}`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `if (true) console.log('test');`
      const invalidFixed = `if (true) {\n  console.log('test';\n}`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })

    it('should handle validation of unchanged code', () => {
      const code = `if (true) {\n  console.log('test');\n}`
      
      const isValid = fixer.validate(code, code)
      expect(isValid).toBe(true)
    })
  })
})