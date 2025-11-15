import { describe, it, expect, beforeEach } from 'vitest'
import { PreferTemplateFixer } from './preferTemplate.js'
import { CodeComparator, SyntaxValidator } from '../../test/utils/testUtils.js'

describe('PreferTemplateFixer', () => {
  let fixer

  beforeEach(() => {
    fixer = new PreferTemplateFixer()
  })

  describe('Basic Functionality', () => {
    it('should have correct rule ID', () => {
      expect(fixer.ruleId).toBe('prefer-template')
    })

    it('should be marked as complex complexity', () => {
      expect(fixer.complexity).toBe('complex')
    })
  })

  describe('canFix', () => {
    it('should return true for simple string concatenation', () => {
      const code = "const msg = 'Hello ' + name;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return true for variable + string', () => {
      const code = "const msg = name + ' is here';"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      expect(fixer.canFix(code, error)).toBe(true)
    })

    it('should return false for wrong rule ID', () => {
      const code = "const msg = 'Hello ' + name;"
      const error = {
        ruleId: 'semi',
        line: 1,
        column: 13
      }

      expect(fixer.canFix(code, error)).toBe(false)
    })
  })

  describe('fix - Simple Concatenation', () => {
    it('should fix string + variable', () => {
      const code = "const msg = 'Hello ' + name;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix variable + string', () => {
      const code = "const msg = name + ' is here';"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix double quotes to template literal', () => {
      const code = 'const msg = "Hello " + name;'
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Multiple Concatenation', () => {
    it('should fix multiple string concatenations', () => {
      const code = "const msg = 'Hello ' + name + '!';"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix string + var + string + var', () => {
      const code = "const msg = 'User ' + name + ' has ' + count + ' items';"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(result.code).toContain('${count}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Complex Cases', () => {
    it('should fix concatenation with property access', () => {
      const code = "const msg = 'Hello ' + user.name;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${user.name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix concatenation with method call', () => {
      const code = "const msg = 'Result: ' + getValue();"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${getValue()}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should fix concatenation in return statement', () => {
      const code = "return 'Hello ' + name;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 8,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('fix - Edge Cases', () => {
    it('should handle empty strings', () => {
      const code = "const msg = '' + value;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle concatenation with spaces', () => {
      const code = "const msg = 'Hello '  +  name;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${name}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })

    it('should handle concatenation with numbers', () => {
      const code = "const msg = 'Count: ' + 42;"
      const error = {
        ruleId: 'prefer-template',
        line: 1,
        column: 13,
        message: 'Unexpected string concatenation.'
      }

      const result = fixer.fix(code, error)

      expect(result.success).toBe(true)
      expect(result.code).toContain('`')
      expect(result.code).toContain('${42}')
      expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should validate successful fixes', () => {
      const original = "const msg = 'Hello ' + name;"
      const fixed = "const msg = `Hello ${name}`;"

      expect(fixer.validate(original, fixed)).toBe(true)
    })

    it('should reject invalid fixes', () => {
      const original = "const msg = 'Hello ' + name;"
      const invalid = "const msg = 'Hello ' + name;" // No change

      expect(fixer.validate(original, invalid)).toBe(false)
    })
  })
})
