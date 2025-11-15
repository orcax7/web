import { describe, it, expect } from 'vitest'
import { fixtures, complexFixtures, edgeCases } from '../fixtures/index.js'
import { ValidationRunner } from '../validation/codeValidator.js'

/**
 * Automated test runner for fixer fixtures
 */
export class FixtureTestRunner {
  constructor(fixerClass, ruleId) {
    this.fixerClass = fixerClass
    this.ruleId = ruleId
    this.fixer = null
  }

  /**
   * Run all fixture tests for this fixer
   */
  runFixtureTests() {
    describe(`${this.ruleId} Fixture Tests`, () => {
      beforeEach(() => {
        this.fixer = new this.fixerClass()
      })

      this.runBasicFixtures()
      this.runEdgeCaseTests()
      this.runValidationTests()
      this.runPerformanceTests()
    })
  }

  /**
   * Run basic fixture tests
   */
  runBasicFixtures() {
    describe('basic fixtures', () => {
      const ruleFixtures = fixtures[this.ruleId]
      
      if (!ruleFixtures) {
        it.skip(`No fixtures found for rule ${this.ruleId}`, () => {})
        return
      }

      Object.entries(ruleFixtures).forEach(([testName, fixture]) => {
        it(`should fix ${testName}: ${fixture.description}`, () => {
          const error = global.createMockESLintError({ 
            ruleId: this.ruleId,
            line: 1,
            column: 1
          })

          const canFix = this.fixer.canFix(fixture.input, error)
          expect(canFix).toBe(true)

          const result = this.fixer.fix(fixture.input, error)
          expect(result.success).toBe(true)
          
          // Normalize whitespace for comparison
          const normalizedResult = result.code.trim().replace(/\s+/g, ' ')
          const normalizedExpected = fixture.expected.trim().replace(/\s+/g, ' ')
          
          expect(normalizedResult).toBe(normalizedExpected)
        })
      })
    })
  }

  /**
   * Run edge case tests
   */
  runEdgeCaseTests() {
    describe('edge cases', () => {
      Object.entries(edgeCases).forEach(([testName, fixture]) => {
        it(`should handle ${testName}: ${fixture.description}`, () => {
          const error = global.createMockESLintError({ 
            ruleId: this.ruleId,
            line: 1,
            column: 1
          })

          if (fixture.expected === null) {
            // Should not be fixable
            const canFix = this.fixer.canFix(fixture.input, error)
            expect(canFix).toBe(false)
          } else {
            // Should handle gracefully
            const canFix = this.fixer.canFix(fixture.input, error)
            if (canFix) {
              const result = this.fixer.fix(fixture.input, error)
              expect(result.success).toBe(true)
              
              const validation = ValidationRunner.validateFix(
                fixture.input, 
                result.code,
                { checkFormatting: true, checkSemantics: true }
              )
              expect(validation.valid).toBe(true)
            }
          }
        })
      })
    })
  }

  /**
   * Run validation tests
   */
  runValidationTests() {
    describe('validation tests', () => {
      const ruleFixtures = fixtures[this.ruleId]
      
      if (!ruleFixtures) return

      Object.entries(ruleFixtures).forEach(([testName, fixture]) => {
        it(`should produce valid code for ${testName}`, () => {
          const error = global.createMockESLintError({ 
            ruleId: this.ruleId,
            line: 1,
            column: 1
          })

          const result = this.fixer.fix(fixture.input, error)
          expect(result.success).toBe(true)

          const validation = ValidationRunner.validateFix(
            fixture.input,
            result.code,
            { 
              checkFormatting: true, 
              checkSemantics: true 
            }
          )

          expect(validation.valid).toBe(true)
          
          if (!validation.valid) {
            console.error('Validation failed:', validation.results)
          }
        })
      })
    })
  }

