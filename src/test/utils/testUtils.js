import { render } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * Test utility for loading code fixtures
 */
export class FixtureLoader {
  static fixtures = {
    'comma-dangle': {
      input: `const obj = {
  a: 1,
  b: 2,
}`,
      expected: `const obj = {
  a: 1,
  b: 2
}`
    },
    'indent': {
      input: `function test() {
if (true) {
console.log('hello');
}
}`,
      expected: `function test() {
  if (true) {
    console.log('hello');
  }
}`
    },
    'no-var': {
      input: `var x = 1;
var y = 2;`,
      expected: `let x = 1;
let y = 2;`
    },
    'prefer-const': {
      input: `let x = 1;
let y = 2;
y = 3;`,
      expected: `const x = 1;
let y = 2;
y = 3;`
    },
    'no-console': {
      input: `console.log('debug');
console.error('error');`,
      expected: `// console.log('debug');
// console.error('error');`
    },
    'curly': {
      input: `if (true) console.log('test');`,
      expected: `if (true) {
  console.log('test');
}`
    },
    'brace-style': {
      input: `if (true)
{
  console.log('test');
}`,
      expected: `if (true) {
  console.log('test');
}`
    },
    'space-before-blocks': {
      input: `if (true){
  console.log('test');
}`,
      expected: `if (true) {
  console.log('test');
}`
    },
    'quotes': {
      input: `const str = "hello world";`,
      expected: `const str = 'hello world';`
    },
    'semi': {
      input: `const x = 1
const y = 2`,
      expected: `const x = 1;
const y = 2;`
    }
  }

  static load(fixtureName) {
    const fixture = this.fixtures[fixtureName]
    if (!fixture) {
      throw new Error(`Fixture '${fixtureName}' not found`)
    }
    return fixture
  }

  static getAllFixtures() {
    return Object.keys(this.fixtures)
  }
}

/**
 * Test utility for comparing code strings
 */
export class CodeComparator {
  static normalize(code) {
    return code
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\s+$/gm, '') // Remove trailing whitespace
  }

  static compare(actual, expected, options = {}) {
    const normalizedActual = this.normalize(actual)
    const normalizedExpected = this.normalize(expected)
    
    if (options.ignoreWhitespace) {
      return normalizedActual.replace(/\s+/g, ' ') === normalizedExpected.replace(/\s+/g, ' ')
    }
    
    return normalizedActual === normalizedExpected
  }

  static getDiff(actual, expected) {
    const normalizedActual = this.normalize(actual)
    const normalizedExpected = this.normalize(expected)
    
    return {
      actual: normalizedActual,
      expected: normalizedExpected,
      match: normalizedActual === normalizedExpected
    }
  }
}

/**
 * Test utility for mocking ESLint errors
 */
export class ESLintErrorMocker {
  static createError(ruleId, line = 1, column = 1, overrides = {}) {
    return {
      ruleId,
      message: `${ruleId} violation`,
      line,
      column,
      endLine: line,
      endColumn: column + 10,
      severity: 'error',
      nodeType: 'Identifier',
      source: 'test source',
      ...overrides
    }
  }

  static createMultipleErrors(rules) {
    return rules.map((rule, index) => {
      if (typeof rule === 'string') {
        return this.createError(rule, index + 1, 1)
      }
      return this.createError(rule.ruleId, rule.line || index + 1, rule.column || 1, rule)
    })
  }
}

/**
 * Test utility for mocking file operations
 */
export class FileOperationMocker {
  static mockFileUpload(content, filename = 'test.js') {
    const file = new File([content], filename, { type: 'text/javascript' })
    return file
  }

  static mockFileReader(content) {
    const mockFileReader = {
      readAsText: vi.fn((file) => {
        setTimeout(() => {
          mockFileReader.onload({ target: { result: content } })
        }, 0)
      }),
      onload: vi.fn(),
      onerror: vi.fn()
    }
    
    global.FileReader = vi.fn(() => mockFileReader)
    return mockFileReader
  }
}

/**
 * Custom render function with common providers
 */
export function renderWithProviders(ui, options = {}) {
  return render(ui, {
    ...options
  })
}

/**
 * Test utility for validating JavaScript syntax
 */
export class SyntaxValidator {
  static isValidJavaScript(code) {
    try {
      new Function(code)
      return true
    } catch (error) {
      return false
    }
  }

  static validateSyntax(code) {
    try {
      new Function(code)
      return { valid: true, error: null }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }
}

/**
 * Test utility for creating mock fixer results
 */
export class FixerResultMocker {
  static createSuccessResult(code, message = 'Fix applied successfully') {
    return {
      success: true,
      code,
      message,
      warnings: []
    }
  }

  static createFailureResult(message = 'Fix failed', warnings = []) {
    return {
      success: false,
      code: null,
      message,
      warnings
    }
  }

  static createWarningResult(code, message = 'Fix applied with warnings', warnings = ['Warning message']) {
    return {
      success: true,
      code,
      message,
      warnings
    }
  }
}