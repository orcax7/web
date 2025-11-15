import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fixtures, complexFixtures, edgeCases, performanceFixtures } from '../fixtures/index.js'
import { ValidationRunner, PerformanceValidator } from '../validation/codeValidator.js'
import { FixtureTestRunner, ComplexFixtureTestRunner, RegressionTestRunner } from '../runners/fixtureTestRunner.js'

// Import all fixers
import { CommaDangleFixer } from '../../components/codeFixer/commaDangle.js'
import { IndentFixer } from '../../components/codeFixer/indent.js'
import { NoVarFixer } from '../../components/codeFixer/noVar.js'
import { PreferConstFixer } from '../../components/codeFixer/preferConst.js'
import { NoConsoleFixer } from '../../components/codeFixer/noConsole.js'
import { CurlyFixer } from '../../components/codeFixer/curly.js'
import { BraceStyleFixer } from '../../components/codeFixer/braceStyle.js'
import { SpaceBeforeBlocksFixer } from '../../components/codeFixer/spaceBeforeBlocks.js'
import { NoPlusPlusFixer } from '../../components/codeFixer/noPlusplus.js'
import { PreferTemplateFixer } from '../../components/codeFixer/preferTemplate.js'
import { PreferForOfFixer } from '../../components/codeFixer/preferForOf.js'
import { FixerRegistry } from '../../components/codeFixer/registry/fixerRegistry.js'

