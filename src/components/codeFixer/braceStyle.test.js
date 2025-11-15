import { describe, it, expect, beforeEach } from 'vitest'
import { BraceStyleFixer } from './braceStyle.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('BraceStyleFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new BraceStyleFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('brace-style')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should fix opening brace on new line (1tbs style)', () => {
      const code = `if (true)
{
  console.log('test');
}`
      const expected = `if (true) {
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should fix function brace style', () => {
      const code = `function test()
{
  return true;
}`
      const expected = `function test() {
  return true;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should fix class brace style', () => {
      const code = `class MyClass
{
  constructor() {
    this.name = 'test';
  }
}`
      const expected = `class MyClass {
  constructor() {
    this.name = 'test';
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should fix else brace style', () => {
      const code = `if (true) {
  console.log('if');
}
else {
  console.log('else');
}`
      const expected = `if (true) {
  console.log('if');
} else {
  console.log('else');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 4,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `if (true)\n{\n  console.log('test');\n}`
      const error = global.createMockESLintError({ ruleId: 'brace-style' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify braces inside strings', () => {
      const code = `const str = "if (true)\\n{\\n  console.log('test');\\n}"`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 1,
        column: 25
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify braces inside comments', () => {
      const code = `// if (true)
// {
//   console.log('test');
// }
const x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 4
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify braces inside template literals', () => {
      const code = `const template = \`
if (true)
{
  console.log('test');
}
\``
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 3,
        column: 1
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle nested blocks', () => {
      const code = `if (true)
{
  if (false)
  {
    console.log('nested');
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should preserve indentation', () => {
      const code = `  if (true)
  {
    console.log('indented');
  }`
      const expected = `  if (true) {
    console.log('indented');
  }`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle try-catch blocks', () => {
      const code = `try
{
  riskyOperation();
}
catch (error)
{
  console.error(error);
}`
      const expected = `try {
  riskyOperation();
} catch (error) {
  console.error(error);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle object literals', () => {
      const code = `const obj =
{
  a: 1,
  b: 2
}`
      const expected = `const obj = {
  a: 1,
  b: 2
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle arrow functions with blocks', () => {
      const code = `const fn = () =>
{
  return true;
}`
      const expected = `const fn = () => {
  return true;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle switch statements', () => {
      const code = `switch (value)
{
  case 1:
    console.log('one');
    break;
  default:
    console.log('other');
}`
      const expected = `switch (value) {
  case 1:
    console.log('one');
    break;
  default:
    console.log('other');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle comments between declaration and brace', () => {
      const code = `if (true) // comment
{
  console.log('test');
}`
      const expected = `if (true) { // comment
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'brace-style',
        line: 2,
        column: 1
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('// comment')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `if (true)\n{\n  console.log('test');\n}`
      const fixed = `if (true) {\n  console.log('test');\n}`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `if (true)\n{\n  console.log('test');\n}`
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