  /**
   * Run performance tests
   */
  runPerformanceTests() {
    describe('performance tests', () => {
      const ruleFixtures = fixtures[this.ruleId]
      
      if (!ruleFixtures) return

      it('should fix code within acceptable time limits', async () => {
        const fixture = Object.values(ruleFixtures)[0] // Use first fixture
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 1
        })

        const start = performance.now()
        const result = this.fixer.fix(fixture.input, error)
        const end = performance.now()

        expect(result.success).toBe(true)
        expect(end - start).toBeLessThan(100) // Should complete within 100ms
      })

      it('should handle large code efficiently', async () => {
        const largeCode = Array(100).fill(fixtures[this.ruleId]?.[Object.keys(fixtures[this.ruleId])[0]]?.input || 'const x = 1').join('\n')
        const error = global.createMockESLintError({ 
          ruleId: this.ruleId,
          line: 1,
          column: 1
        })

        const start = performance.now()
        const canFix = this.fixer.canFix(largeCode, error)
        const end = performance.now()

        expect(end - start).toBeLessThan(500) // Should analyze within 500ms
      })
    })
  }
}

/**
 * Test runner for complex multi-rule scenarios
 */
export class ComplexFixtureTestRunner {
  constructor(fixerRegistry) {
    this.fixerRegistry = fixerRegistry
  }

  runComplexTests() {
    describe('Complex Multi-Rule Scenarios', () => {
      Object.entries(complexFixtures).forEach(([testName, fixture]) => {
        it(`should handle ${testName}: ${fixture.description}`, async () => {
          let currentCode = fixture.input
          const appliedRules = []

          // Apply each rule in sequence
          for (const ruleId of fixture.rules) {
            const fixer = this.fixerRegistry.getFixer(ruleId)
            if (!fixer) continue

            const error = global.createMockESLintError({ 
              ruleId,
              line: 1,
              column: 1
            })

            if (fixer.canFix(currentCode, error)) {
              const result = fixer.fix(currentCode, error)
              if (result.success) {
                currentCode = result.code
                appliedRules.push(ruleId)
              }
            }
          }

          // Validate final result
          const validation = ValidationRunner.validateFix(
            fixture.input,
            currentCode,
            { checkFormatting: true, checkSemantics: true }
          )

          expect(validation.valid).toBe(true)
          expect(appliedRules.length).toBeGreaterThan(0)

          // Check that the result is close to expected
          // (exact match might not be possible due to rule interaction)
          const normalizedResult = currentCode.trim().replace(/\s+/g, ' ')
          const normalizedExpected = fixture.expected.trim().replace(/\s+/g, ' ')
          
          // Allow some flexibility in complex scenarios
          const similarity = this.calculateSimilarity(normalizedResult, normalizedExpected)
          expect(similarity).toBeGreaterThan(0.8) // 80% similarity threshold
        })
      })
    })
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }
}

/**
 * Regression test runner
 */
export class RegressionTestRunner {
  constructor(fixerRegistry) {
    this.fixerRegistry = fixerRegistry
    this.knownGoodResults = new Map()
  }

  /**
   * Record current results as baseline
   */
  recordBaseline() {
    Object.entries(fixtures).forEach(([ruleId, ruleFixtures]) => {
      const fixer = this.fixerRegistry.getFixer(ruleId)
      if (!fixer) return

      const results = {}
      Object.entries(ruleFixtures).forEach(([testName, fixture]) => {
        const error = global.createMockESLintError({ 
          ruleId,
          line: 1,
          column: 1
        })

        try {
          const result = fixer.fix(fixture.input, error)
          results[testName] = {
            success: result.success,
            code: result.code,
            message: result.message
          }
        } catch (err) {
          results[testName] = {
            success: false,
            error: err.message
          }
        }
      })

      this.knownGoodResults.set(ruleId, results)
    })
  }

  /**
   * Run regression tests against baseline
   */
  runRegressionTests() {
    describe('Regression Tests', () => {
      this.knownGoodResults.forEach((baselineResults, ruleId) => {
        describe(`${ruleId} regression`, () => {
          const fixer = this.fixerRegistry.getFixer(ruleId)
          
          if (!fixer) {
            it.skip(`Fixer not found for ${ruleId}`, () => {})
            return
          }

          Object.entries(baselineResults).forEach(([testName, baseline]) => {
            it(`should maintain behavior for ${testName}`, () => {
              const fixture = fixtures[ruleId][testName]
              const error = global.createMockESLintError({ 
                ruleId,
                line: 1,
                column: 1
              })

              const result = fixer.fix(fixture.input, error)
              
              expect(result.success).toBe(baseline.success)
              
              if (baseline.success) {
                expect(result.code).toBe(baseline.code)
              }
            })
          })
        })
      })
    })
  }
}

export default FixtureTestRunner