import { describe, it, expect } from 'vitest'
import { FixtureLoader, CodeComparator, SyntaxValidator } from './testUtils.js'

describe('Test Utils', () => {
  describe('FixtureLoader', () => {
    it('should load fixtures correctly', () => {
      const fixture = FixtureLoader.load('comma-dangle')
      expect(fixture).toHaveProperty('input')
      expect(fixture).toHaveProperty('expected')
    })

    it('should throw error for non-existent fixture', () => {
      expect(() => FixtureLoader.load('non-existent')).toThrow()
    })

    it('should return all fixture names', () => {
      const fixtures = FixtureLoader.getAllFixtures()
      expect(Array.isArray(fixtures)).toBe(true)
      expect(fixtures.length).toBeGreaterThan(0)
    })
  })

  describe('CodeComparator', () => {
    it('should normalize code correctly', () => {
      const code = '  const x = 1;  \n  const y = 2;  '
      const normalized = CodeComparator.normalize(code)
      expect(normalized).toBe('const x = 1;\n  const y = 2;')
    })

    it('should compare code correctly', () => {
      const code1 = 'const x = 1;'
      const code2 = 'const x = 1;'
      expect(CodeComparator.compare(code1, code2)).toBe(true)
    })

    it('should handle whitespace differences', () => {
      const code1 = 'const x = 1;'
      const code2 = 'const  x  =  1;'
      expect(CodeComparator.compare(code1, code2, { ignoreWhitespace: true })).toBe(true)
    })
  })

  describe('SyntaxValidator', () => {
    it('should validate correct JavaScript', () => {
      expect(SyntaxValidator.isValidJavaScript('const x = 1;')).toBe(true)
    })

    it('should reject invalid JavaScript', () => {
      expect(SyntaxValidator.isValidJavaScript('const x = {')).toBe(false)
    })

    it('should provide detailed validation', () => {
      const result = SyntaxValidator.validateSyntax('const x = 1;')
      expect(result.valid).toBe(true)
      expect(result.error).toBe(null)
    })
  })
})