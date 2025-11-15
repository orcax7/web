import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FixtureLoader, CodeComparator, SyntaxValidator } from './testUtils.js'
import { restoreAllMocks } from './mockHelpers.js'

/**
 * Test runner for fixer implementations
 */
export class FixerTestRunner {
  constructor(fixerClass, ruleId) {
    this.fixerClass = fixerClass
    this.ruleId = ruleId
    this.fixer = null
  }

  /**
   * Run comprehensive tests for a fixer
   */
  runTests() {
    describe(`${this.ruleId} Fixer`, () => {
      beforeEach(() => {
        this.fixer = new this.fixerClass()
        vi.clearAllMocks()
      })

      afterEach(() => {
        restoreAllMocks()
      })

      this.testBasicFunctionality()
      this.testContextAwareness()
      this.testEdgeCases()
      this.testValidation()
    })
  }

  /**
   * Test basic fixer functionality
   */
  testBasicFunctionality() {
    describe('basic functionality', () => {
      it('should have correct rule ID', () => {
        expect(this.fixer.ruleId).toBe(this.ruleId)
      })

      it('should implement required interface methods', () => {
        expect(typeof this.fixer.canFix).toBe('function')
        expect(typeof this.fixer.fix).toBe('function')
        expect(typeof this.fixer.validate).toBe('function')
      })

      it('should fix basic violations', () => {
        const fixture = FixtureLoader.load(this.ruleId)
        const error = global.createMockESLintError({ ruleId: this.ruleId })
        
        const canFix = this.fixer.canFix(fixture.input, error)
        expect(canFix).toBe(true)

        const result = this.fixer.fix(fixture.input, error)
        expect(result.success).toBe(true)
        expect(CodeComparator.compare(result.code, fixture.expected)).toBe(true)
      })

      it('should produce syntactically valid JavaScript', () => {
        const fixture = FixtureLoader.load(this.ruleId)
        const error = global.createMockESLintError({ ruleId: this.ruleId })
        
        const result = this.fixer.fix(fixture.input, error)
        expect(result.success).toBe(true)
        
        const validation = SyntaxValidator.validateSyntax(result.code)
        expect(validation.valid).toBe(true)
      })
    })
  }

  /**
   * Test context awareness
   */
  testContextAwareness() {
    describe('context awareness', () => {
      it('should not modify content inside strings', () => {
        const codeWithString = `const str = "code with ${this.ruleId} violation";`
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 20
        })
        
        const canFix = this.fixer.canFix(codeWithString, error)
        expect(canFix).toBe(false)
      })

      it('should not modify content inside comments', () => {
        const codeWithComment = `// This comment has ${this.ruleId} violation\nconst x = 1;`
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 20
        })
        
        const canFix = this.fixer.canFix(codeWithComment, error)
        expect(canFix).toBe(false)
      })

      it('should not modify content inside template literals', () => {
        const codeWithTemplate = `const str = \`template with \${${this.ruleId}} violation\`;`
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 30
        })
        
        const canFix = this.fixer.canFix(codeWithTemplate, error)
        expect(canFix).toBe(false)
      })

      it('should handle regex literals safely', () => {
        const codeWithRegex = `const regex = /${this.ruleId}/g;`
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 15
        })
        
        const canFix = this.fixer.canFix(codeWithRegex, error)
        expect(canFix).toBe(false)
      })
    })
  }

  /**
   * Test edge cases
   */
  testEdgeCases() {
    describe('edge cases', () => {
      it('should handle empty code', () => {
        const error = global.createMockESLintError({ ruleId: this.ruleId })
        
        const canFix = this.fixer.canFix('', error)
        expect(canFix).toBe(false)
      })

      it('should handle malformed code gracefully', () => {
        const malformedCode = 'const x = {'
        const error = global.createMockESLintError({ ruleId: this.ruleId })
        
        const canFix = this.fixer.canFix(malformedCode, error)
        // Should either fix safely or refuse to fix
        if (canFix) {
          const result = this.fixer.fix(malformedCode, error)
          expect(result.success).toBe(true)
          expect(SyntaxValidator.isValidJavaScript(result.code)).toBe(true)
        }
      })

      it('should handle multiple violations on same line', () => {
        // This test is rule-specific and may need customization
        const fixture = FixtureLoader.load(this.ruleId)
        const error1 = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 1
        })
        const error2 = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 10
        })
        
        const canFix1 = this.fixer.canFix(fixture.input, error1)
        const canFix2 = this.fixer.canFix(fixture.input, error2)
        
        // At least one should be fixable
        expect(canFix1 || canFix2).toBe(true)
      })
    })
  }

  /**
   * Test validation functionality
   */
  testValidation() {
    describe('validation', () => {
      it('should validate successful fixes', () => {
        const fixture = FixtureLoader.load(this.ruleId)
        
        const isValid = this.fixer.validate(fixture.input, fixture.expected)
        expect(isValid).toBe(true)
      })

      it('should reject invalid fixes', () => {
        const fixture = FixtureLoader.load(this.ruleId)
        const invalidFixed = 'const x = {'
        
        const isValid = this.fixer.validate(fixture.input, invalidFixed)
        expect(isValid).toBe(false)
      })

      it('should handle validation of unchanged code', () => {
        const code = 'const x = 1;'
        
        const isValid = this.fixer.validate(code, code)
        expect(isValid).toBe(true)
      })
    })
  }
}

