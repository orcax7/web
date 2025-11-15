import { describe, it, expect, beforeEach } from 'vitest'
import { PreferForOfFixer } from './preferForOf.js'
import { SyntaxValidator } from '../../test/utils/testUtils.js'

describe('PreferForOfFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new PreferForOfFixer()
  })

  describe('Basic Functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('prefer-for-of')
    })

    it('should be marked as complex complexity', () => {
      expect(fixer.complexity).toBe('complex')
    })
  })

  describe('canFix', () => {
    it('should return true for simple for loop', () => {
      const code = 'for (let i = 0; i < arr.length; i++) {\n  console.log(arr[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return false for wrong rule ID', () => {
      const code = 'for (let i = 0; i < arr.length; i++) {\n  console.log(arr[i]);\n}'
      const error = {
        ruleId: 'semi',
        line: 1,
        column: 1
      }

      expect(fixer.canFix(code, error)).toBe(false)
    })
  })

  describe('fix - Simple Array Iteration', () => {
    it('should convert simple for loop to for-of', () => {
      const code = 'for (let i = 0; i < items.length; i++) {\n  console.log(items[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const item of items)')
      expect(result.code).toContain('console.log(item)')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should convert for loop with var to for-of', () => {
      const code = 'for (var i = 0; i < arr.length; i++) {\n  console.log(arr[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const')
      expect(result.code).toContain('of arr')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle plural to singular conversion', () => {
      const code = 'for (let i = 0; i < users.length; i++) {\n  console.log(users[i].name);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const user of users)')
      expect(result.code).toContain('user.name')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Different Array Names', () => {
    it('should handle array with List suffix', () => {
      const code = 'for (let i = 0; i < itemList.length; i++) {\n  process(itemList[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const item of itemList)')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle array with Array suffix', () => {
      const code = 'for (let i = 0; i < dataArray.length; i++) {\n  handle(dataArray[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const data of dataArray)')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Multiple Array Accesses', () => {
    it('should handle multiple array accesses in body', () => {
      const code = 'for (let i = 0; i < items.length; i++) {\n  const x = items[i];\n  console.log(items[i]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const item of items)')
      expect(result.code).not.toContain('items[')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Different Index Variables', () => {
    it('should handle index variable named j', () => {
      const code = 'for (let j = 0; j < arr.length; j++) {\n  console.log(arr[j]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const')
      expect(result.code).toContain('of arr')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle index variable named idx', () => {
      const code = 'for (let idx = 0; idx < data.length; idx++) {\n  process(data[idx]);\n}'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 1,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('for (const')
      expect(result.code).toContain('of data')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Indentation', () => {
    it('should preserve indentation', () => {
      const code = '  for (let i = 0; i < arr.length; i++) {\n    console.log(arr[i]);\n  }'
      const error = {
        ruleId: 'prefer-for-of',
        line: 1,
        column: 3,
        message: 'Expected a `for-of` loop instead of a `for` loop.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toMatch(/^\s{2}for/)
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should validate successful fixes', () => {
      const original = 'for (let i = 0; i < arr.length; i++) { console.log(arr[i]); }'
      const fixed = 'for (const item of arr) { console.log(item); }'

      expect(fixer.validate(original, fixed)).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = 'for (let i = 0; i < arr.length; i++) { console.log(arr[i]); }'
      const invalid = 'for (let i = 0; i < arr.length; i++) { console.log(arr[i]); }' // No change

      expect(fixer.validate(original, invalid)).toBe(false)
    })
  })
})
