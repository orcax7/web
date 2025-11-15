import { describe, it, expect, beforeEach } from 'vitest'
import { NoConsoleFixer } from './noConsole.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('NoConsoleFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new NoConsoleFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('no-console')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should comment out console.log statements', () => {
      const code = `console.log('debug message');`
      const expected = `// console.log('debug message');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should comment out console.error statements', () => {
      const code = `console.error('error message');`
      const expected = `// console.error('error message');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should comment out console.warn statements', () => {
      const code = `console.warn('warning message');`
      const expected = `// console.warn('warning message');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle multiple console statements', () => {
      const code = `console.log('debug');
console.error('error');`
      const expected = `// console.log('debug');
// console.error('error');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `console.log('test');`
      const error = global.createMockESLintError({ ruleId: 'no-console' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify console inside strings', () => {
      const code = `const str = "console.log('test')";`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 13
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify console inside comments', () => {
      const code = `// console.log('test')
const x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 3
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify console inside template literals', () => {
      const code = `const template = \`console.log('test')\``
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 18
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle console in different contexts', () => {
      const code = `function test() {
  console.log('inside function');
  if (true) {
    console.error('inside if');
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('// console.log(\'inside function\');')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle console with complex arguments', () => {
      const code = `console.log('User:', user.name, 'Age:', user.age);`
      const expected = `// console.log('User:', user.name, 'Age:', user.age);`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle console with method chaining', () => {
      const code = `console.log(data.map(x => x.name).join(', '));`
      const expected = `// console.log(data.map(x => x.name).join(', '));`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle console.table and other methods', () => {
      const code = `console.table(data);`
      const expected = `// console.table(data);`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should preserve indentation when commenting', () => {
      const code = `  console.log('indented');`
      const expected = `  // console.log('indented');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle console in ternary expressions', () => {
      const code = `const result = debug ? console.log('debug') : null;`
      const expected = `const result = debug ? /* console.log('debug') */ null : null;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 24
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle console in arrow functions', () => {
      const code = `const debug = () => console.log('arrow function');`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 21
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle multiline console statements', () => {
      const code = `console.log(
  'multiline',
  'statement'
);`
      const error = global.createMockESLintError({ 
        ruleId: 'no-console',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `console.log('test');`
      const fixed = `// console.log('test');`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `console.log('test');`
      const invalidFixed = `// console.log('test'`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })

    it('should handle validation of unchanged code', () => {
      const code = `// console.log('test');`
      
      const isValid = fixer.validate(code, code)
      expect(isValid).toBe(true)
    })
  })
})