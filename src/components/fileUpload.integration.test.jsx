import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileUpload from './fileUpload.jsx'
import { mockFileOperations, mockMonacoEditor, mockESLint } from '../test/utils/mockHelpers.js'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: mockMonacoEditor.mockComponent()
}))

describe('FileUpload Integration Tests', () => {
  let mockESLintInstance

  beforeEach(() => {
    mockESLintInstance = mockESLint.createInstance()
    global.ESLint = vi.fn(() => mockESLintInstance)
    
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('file upload and linting integration', () => {
    it('should upload file, lint code, and show results', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nlet y = 2`
      
      // Mock file operations
      mockFileOperations.mockFileReader(testCode)
      
      // Mock ESLint results
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('no-var', 1, 1),
        mockESLint.createError('prefer-const', 2, 1)
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      // Upload file
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      // Wait for file processing and linting
      await waitFor(() => {
        expect(screen.getByText(/3 issues found/i)).toBeInTheDocument()
      })
      
      // Check that errors are displayed
      expect(screen.getByText(/semi/)).toBeInTheDocument()
      expect(screen.getByText(/no-var/)).toBeInTheDocument()
      expect(screen.getByText(/prefer-const/)).toBeInTheDocument()
    })

    it('should show fixable vs non-fixable issues', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nconsole.log(x)`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),      // fixable
        mockESLint.createError('no-var', 1, 1),   // fixable
        mockESLint.createError('no-console', 2, 1), // fixable
        mockESLint.createError('no-unused-vars', 1, 5) // not fixable in this context
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/4 issues found/i)).toBeInTheDocument()
      })
      
      // Should show batch fix controls
      expect(screen.getByText(/3 of 4 issues can be fixed automatically/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /fix all/i })).toBeInTheDocument()
    })
  })

  describe('individual fix application', () => {
    it('should apply individual fixes and update code', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('no-var', 1, 1)
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/2 issues found/i)).toBeInTheDocument()
      })
      
      // Find and click fix button for semi rule
      const fixButtons = screen.getAllByRole('button', { name: /fix/i })
      expect(fixButtons.length).toBeGreaterThan(0)
      
      await user.click(fixButtons[0])
      
      // Should show applying state
      await waitFor(() => {
        expect(screen.getByText(/applying fix/i)).toBeInTheDocument()
      })
      
      // Mock successful fix result
      mockESLintInstance.lintText.mockResolvedValue([{
        messages: [mockESLint.createError('no-var', 1, 1)], // only no-var remains
        errorCount: 1,
        warningCount: 0
      }])
      
      // Should update to show remaining issues
      await waitFor(() => {
        expect(screen.getByText(/1 issue found/i)).toBeInTheDocument()
      })
    })

    it('should handle fix failures gracefully', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [mockESLint.createError('semi', 1, 9)]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/1 issue found/i)).toBeInTheDocument()
      })
      
      // Mock fix failure by making the fixer throw an error
      const originalApplyFix = FileUpload.prototype.applyFix
      FileUpload.prototype.applyFix = vi.fn().mockRejectedValue(new Error('Fix failed'))
      
      const fixButton = screen.getByRole('button', { name: /fix/i })
      await user.click(fixButton)
      
      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/fix failed/i)).toBeInTheDocument()
      })
      
      // Restore original method
      FileUpload.prototype.applyFix = originalApplyFix
    })
  })

  describe('batch fix integration', () => {
    it('should apply multiple fixes in sequence', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nlet y = 2\nconsole.log(x, y)`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('semi', 2, 9),
        mockESLint.createError('no-var', 1, 1),
        mockESLint.createError('prefer-const', 2, 1),
        mockESLint.createError('no-console', 3, 1)
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/5 issues found/i)).toBeInTheDocument()
      })
      
      // Click Fix All button
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      // Should show batch processing state
      await waitFor(() => {
        expect(screen.getByText(/fixing issues/i)).toBeInTheDocument()
      })
      
      // Mock progressive fix results
      mockESLintInstance.lintText
        .mockResolvedValueOnce([{ messages: mockErrors.slice(1), errorCount: 4, warningCount: 0 }])
        .mockResolvedValueOnce([{ messages: mockErrors.slice(2), errorCount: 3, warningCount: 0 }])
        .mockResolvedValueOnce([{ messages: mockErrors.slice(3), errorCount: 2, warningCount: 0 }])
        .mockResolvedValueOnce([{ messages: mockErrors.slice(4), errorCount: 1, warningCount: 0 }])
        .mockResolvedValueOnce([{ messages: [], errorCount: 0, warningCount: 0 }])
      
      // Should eventually show completion
      await waitFor(() => {
        expect(screen.getByText(/all issues fixed/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should show progress during batch processing', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nvar y = 2`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('semi', 2, 9),
        mockESLint.createError('no-var', 1, 1),
        mockESLint.createError('no-var', 2, 1)
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/4 issues found/i)).toBeInTheDocument()
      })
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      // Should show progress bar
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
      
      // Should show progress updates
      await waitFor(() => {
        expect(screen.getByText(/\d+ \/ \d+/)).toBeInTheDocument()
      })
    })

    it('should handle partial batch fix failures', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nlet y = 2`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('no-var', 1, 1),
        mockESLint.createError('unknown-rule', 2, 1) // This will fail
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/3 issues found/i)).toBeInTheDocument()
      })
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      // Should eventually show partial completion
      await waitFor(() => {
        expect(screen.getByText(/2 of 3 issues fixed/i)).toBeInTheDocument()
      })
      
      // Should show remaining unfixed issues
      expect(screen.getByText(/1 issue remaining/i)).toBeInTheDocument()
    })
  })

  describe('code editor integration', () => {
    it('should update editor content after fixes', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      const fixedCode = `var x = 1;`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [mockESLint.createError('semi', 1, 9)]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      const mockEditor = mockMonacoEditor.createInstance()
      mockEditor.getValue.mockReturnValue(testCode)

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/1 issue found/i)).toBeInTheDocument()
      })
      
      const fixButton = screen.getByRole('button', { name: /fix/i })
      await user.click(fixButton)
      
      // Should update editor with fixed code
      await waitFor(() => {
        expect(mockEditor.setValue).toHaveBeenCalledWith(expect.stringContaining(';'))
      })
    })

    it('should highlight changed lines after fixes', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1\nvar y = 2`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [
        mockESLint.createError('semi', 1, 9),
        mockESLint.createError('no-var', 1, 1)
      ]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/2 issues found/i)).toBeInTheDocument()
      })
      
      const fixButton = screen.getByRole('button', { name: /fix/i })
      await user.click(fixButton)
      
      // Should show change indicators
      await waitFor(() => {
        expect(screen.getByText(/line 1 modified/i)).toBeInTheDocument()
      })
    })
  })

  describe('error handling integration', () => {
    it('should handle ESLint errors gracefully', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      
      mockFileOperations.mockFileReader(testCode)
      mockESLintInstance.lintText.mockRejectedValue(new Error('ESLint failed'))

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/error analyzing code/i)).toBeInTheDocument()
      })
    })

    it('should handle file upload errors', async () => {
      const user = userEvent.setup()
      
      // Mock FileReader error
      const mockReader = mockFileOperations.mockFileReader('')
      mockReader.readAsText.mockImplementation(() => {
        setTimeout(() => {
          if (mockReader.onerror) {
            mockReader.onerror(new Error('File read error'))
          }
        }, 0)
      })

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile('test', 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/error reading file/i)).toBeInTheDocument()
      })
    })

    it('should validate file types', async () => {
      const user = userEvent.setup()

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile('test', 'test.txt', 'text/plain')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument()
      })
    })
  })

  describe('accessibility integration', () => {
    it('should announce fix results to screen readers', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [mockESLint.createError('semi', 1, 9)]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/1 issue found/i)
      })
      
      const fixButton = screen.getByRole('button', { name: /fix/i })
      await user.click(fixButton)
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/fix applied/i)
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      const testCode = `var x = 1`
      
      mockFileOperations.mockFileReader(testCode)
      
      const mockErrors = [mockESLint.createError('semi', 1, 9)]
      mockESLintInstance.lintText.mockResolvedValue(
        mockESLint.createResultsWithErrors(mockErrors)
      )

      render(<FileUpload />)
      
      const fileInput = screen.getByLabelText(/choose file/i)
      const file = mockFileOperations.createMockFile(testCode, 'test.js')
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/1 issue found/i)).toBeInTheDocument()
      })
      
      // Should be able to navigate to fix button with keyboard
      const fixButton = screen.getByRole('button', { name: /fix/i })
      fixButton.focus()
      expect(fixButton).toHaveFocus()
      
      // Should be able to activate with Enter key
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText(/applying fix/i)).toBeInTheDocument()
      })
    })
  })
})