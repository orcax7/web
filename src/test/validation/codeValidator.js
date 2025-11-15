/**
 * Code validation utilities for testing
 */

import { parse } from '@babel/parser'

/**
 * Validates JavaScript syntax using Babel parser
 */
export class SyntaxValidator {
  /**
   * Check if code is syntactically valid JavaScript
   */
  static isValidJavaScript(code) {
    try {
      parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get detailed syntax validation result
   */
  static validateSyntax(code) {
    try {
      const ast = parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      })
      
      return {
        valid: true,
        ast,
        error: null
      }
    } catch (error) {
      return {
        valid: false,
        ast: null,
        error: {
          message: error.message,
          line: error.loc?.line,
          column: error.loc?.column
        }
      }
    }
  }

  /**
   * Check if code follows basic formatting rules
   */
  static validateFormatting(code) {
    const issues = []

    // Check for consistent indentation
    const lines = code.split('\n')
    let expectedIndent = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '') continue

      const actualIndent = line.match(/^(\s*)/)[1].length
      const hasOpenBrace = line.includes('{')
      const hasCloseBrace = line.includes('}')

      if (hasCloseBrace && !hasOpenBrace) {
        expectedIndent = Math.max(0, expectedIndent - 2)
      }

      if (actualIndent !== expectedIndent && line.trim() !== '') {
        issues.push({
          line: i + 1,
          type: 'indentation',
          expected: expectedIndent,
          actual: actualIndent,
          message: `Expected ${expectedIndent} spaces, got ${actualIndent}`
        })
      }

      if (hasOpenBrace && !hasCloseBrace) {
        expectedIndent += 2
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

/**
 * Semantic validation utilities
 */
export class SemanticValidator {
  /**
   * Check if fix preserves code semantics
   */
  static validateSemantics(originalCode, fixedCode) {
    const originalValidation = SyntaxValidator.validateSyntax(originalCode)
    const fixedValidation = SyntaxValidator.validateSyntax(fixedCode)

    if (!originalValidation.valid || !fixedValidation.valid) {
      return {
        valid: false,
        reason: 'Syntax error in original or fixed code'
      }
    }

    // Basic semantic checks
    const checks = [
      this.checkVariableDeclarations,
      this.checkFunctionDeclarations,
      this.checkImportExports,
      this.checkControlFlow
    ]

    for (const check of checks) {
      const result = check(originalValidation.ast, fixedValidation.ast)
      if (!result.valid) {
        return result
      }
    }

    return { valid: true }
  }

  /**
   * Check that variable declarations are preserved
   */
  static checkVariableDeclarations(originalAst, fixedAst) {
    const originalVars = this.extractVariableNames(originalAst)
    const fixedVars = this.extractVariableNames(fixedAst)

    const missing = originalVars.filter(name => !fixedVars.includes(name))
    const added = fixedVars.filter(name => !originalVars.includes(name))

    if (missing.length > 0 || added.length > 0) {
      return {
        valid: false,
        reason: 'Variable declarations changed',
        details: { missing, added }
      }
    }

    return { valid: true }
  }

  /**
   * Check that function declarations are preserved
   */
  static checkFunctionDeclarations(originalAst, fixedAst) {
    const originalFunctions = this.extractFunctionNames(originalAst)
    const fixedFunctions = this.extractFunctionNames(fixedAst)

    const missing = originalFunctions.filter(name => !fixedFunctions.includes(name))
    const added = fixedFunctions.filter(name => !originalFunctions.includes(name))

    if (missing.length > 0 || added.length > 0) {
      return {
        valid: false,
        reason: 'Function declarations changed',
        details: { missing, added }
      }
    }

    return { valid: true }
  }

  /**
   * Check that imports/exports are preserved
   */
  static checkImportExports(originalAst, fixedAst) {
    const originalImports = this.extractImports(originalAst)
    const fixedImports = this.extractImports(fixedAst)

    if (JSON.stringify(originalImports) !== JSON.stringify(fixedImports)) {
      return {
        valid: false,
        reason: 'Import/export statements changed'
      }
    }

    return { valid: true }
  }

  /**
   * Check that control flow structure is preserved
   */
  static checkControlFlow(originalAst, fixedAst) {
    const originalStructure = this.extractControlFlowStructure(originalAst)
    const fixedStructure = this.extractControlFlowStructure(fixedAst)

    if (JSON.stringify(originalStructure) !== JSON.stringify(fixedStructure)) {
      return {
        valid: false,
        reason: 'Control flow structure changed'
      }
    }

    return { valid: true }
  }

  /**
   * Extract variable names from AST
   */
  static extractVariableNames(ast) {
    const names = []
    
    // This is a simplified implementation
    // In a real scenario, you'd use a proper AST traversal library
    const traverse = (node) => {
      if (!node || typeof node !== 'object') return

      if (node.type === 'VariableDeclarator' && node.id?.name) {
        names.push(node.id.name)
      }

      Object.values(node).forEach(child => {
        if (Array.isArray(child)) {
          child.forEach(traverse)
        } else if (child && typeof child === 'object') {
          traverse(child)
        }
      })
    }

    traverse(ast)
    return names
  }

  /**
   * Extract function names from AST
   */
  static extractFunctionNames(ast) {
    const names = []
    
    const traverse = (node) => {
      if (!node || typeof node !== 'object') return

      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        names.push(node.id.name)
      }

      Object.values(node).forEach(child => {
        if (Array.isArray(child)) {
          child.forEach(traverse)
        } else if (child && typeof child === 'object') {
          traverse(child)
        }
      })
    }

    traverse(ast)
    return names
  }

  /**
   * Extract import statements from AST
   */
  static extractImports(ast) {
    const imports = []
    
    const traverse = (node) => {
      if (!node || typeof node !== 'object') return

      if (node.type === 'ImportDeclaration') {
        imports.push({
          source: node.source?.value,
          specifiers: node.specifiers?.map(spec => ({
            type: spec.type,
            local: spec.local?.name,
            imported: spec.imported?.name
          }))
        })
      }

      Object.values(node).forEach(child => {
        if (Array.isArray(child)) {
          child.forEach(traverse)
        } else if (child && typeof child === 'object') {
          traverse(child)
        }
      })
    }

    traverse(ast)
    return imports
  }

  /**
   * Extract control flow structure from AST
   */
  static extractControlFlowStructure(ast) {
    const structure = []
    
    const traverse = (node, depth = 0) => {
      if (!node || typeof node !== 'object') return

      if (['IfStatement', 'WhileStatement', 'ForStatement', 'SwitchStatement'].includes(node.type)) {
        structure.push({ type: node.type, depth })
      }

      Object.values(node).forEach(child => {
        if (Array.isArray(child)) {
          child.forEach(c => traverse(c, depth + 1))
        } else if (child && typeof child === 'object') {
          traverse(child, depth + 1)
        }
      })
    }

    traverse(ast)
    return structure
  }
}

/**
 * Performance validation utilities
 */
export class PerformanceValidator {
  /**
   * Measure fix application performance
   */
  static async measureFixPerformance(fixer, code, error, iterations = 100) {
    const times = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fixer.fix(code, error)
      const end = performance.now()
      times.push(end - start)
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      average: times.reduce((a, b) => a + b, 0) / times.length,
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
      iterations
    }
  }