describe('Comprehensive ESLint Auto-Fix Test Suite', () => {
  let fixerRegistry

  beforeAll(() => {
    // Set up fixer registry
    fixerRegistry = new FixerRegistry()
    
    // Register all fixers
    fixerRegistry.register(new CommaDangleFixer())
    fixerRegistry.register(new IndentFixer())
    fixerRegistry.register(new NoVarFixer())
    fixerRegistry.register(new PreferConstFixer())
    fixerRegistry.register(new NoConsoleFixer())
    fixerRegistry.register(new CurlyFixer())
    fixerRegistry.register(new BraceStyleFixer())
    fixerRegistry.register(new SpaceBeforeBlocksFixer())
    fixerRegistry.register(new NoPlusPlusFixer())
    fixerRegistry.register(new PreferTemplateFixer())
    fixerRegistry.register(new PreferForOfFixer())
  })

  describe('Individual Fixer Tests', () => {
    const fixerClasses = [
      { class: CommaDangleFixer, ruleId: 'comma-dangle' },
      { class: IndentFixer, ruleId: 'indent' },
      { class: NoVarFixer, ruleId: 'no-var' },
      { class: PreferConstFixer, ruleId: 'prefer-const' },
      { class: NoConsoleFixer, ruleId: 'no-console' },
      { class: CurlyFixer, ruleId: 'curly' },
      { class: BraceStyleFixer, ruleId: 'brace-style' },
      { class: SpaceBeforeBlocksFixer, ruleId: 'space-before-blocks' },
      { class: NoPlusPlusFixer, ruleId: 'no-plusplus' },
      { class: PreferTemplateFixer, ruleId: 'prefer-template' },
      { class: PreferForOfFixer, ruleId: 'prefer-for-of' }
    ]

    fixerClasses.forEach(({ class: FixerClass, ruleId }) => {
      describe(`${ruleId} comprehensive tests`, () => {
        const runner = new FixtureTestRunner(FixerClass, ruleId)
        runner.runFixtureTests()
      })
    })
  })

  describe('Cross-Fixer Integration Tests', () => {
    it('should handle all fixers working together', () => {
      const testCode = `var x = 1
let y = 2
if (true) console.log(x, y)`

      const errors = [
        global.createMockESLintError({ ruleId: 'semi', line: 1, column: 9 }),
        global.createMockESLintError({ ruleId: 'semi', line: 2, column: 9 }),
        global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 }),
        global.createMockESLintError({ ruleId: 'prefer-const', line: 2, column: 1 }),
        global.createMockESLintError({ ruleId: 'curly', line: 3, column: 11 }),
        global.createMockESLintError({ ruleId: 'no-console', line: 3, column: 11 })
      ]

      let currentCode = testCode
      const appliedFixes = []

      errors.forEach(error => {
        const fixer = fixerRegistry.getFixer(error.ruleId)
        if (fixer && fixer.canFix(currentCode, error)) {
          const result = fixer.fix(currentCode, error)
          if (result.success) {
            currentCode = result.code
            appliedFixes.push(error.ruleId)
          }
        }
      })

      expect(appliedFixes.length).toBeGreaterThan(0)
      
      const validation = ValidationRunner.validateFix(testCode, currentCode, {
        checkFormatting: true,
        checkSemantics: true
      })
      
      expect(validation.valid).toBe(true)
    })

    it('should maintain code quality across multiple fixes', () => {
      const complexCode = `var users = [{name: "John", age: 30,}, {name: "Jane", age: 25,}]
function processUsers(){
if(users.length > 0)console.log("Processing users")
for(var i = 0; i < users.length; i++){
let user = users[i]
console.log("User: " + user.name)
}
}`

      const rules = ['comma-dangle', 'no-var', 'prefer-const', 'curly', 'space-before-blocks', 'no-console']
      let currentCode = complexCode

      rules.forEach(ruleId => {
        const fixer = fixerRegistry.getFixer(ruleId)
        if (fixer) {
          const error = global.createMockESLintError({ ruleId, line: 1, column: 1 })
          if (fixer.canFix(currentCode, error)) {
            const result = fixer.fix(currentCode, error)
            if (result.success) {
              currentCode = result.code
            }
          }
        }
      })

      const validation = ValidationRunner.validateFix(complexCode, currentCode, {
        checkFormatting: true,
        checkSemantics: true
      })

      expect(validation.valid).toBe(true)
    })
  })

  describe('Complex Scenario Tests', () => {
    const complexRunner = new ComplexFixtureTestRunner(fixerRegistry)
    complexRunner.runComplexTests()
  })

  describe('Edge Case Validation', () => {
    Object.entries(edgeCases).forEach(([testName, fixture]) => {
      it(`should handle ${testName} gracefully`, () => {
        const rules = ['comma-dangle', 'indent', 'no-var', 'prefer-const', 'no-console', 'curly', 'brace-style', 'space-before-blocks']
        
        rules.forEach(ruleId => {
          const fixer = fixerRegistry.getFixer(ruleId)
          if (fixer) {
            const error = global.createMockESLintError({ ruleId, line: 1, column: 1 })
            
            // Should not throw errors
            expect(() => {
              const canFix = fixer.canFix(fixture.input, error)
              if (canFix) {
                const result = fixer.fix(fixture.input, error)
                expect(result).toHaveProperty('success')
                expect(result).toHaveProperty('code')
              }
            }).not.toThrow()
          }
        })
      })
    })
  })

  describe('Performance Tests', () => {
    it('should handle large files efficiently', async () => {
      const largeCode = performanceFixtures.large.input
      const fixer = fixerRegistry.getFixer('no-var')
      
      if (fixer) {
        const error = global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })
        
        const start = performance.now()
        const canFix = fixer.canFix(largeCode, error)
        const end = performance.now()
        
        expect(end - start).toBeLessThan(1000) // Should complete within 1 second
        
        if (canFix) {
          const fixStart = performance.now()
          const result = fixer.fix(largeCode, error)
          const fixEnd = performance.now()
          
          expect(result.success).toBe(true)
          expect(fixEnd - fixStart).toBeLessThan(2000) // Fix should complete within 2 seconds
        }
      }
    })

    it('should handle deeply nested code efficiently', async () => {
      const deepCode = performanceFixtures.deeplyNested.input
      const fixer = fixerRegistry.getFixer('curly')
      
      if (fixer) {
        const error = global.createMockESLintError({ ruleId: 'curly', line: 1, column: 1 })
        
        const start = performance.now()
        const canFix = fixer.canFix(deepCode, error)
        const end = performance.now()
        
        expect(end - start).toBeLessThan(500) // Should analyze within 500ms
      }
    })

    it('should maintain consistent performance across multiple runs', async () => {
      const testCode = `var x = 1\nlet y = 2\nconsole.log(x, y)`
      const fixer = fixerRegistry.getFixer('no-var')
      
      if (fixer) {
        const error = global.createMockESLintError({ ruleId: 'no-var', line: 1, column: 1 })
        const times = []
        
        // Run multiple times to check consistency
        for (let i = 0; i < 10; i++) {
          const start = performance.now()
          fixer.fix(testCode, error)
          const end = performance.now()
          times.push(end - start)
        }
        
        const average = times.reduce((a, b) => a + b, 0) / times.length
        const variance = times.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / times.length
        const standardDeviation = Math.sqrt(variance)
        
        // Performance should be consistent (low standard deviation)
        expect(standardDeviation).toBeLessThan(average * 0.5) // SD should be less than 50% of average
      }
    })
  })

  describe('Validation Comprehensive Tests', () => {
    it('should validate all fixture results', () => {
      const allResults = []
      
      Object.entries(fixtures).forEach(([ruleId, ruleFixtures]) => {
        const fixer = fixerRegistry.getFixer(ruleId)
        if (!fixer) return
        
        Object.entries(ruleFixtures).forEach(([testName, fixture]) => {
          const error = global.createMockESLintError({ ruleId, line: 1, column: 1 })
          
          if (fixer.canFix(fixture.input, error)) {
            const result = fixer.fix(fixture.input, error)
            if (result.success) {
              const validation = ValidationRunner.validateFix(
                fixture.input,
                result.code,
                { checkFormatting: true, checkSemantics: true }
              )
              
              allResults.push({
                ruleId,
                testName,
                valid: validation.valid,
                validation
              })
            }
          }
        })
      })
      
      const validCount = allResults.filter(r => r.valid).length
      const totalCount = allResults.length
      const successRate = (validCount / totalCount) * 100
      
      expect(successRate).toBeGreaterThan(95) // 95% success rate threshold
      
      // Log any failures for debugging
      const failures = allResults.filter(r => !r.valid)
      if (failures.length > 0) {
        console.warn('Validation failures:', failures.map(f => `${f.ruleId}:${f.testName}`))
      }
    })

    it('should maintain semantic correctness', () => {
      const semanticTests = [
        {
          input: `function test() { var x = 1; return x; }`,
          rules: ['no-var'],
          description: 'Variable scoping should be preserved'
        },
        {
          input: `let x = 1; let y = 2; x = 3; console.log(x, y);`,
          rules: ['prefer-const'],
          description: 'Only non-reassigned variables should become const'
        },
        {
          input: `if (condition) { console.log('test'); }`,
          rules: ['no-console'],
          description: 'Control flow should be preserved'
        }
      ]
      
      semanticTests.forEach(test => {
        let currentCode = test.input
        
        test.rules.forEach(ruleId => {
          const fixer = fixerRegistry.getFixer(ruleId)
          if (fixer) {
            const error = global.createMockESLintError({ ruleId, line: 1, column: 1 })
            if (fixer.canFix(currentCode, error)) {
              const result = fixer.fix(currentCode, error)
              if (result.success) {
                currentCode = result.code
              }
            }
          }
        })
        
        const validation = ValidationRunner.validateFix(test.input, currentCode, {
          checkSemantics: true
        })
        
        expect(validation.valid).toBe(true)
      })
    })
  })

  describe('Regression Tests', () => {
    let regressionRunner

    beforeAll(() => {
      regressionRunner = new RegressionTestRunner(fixerRegistry)
      regressionRunner.recordBaseline()
    })

    it('should maintain consistent behavior', () => {
      regressionRunner.runRegressionTests()
    })
  })

  describe('Error Handling Tests', () => {
    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        'const x = {',
        'function test() { return',
        'if (true',
        'var x = 1 var y = 2',
        '/*',
        '"unclosed string'
      ]
      
      malformedInputs.forEach(input => {
        const rules = ['comma-dangle', 'indent', 'no-var', 'prefer-const', 'no-console', 'curly', 'brace-style', 'space-before-blocks']
        
        rules.forEach(ruleId => {
          const fixer = fixerRegistry.getFixer(ruleId)
          if (fixer) {
            const error = global.createMockESLintError({ ruleId, line: 1, column: 1 })
            
            expect(() => {
              const canFix = fixer.canFix(input, error)
              if (canFix) {
                fixer.fix(input, error)
              }
            }).not.toThrow()
          }
        })
      })
    })

    it('should handle edge case errors gracefully', () => {
      const edgeCaseErrors = [
        { ruleId: 'unknown-rule', line: 1, column: 1 },
        { ruleId: 'comma-dangle', line: -1, column: 1 },
        { ruleId: 'indent', line: 1, column: -1 },
        { ruleId: 'no-var', line: 1000, column: 1000 }
      ]
      
      const testCode = 'const x = 1;'
      
      edgeCaseErrors.forEach(errorData => {
        const fixer = fixerRegistry.getFixer(errorData.ruleId)
        if (fixer) {
          const error = global.createMockESLintError(errorData)
          
          expect(() => {
            fixer.canFix(testCode, error)
          }).not.toThrow()
        }
      })
    })
  })
})