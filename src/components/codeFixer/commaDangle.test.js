import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommaDangleFixer } from './commaDangle.js'
import { FixtureLoader, CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('CommaDangleFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new CommaDangleFixer()
  })

  describe('basic functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('comma-dangle')
    })

    it('should implement required interface methods', () => {
      expect(typeof fixer.canFix).toBe('function')
      expect(typeof fixer.fix).toBe('function')
      expect(typeof fixer.validate).toBe('function')
    })

    it('should remove trailing comma from object', () => {
      const code = `const obj = {
  a: 1,
  b: 2,
}`
      const expected = `const obj = {
  a: 1,
  b: 2
}`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 3,
        column: 6
      })

      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(true)

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should remove trailing comma from array', () => {
      const code = `const arr = [
  1,
  2,
]`
      const expected = `const arr = [
  1,
  2
]`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 3,
        column: 3
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should add trailing comma when required', () => {
      const code = `const obj = {
  a: 1,
  b: 2
}`
      const expected = `const obj = {
  a: 1,
  b: 2,
}`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 3,
        column: 6,
        message: 'Missing trailing comma'
      })

      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(CodeComparator.compare(result.code, expected)).toBe(true)
    })

    it('should produce syntactically valid JavaScript', () => {
      const code = `const obj = { a: 1, b: 2, }`
      const error = global.createMockESLintError({ ruleId: 'comma-dangle' })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      
      const validation = SyntaxValidator.validateSyntax(result.code)
      expect(validation.valid).toBe(true)
    })
  })

  describe('context awareness', () => {
    it('should not modify commas inside strings', () => {
      const code = `const str = "object with comma, inside"`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 1,
        column: 25
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify commas inside comments', () => {
      const code = `// This comment has comma, inside
const obj = { a: 1 }`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 1,
        column: 25
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should not modify commas inside template literals', () => {
      const code = `const str = \`template with comma, inside\``
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 1,
        column: 30
      })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const code = `const obj = {}`
      const error = global.createMockESLintError({ ruleId: 'comma-dangle' })
      
      const canFix = fixer.canFix(code, error)
      expect(canFix).toBe(false)
    })

    it('should handle single-line objects', () => {
      const code = `const obj = { a: 1, }`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 1,
        column: 18
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toBe(`const obj = { a: 1 }`)
    })

    it('should handle nested objects', () => {
      const code = `const obj = {
  nested: {
    a: 1,
    b: 2,
  },
}`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 4,
        column: 8
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should preserve formatting', () => {
      const code = `const obj = {
  a: 1,
  b: 2,    // comment
}`
      const error = global.createMockESLintError({ 
        ruleId: 'comma-dangle',
        line: 3,
        column: 6
      })
      
      const result = fixer.fix(code, error)
      expect(result.success).toBe(true)
      expect(result.code).toContain('// comment')
    })
  })

  describe('validation', () => {
    it('should validate successful fixes', () => {
      const original = `const obj = { a: 1, b: 2, }`
      const fixed = `const obj = { a: 1, b: 2 }`
      
      const isValid = fixer.validate(original, fixed)
      expect(isValid).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = `const obj = { a: 1, b: 2, }`
      const invalidFixed = `const obj = { a: 1, b: 2`
      
      const isValid = fixer.validate(original, invalidFixed)
      expect(isValid).toBe(false)
    })
  })
})