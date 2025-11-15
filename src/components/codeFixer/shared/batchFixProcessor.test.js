import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BatchFixProcessor } from './batchFixProcessor.js'
import { FixerRegistry } from '../registry/fixerRegistry.js'
import { SyntaxValidator } from '../../../test/utils/testUtils.js'
import { mockBatchProcessing } from '../../../test/utils/mockHelpers.js'

describe('BatchFixProcessor', () => {
  let processor
  let mockRegistry

  beforeEach(() => {
    // Mock the fixer registry
    mockRegistry = {
      getFixer: vi.fn(),
      getFixableRules: vi.fn().mockReturnValue(['semi', 'no-var', 'prefer-const'])
    }
    
    processor = new BatchFixProcessor(mockRegistry)
  })

  describe('basic batch processing', () => {
    it('should process multiple fixes successfully', async () => {
      const code = `var x = 1\nlet y = 2`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 }),
        global.createMockESLintError({ ruleId: 'prefer-const', line: 2, column: 1 })
      ]

      // Mock fixers
      const mockSemiFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `var x = 1;\nlet y = 2`,
          message: 'Added semicolon'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      const mockNoVarFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `let x = 1;\nlet y = 2`,
          message: 'Converted var to let'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      const mockPreferConstFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `let x = 1;\nconst y = 2`,
          message: 'Converted let to const'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => {
        switch (ruleId) {
          case 'semi': return mockSemiFixer
          case 'no-var': return mockNoVarFixer
          case 'prefer-const': return mockPreferConstFixer
          default: return null
        }
      })

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(3)
      expect(result.fixedErrors).toBe(3)
      expect(result.appliedFixes).toHaveLength(3)
      expect(result.failedFixes).toHaveLength(0)
      expect(SyntaxValidator.isValidJavaScript(result.finalCode)).toBe(true)
    })

    it('should handle mixed success and failure', async () => {
      const code = `var x = 1\nlet y = 2`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'unknown-rule', line: 2, column: 1 })
      ]

      const mockSemiFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `var x = 1;\nlet y = 2`,
          message: 'Added semicolon'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => {
        return ruleId === 'semi' ? mockSemiFixer : null
      })

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(2)
      expect(result.fixedErrors).toBe(1)
      expect(result.appliedFixes).toHaveLength(1)
      expect(result.failedFixes).toHaveLength(1)
      expect(result.failedFixes[0].ruleId).toBe('unknown-rule')
    })

    it('should re-lint after each fix', async () => {
      const code = `var x = 1`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })
      ]

      const mockSemiFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `var x = 1;`,
          message: 'Added semicolon'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      const mockNoVarFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: `let x = 1;`,
          message: 'Converted var to let'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => {
        switch (ruleId) {
          case 'semi': return mockSemiFixer
          case 'no-var': return mockNoVarFixer
          default: return null
        }
      })

      // Mock the relint function
      processor.relintCode = vi.fn()
        .mockResolvedValueOnce([global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })])
        .mockResolvedValueOnce([])

      const result = await processor.processBatch(code, errors)
      
      expect(processor.relintCode).toHaveBeenCalledTimes(2)
      expect(result.fixedErrors).toBe(2)
    })
  })

  describe('progress tracking', () => {
    it('should report progress during batch processing', async () => {
      const code = `var x = 1\nlet y = 2`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })
      ]

      const mockFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: 'fixed code',
          message: 'Fixed'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockReturnValue(mockFixer)

      const progressCallback = mockBatchProcessing.createProgressCallback()
      await processor.processBatch(code, errors, progressCallback)
      
      expect(progressCallback).toHaveBeenCalled()
      
      const calls = progressCallback.getCalls()
      expect(calls.length).toBeGreaterThan(0)
      
      // Check that progress goes from 0 to total
      const firstCall = calls[0]
      const lastCall = calls[calls.length - 1]
      
      expect(firstCall.current).toBe(0)
      expect(lastCall.current).toBe(lastCall.total)
      expect(lastCall.phase).toBe('complete')
    })

    it('should report different phases', async () => {
      const code = `var x = 1`
      const errors = [global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 })]

      const mockFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: 'var x = 1;',
          message: 'Fixed'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockReturnValue(mockFixer)

      const progressCallback = mockBatchProcessing.createProgressCallback()
      await processor.processBatch(code, errors, progressCallback)
      
      const calls = progressCallback.getCalls()
      const phases = calls.map(call => call.phase)
      
      expect(phases).toContain('analyzing')
      expect(phases).toContain('fixing')
      expect(phases).toContain('validating')
      expect(phases).toContain('complete')
    })
  })

  describe('error handling', () => {
    it('should handle fixer exceptions gracefully', async () => {
      const code = `var x = 1`
      const errors = [global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 })]

      const mockFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockImplementation(() => {
          throw new Error('Fixer error')
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockReturnValue(mockFixer)

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(1)
      expect(result.fixedErrors).toBe(0)
      expect(result.failedFixes).toHaveLength(1)
      expect(result.failedFixes[0].message).toContain('Fixer error')
    })

    it('should stop on validation failure', async () => {
      const code = `var x = 1`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })
      ]

      const mockSemiFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: 'invalid syntax {',
          message: 'Fixed'
        }),
        validate: vi.fn().mockReturnValue(false)
      }

      const mockNoVarFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockReturnValue({
          success: true,
          code: 'let x = 1;',
          message: 'Fixed'
        }),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => {
        switch (ruleId) {
          case 'semi': return mockSemiFixer
          case 'no-var': return mockNoVarFixer
          default: return null
        }
      })

      const result = await processor.processBatch(code, errors)
      
      expect(result.fixedErrors).toBe(0)
      expect(result.failedFixes).toHaveLength(1)
      expect(result.finalCode).toBe(code) // Should revert to original
    })

    it('should handle empty error list', async () => {
      const code = `const x = 1;`
      const errors = []

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(0)
      expect(result.fixedErrors).toBe(0)
      expect(result.appliedFixes).toHaveLength(0)
      expect(result.failedFixes).toHaveLength(0)
      expect(result.finalCode).toBe(code)
    })

    it('should handle malformed code', async () => {
      const code = `const x = {`
      const errors = [global.createMockESLintError({ ruleId: 'semi', line: 1, column: 11 })]

      const mockFixer = {
        canFix: vi.fn().mockReturnValue(false),
        fix: vi.fn(),
        validate: vi.fn()
      }

      mockRegistry.getFixer.mockReturnValue(mockFixer)

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(1)
      expect(result.fixedErrors).toBe(0)
      expect(result.failedFixes).toHaveLength(1)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complex multi-rule scenarios', async () => {
      const code = `var x = 1
let y = 2
if (true) console.log(x, y)`
      
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'semi', line: 2, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 }),
        global.createMockESLintError({ ruleId: 'prefer-const', line: 2, column: 1 }),
        global.createMockESLintError({ ruleId: 'curly', line: 3, column: 11 })
      ]

      // Mock multiple fixers
      const fixers = {
        'semi': {
          canFix: vi.fn().mockReturnValue(true),
          fix: vi.fn().mockImplementation((code) => ({
            success: true,
            code: code.replace(/([^;])\n/g, '$1;\n'),
            message: 'Added semicolons'
          })),
          validate: vi.fn().mockReturnValue(true)
        },
        'no-var': {
          canFix: vi.fn().mockReturnValue(true),
          fix: vi.fn().mockImplementation((code) => ({
            success: true,
            code: code.replace(/var /g, 'let '),
            message: 'Converted var to let'
          })),
          validate: vi.fn().mockReturnValue(true)
        },
        'prefer-const': {
          canFix: vi.fn().mockReturnValue(true),
          fix: vi.fn().mockImplementation((code) => ({
            success: true,
            code: code.replace(/let y = 2/g, 'const y = 2'),
            message: 'Converted let to const'
          })),
          validate: vi.fn().mockReturnValue(true)
        },
        'curly': {
          canFix: vi.fn().mockReturnValue(true),
          fix: vi.fn().mockImplementation((code) => ({
            success: true,
            code: code.replace(/if \(true\) console\.log\(x, y\)/, 'if (true) {\n  console.log(x, y);\n}'),
            message: 'Added braces'
          })),
          validate: vi.fn().mockReturnValue(true)
        }
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => fixers[ruleId] || null)

      const result = await processor.processBatch(code, errors)
      
      expect(result.totalErrors).toBe(5)
      expect(result.fixedErrors).toBeGreaterThan(0)
      expect(SyntaxValidator.isValidJavaScript(result.finalCode)).toBe(true)
    })

    it('should maintain code quality throughout batch processing', async () => {
      const code = `var x = 1\nvar y = 2`
      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'semi', line: 2, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 2, column: 1 })
      ]

      const mockSemiFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockImplementation((code) => ({
          success: true,
          code: code.replace(/([^;])\n/g, '$1;\n').replace(/([^;])$/, '$1;'),
          message: 'Added semicolons'
        })),
        validate: vi.fn().mockReturnValue(true)
      }

      const mockNoVarFixer = {
        canFix: vi.fn().mockReturnValue(true),
        fix: vi.fn().mockImplementation((code) => ({
          success: true,
          code: code.replace(/var /g, 'let '),
          message: 'Converted var to let'
        })),
        validate: vi.fn().mockReturnValue(true)
      }

      mockRegistry.getFixer.mockImplementation((ruleId) => {
        switch (ruleId) {
          case 'semi': return mockSemiFixer
          case 'no-var': return mockNoVarFixer
          default: return null
        }
      })

      const result = await processor.processBatch(code, errors)
      
      expect(result.fixedErrors).toBe(4)
      expect(SyntaxValidator.isValidJavaScript(result.finalCode)).toBe(true)
      expect(result.finalCode).toContain('let x = 1;')
      expect(result.finalCode).toContain('let y = 2;')
    })
  })
})