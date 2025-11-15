import { vi } from 'vitest'

/**
 * Mock helpers for ESLint operations
 */
export const mockESLint = {
  /**
   * Create a mock ESLint instance
   */
  createInstance: () => ({
    lintText: vi.fn().mockResolvedValue([{
      messages: [],
      errorCount: 0,
      warningCount: 0,
      filePath: 'test.js'
    }]),
    loadFormatter: vi.fn().mockResolvedValue({
      format: vi.fn().mockReturnValue('formatted output')
    })
  }),

  /**
   * Create mock ESLint results with errors
   */
  createResultsWithErrors: (errors) => [{
    messages: errors,
    errorCount: errors.filter(e => e.severity === 'error').length,
    warningCount: errors.filter(e => e.severity === 'warning').length,
    filePath: 'test.js'
  }],

  /**
   * Create a mock ESLint error
   */
  createError: (ruleId, line = 1, column = 1, overrides = {}) => ({
    ruleId,
    message: `${ruleId} violation at line ${line}`,
    line,
    column,
    endLine: overrides.endLine || line,
    endColumn: overrides.endColumn || column + 10,
    severity: overrides.severity || 'error',
    nodeType: overrides.nodeType || 'Identifier',
    source: overrides.source || 'test source'
  })
}

/**
 * Mock helpers for file operations
 */
export const mockFileOperations = {
  /**
   * Mock FileReader for file upload testing
   */
  mockFileReader: (content) => {
    const mockReader = {
      readAsText: vi.fn(),
      onload: null,
      onerror: null,
      result: content
    }

    // Simulate async file reading
    mockReader.readAsText.mockImplementation(() => {
      setTimeout(() => {
        if (mockReader.onload) {
          mockReader.onload({ target: { result: content } })
        }
      }, 0)
    })

    global.FileReader = vi.fn(() => mockReader)
    return mockReader
  },

  /**
   * Create a mock File object
   */
  createMockFile: (content, filename = 'test.js', type = 'text/javascript') => {
    return new File([content], filename, { type })
  },

  /**
   * Mock URL.createObjectURL
   */
  mockCreateObjectURL: () => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url')
    global.URL.revokeObjectURL = vi.fn()
  }
}

/**
 * Mock helpers for DOM operations
 */
export const mockDOMOperations = {
  /**
   * Mock document.createElement for download functionality
   */
  mockDownload: () => {
    const mockElement = {
      click: vi.fn(),
      setAttribute: vi.fn(),
      style: {}
    }
    
    const originalCreateElement = document.createElement
    document.createElement = vi.fn((tagName) => {
      if (tagName === 'a') {
        return mockElement
      }
      return originalCreateElement.call(document, tagName)
    })

    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()

    return mockElement
  },

  /**
   * Mock clipboard operations
   */
  mockClipboard: () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(),
      readText: vi.fn().mockResolvedValue('clipboard content')
    }

    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    })

    return mockClipboard
  }
}

/**
 * Mock helpers for Monaco Editor
 */
export const mockMonacoEditor = {
  /**
   * Create a mock Monaco Editor instance
   */
  createInstance: () => ({
    getValue: vi.fn().mockReturnValue(''),
    setValue: vi.fn(),
    getModel: vi.fn().mockReturnValue({
      updateOptions: vi.fn(),
      onDidChangeContent: vi.fn()
    }),
    updateOptions: vi.fn(),
    focus: vi.fn(),
    layout: vi.fn(),
    dispose: vi.fn()
  }),

  /**
   * Mock Monaco Editor component
   */
  mockComponent: () => {
    return vi.fn(({ value, onChange, onMount }) => {
      const mockEditor = mockMonacoEditor.createInstance()
      
      if (onMount) {
        setTimeout(() => onMount(mockEditor), 0)
      }

      return {
        type: 'div',
        props: {
          'data-testid': 'monaco-editor',
          'data-value': value,
          onClick: () => onChange && onChange('new value')
        }
      }
    })
  }
}

/**
 * Mock helpers for batch processing
 */
export const mockBatchProcessing = {
  /**
   * Create a mock progress callback
   */
  createProgressCallback: () => {
    const callback = vi.fn()
    callback.calls = []
    
    const wrappedCallback = (progress) => {
      callback.calls.push(progress)
      callback(progress)
    }
    
    wrappedCallback.getCalls = () => callback.calls
    wrappedCallback.getLastCall = () => callback.calls[callback.calls.length - 1]
    
    return wrappedCallback
  },

  /**
   * Create mock batch result
   */
  createBatchResult: (appliedFixes = [], failedFixes = []) => ({
    finalCode: 'fixed code',
    appliedFixes,
    failedFixes,
    totalErrors: appliedFixes.length + failedFixes.length,
    fixedErrors: appliedFixes.length
  })
}

/**
 * Utility to restore all mocks
 */
export const restoreAllMocks = () => {
  vi.restoreAllMocks()
  
  // Restore global objects
  if (global.FileReader) {
    delete global.FileReader
  }
  
  if (global.URL && global.URL.createObjectURL) {
    delete global.URL.createObjectURL
    delete global.URL.revokeObjectURL
  }
}