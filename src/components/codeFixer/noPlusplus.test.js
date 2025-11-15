import { describe, it, expect, beforeEach } from 'vitest'
import { NoPlusPlusFixer } from './noPlusplus.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('NoPlusPlusFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new NoPlusPlusFixer()
  })

  describe('Basic Functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('no-plusplus')
    })

    it('should be marked as simple complexity', () => {
      expect(fixer.complexity).toBe('simple')
    })
  })

  describe('canFix', () => {
    it('should return true for postfix increment', () => {
      const code = 'let i = 0;\ni++;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return true for prefix increment', () => {
      const code = 'let i = 0;\n++i;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return true for postfix decrement', () => {
      const code = 'let i = 10;\ni--;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '--' used."
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return true for prefix decrement', () => {
      const code = 'let i = 10;\n--i;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '--' used."
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return false for wrong rule ID', () => {
      const code = 'let i = 0;\ni++;'
      const error = {
        ruleId: 'semi',
        line: 2,
        column: 1
      }

      expect(fixer.canFix(code, error)).toBe(false)
    })
  })

  describe('fix - Postfix Increment', () => {
    it('should fix simple postfix increment', () => {
      const code = 'let i = 0;\ni++;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('let i = 0;\ni += 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix postfix increment in for loop', () => {
      const code = 'for (let i = 0; i < 10; i++) {\n  console.log(i);\n}'
      const error = {
        ruleId: 'no-plusplus',
        line: 1,
        column: 29,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('for (let i = 0; i < 10; i += 1) {\n  console.log(i);\n}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix postfix increment with spaces', () => {
      const code = 'let count = 0;\ncount ++;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('count += 1')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Prefix Increment', () => {
    it('should fix simple prefix increment', () => {
      const code = 'let i = 0;\n++i;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('let i = 0;\ni += 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix prefix increment with spaces', () => {
      const code = 'let count = 0;\n++ count;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('count += 1')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Postfix Decrement', () => {
    it('should fix simple postfix decrement', () => {
      const code = 'let i = 10;\ni--;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '--' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('let i = 10;\ni -= 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix postfix decrement in for loop', () => {
      const code = 'for (let i = 10; i > 0; i--) {\n  console.log(i);\n}'
      const error = {
        ruleId: 'no-plusplus',
        line: 1,
        column: 29,
        message: "Unary operator '--' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('for (let i = 10; i > 0; i -= 1) {\n  console.log(i);\n}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Prefix Decrement', () => {
    it('should fix simple prefix decrement', () => {
      const code = 'let i = 10;\n--i;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '--' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('let i = 10;\ni -= 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('Complex Cases', () => {
    it('should fix increment in array access', () => {
      const code = 'let arr = [1, 2, 3];\nlet i = 0;\nconsole.log(arr[i++]);'
      const error = {
        ruleId: 'no-plusplus',
        line: 3,
        column: 18,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('i += 1')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix increment with longer variable names', () => {
      const code = 'let counter = 0;\ncounter++;'
      const error = {
        ruleId: 'no-plusplus',
        line: 2,
        column: 1,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toBe('let counter = 0;\ncounter += 1;')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle increment at end of statement', () => {
      const code = 'let x = 5; x++;'
      const error = {
        ruleId: 'no-plusplus',
        line: 1,
        column: 12,
        message: "Unary operator '++' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('x += 1')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle decrement at end of statement', () => {
      const code = 'let x = 5; x--;'
      const error = {
        ruleId: 'no-plusplus',
        line: 1,
        column: 12,
        message: "Unary operator '--' used."
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('x -= 1')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should validate successful fixes', () => {
      const original = 'let i = 0;\ni++;'
      const fixed = 'let i = 0;\ni += 1;'

      expect(fixer.validate(original, fixed)).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = 'let i = 0;\ni++;'
      const invalid = 'let i = 0;\ni++;' // No change

      expect(fixer.validate(original, invalid)).toBe(false)
    })
  })
})
