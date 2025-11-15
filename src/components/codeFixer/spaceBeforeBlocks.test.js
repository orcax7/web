import { describe, it, expect, beforeEach } from 'vitest'
import { SpaceBeforeBlocksFixer } from './spaceBeforeBlocks.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('SpaceBeforeBlocksFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new SpaceBeforeBlocksFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('space-before-blocks')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should add space before if block', () => {
      const code = `if (true){
  console.log('test');
}`
      const expected = `if (true) {
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 10
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add space before function block', () => {
      const code = `function test(){
  return true;
}`
      const expected = `function test() {
  return true;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 15
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add space before class block', () => {
      const code = `class MyClass{
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
        ruleId: 'space-before-blocks',
        line: 1,
        column: 14
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add space before else block', () => {
      const code = `if (true) {
  console.log('if');
} else{
  console.log('else');
}`
      const expected = `if (true) {
  console.log('if');
} else {
  console.log('else');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 3,
        column: 7
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `if (true){\n  console.log('test');\n}`
      const error = global.createMockESLintError({ ruleId: 'space-before-blocks' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify spaces inside strings', () => {
      const code = `const str = "if (true){console.log('test');}"`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 22
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify spaces inside comments', () => {
      const code = `// if (true){console.log('test');}
const x = 1;`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 12
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify spaces inside template literals', () => {
      const code = `const template = \`if (true){console.log('test');}\``
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 27
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle while loops', () => {
      const code = `while (true){
  console.log('loop');
}`
      const expected = `while (true) {
  console.log('loop');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 13
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle for loops', () => {
      const code = `for (let i = 0; i < 10; i++){
  console.log(i);
}`
      const expected = `for (let i = 0; i < 10; i++) {
  console.log(i);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 29
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle try-catch blocks', () => {
      const code = `try{
  riskyOperation();
}catch (error){
  console.error(error);
}`
      const expected = `try {
  riskyOperation();
} catch (error) {
  console.error(error);
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 4
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle switch statements', () => {
      const code = `switch (value){
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
        ruleId: 'space-before-blocks',
        line: 1,
        column: 15
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle arrow functions with blocks', () => {
      const code = `const fn = () =>{
  return true;
}`
      const expected = `const fn = () => {
  return true;
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 17
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle object methods', () => {
      const code = `const obj = {
  method(){
    return true;
  }
}`
      const expected = `const obj = {
  method() {
    return true;
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 2,
        column: 9
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should handle multiple spaces', () => {
      const code = `if (true)   {
  console.log('test');
}`
      const expected = `if (true) {
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 10
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should preserve existing single space', () => {
      const code = `if (true) {
  console.log('test');
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 10
      })

      // Should not need fixing if space already exists
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle nested blocks', () => {
      const code = `if (true){
  if (false){
    console.log('nested');
  }
}`
      const error = global.createMockESLintError({ 
        ruleId: 'space-before-blocks',
        line: 1,
        column: 10
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `if (true){\n  console.log('test');\n}`
      const fixed = `if (true) {\n  console.log('test');\n}`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `if (true){\n  console.log('test');\n}`
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