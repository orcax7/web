import { describe, it, expect, beforeEach } from 'vitest'
import { NoVarFixer } from './noVar.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('NoVarFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new NoVarFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('no-var')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should convert var to let', () => {
      const code = `var x = 1;
var y = 2;`
      const expected = `let x = 1;
let y = 2;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle var declarations with initialization', () => {
      const code = `var name = 'John';`
      const expected = `let name = 'John';`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle var declarations without initialization', () => {
      const code = `var x;`
      const expected = `let x;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle multiple var declarations', () => {
      const code = `var a = 1, b = 2, c;`
      const expected = `let a = 1, b = 2, c;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `var x = 1;`
      const error = global.createMockESLintError({ ruleId: 'no-var' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify var inside strings', () => {
      const code = `const str = "var x = 1;"`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 13
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify var inside comments', () => {
      const code = `// var x = 1;
const y = 2;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 3
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify var inside template literals', () => {
      const code = `const template = \`var x = 1;\``
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 18
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle var in different scopes', () => {
      const code = `function test() {
  var x = 1;
  if (true) {
    var y = 2;
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('let x = 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle var in for loops', () => {
      const code = `for (var i = 0; i < 10; i++) {
  console.log(i);
}`
      const expected = `for (let i = 0; i < 10; i++) {
  console.log(i);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 6
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle var with destructuring', () => {
      const code = `var { a, b } = obj;`
      const expected = `let { a, b } = obj;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle var with array destructuring', () => {
      const code = `var [x, y] = arr;`
      const expected = `let [x, y] = arr;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should preserve whitespace and formatting', () => {
      const code = `  var   x   =   1  ;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 1,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toMatch(/^\s*let\s+x\s+=\s+1\s*;$/)
    })

    it('should handle hoisting implications', () => {
      const code = `console.log(x);
var x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'no-var',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('let x = 1;')
      // Note: This test acknowledges that the fix might change behavior
      // In a real implementation, we might want to add warnings
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `var x = 1;`
      const fixed = `let x = 1;`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `var x = 1;`
      const invalidFixed = `let x = 1`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })

    it('should handle validation of unchanged code', () => {
      const code = `let x = 1;`
      
      const isValid = fixer.validate(code, code)
      expect(isValid).toBe(true)
    })
  })
})