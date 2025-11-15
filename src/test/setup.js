import { vi } from 'vitest'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange }) => {
    return {
      type: 'div',
      props: {
        'data-testid': 'monaco-editor',
        children: value,
        onChange: onChange
      }
    }
  })
}))

// Mock ESLint
global.ESLint = vi.fn(() => ({
  lintText: vi.fn().mockResolvedValue([{
    messages: [],
    errorCount: 0,
    warningCount: 0
  }])
}))

// Setup global test utilities
global.createMockESLintError = (overrides = {}) => ({
  ruleId: 'test-rule',
  message: 'Test error message',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
  severity: 'error',
  nodeType: 'Identifier',
  source: 'test code',
  ...overrides
})

global.createMockFixResult = (overrides = {}) => ({
  success: true,
  code: 'fixed code',
  message: 'Fix applied successfully',
  warnings: [],
  ...overrides
})