/**
 * Test runner for batch processing
 */
export class BatchProcessorTestRunner {
  constructor(batchProcessorClass) {
    this.batchProcessorClass = batchProcessorClass
    this.processor = null
  }

  runTests() {
    describe('Batch Fix Processor', () => {
      beforeEach(() => {
        this.processor = new this.batchProcessorClass()
        vi.clearAllMocks()
      })

      afterEach(() => {
        restoreAllMocks()
      })

      this.testBasicBatchProcessing()
      this.testErrorHandling()
      this.testProgressTracking()
    })
  }

  testBasicBatchProcessing() {
    describe('basic batch processing', () => {
      it('should process multiple fixes successfully', async () => {
        const code = 'const x = 1\nvar y = 2'
        const errors = [
          global.createMockESLintError({ ruleId: 'semi', line: 1 }),
          global.createMockESLintError({ ruleId: 'no-var', line: 2 })
        ]

        const result = await this.processor.processBatch(code, errors)
        
        expect(result.totalErrors).toBe(2)
        expect(result.fixedErrors).toBeGreaterThan(0)
        expect(result.finalCode).toBeDefined()
        expect(SyntaxValidator.isValidJavaScript(result.finalCode)).toBe(true)
      })
    })
  }

  testErrorHandling() {
    describe('error handling', () => {
      it('should handle unfixable errors gracefully', async () => {
        const code = 'const x = 1;'
        const errors = [
          global.createMockESLintError({ ruleId: 'unknown-rule' })
        ]

        const result = await this.processor.processBatch(code, errors)
        
        expect(result.totalErrors).toBe(1)
        expect(result.fixedErrors).toBe(0)
        expect(result.failedFixes).toHaveLength(1)
      })
    })
  }

  testProgressTracking() {
    describe('progress tracking', () => {
      it('should report progress during batch processing', async () => {
        const code = 'const x = 1\nvar y = 2'
        const errors = [
          global.createMockESLintError({ ruleId: 'semi', line: 1 }),
          global.createMockESLintError({ ruleId: 'no-var', line: 2 })
        ]

        const progressCallback = vi.fn()
        await this.processor.processBatch(code, errors, progressCallback)
        
        expect(progressCallback).toHaveBeenCalled()
        expect(progressCallback.mock.calls.length).toBeGreaterThan(0)
      })
    })
  }
}