  /**
   * Validate that fix performance is acceptable
   */
  static validatePerformance(performanceResult, maxAverageTime = 100) {
    return {
      valid: performanceResult.average <= maxAverageTime,
      average: performanceResult.average,
      threshold: maxAverageTime,
      message: performanceResult.average > maxAverageTime 
        ? `Fix is too slow: ${performanceResult.average.toFixed(2)}ms > ${maxAverageTime}ms`
        : `Fix performance is acceptable: ${performanceResult.average.toFixed(2)}ms`
    }
  }
}

/**
 * Comprehensive validation runner
 */
export class ValidationRunner {
  /**
   * Run all validations on a fix result
   */
  static validateFix(originalCode, fixedCode, options = {}) {
    const results = {
      syntax: SyntaxValidator.validateSyntax(fixedCode),
      formatting: options.checkFormatting ? SyntaxValidator.validateFormatting(fixedCode) : { valid: true },
      semantics: options.checkSemantics ? SemanticValidator.validateSemantics(originalCode, fixedCode) : { valid: true }
    }

    const allValid = Object.values(results).every(result => result.valid)

    return {
      valid: allValid,
      results,
      summary: {
        syntaxValid: results.syntax.valid,
        formattingValid: results.formatting.valid,
        semanticsValid: results.semantics.valid
      }
    }
  }

  /**
   * Validate multiple fixes in batch
   */
  static validateBatchFixes(fixes, options = {}) {
    const results = fixes.map((fix, index) => ({
      index,
      ruleId: fix.ruleId,
      validation: this.validateFix(fix.originalCode, fix.fixedCode, options)
    }))

    const validCount = results.filter(r => r.validation.valid).length
    const invalidCount = results.length - validCount

    return {
      valid: invalidCount === 0,
      totalFixes: results.length,
      validFixes: validCount,
      invalidFixes: invalidCount,
      results,
      summary: {
        successRate: (validCount / results.length) * 100,
        failedRules: results
          .filter(r => !r.validation.valid)
          .map(r => r.ruleId)
      }
    }
  }
}