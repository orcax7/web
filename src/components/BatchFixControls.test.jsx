import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BatchFixControls from './BatchFixControls.jsx'
import { mockBatchProcessing } from '../test/utils/mockHelpers.js'

describe('BatchFixControls', () => {
  let mockOnBatchFix
  let defaultProps

  beforeEach(() => {
    mockOnBatchFix = vi.fn()
    defaultProps = {
      fixableCount: 5,
      totalCount: 8,
      onBatchFix: mockOnBatchFix,
      isProcessing: false
    }
  })

  describe('rendering', () => {
    it('should render fix count information', () => {
      render(<BatchFixControls {...defaultProps} />)
      
      expect(screen.getByText(/5 of 8 issues can be fixed automatically/)).toBeInTheDocument()
    })

    it('should render Fix All button when fixes are available', () => {
      render(<BatchFixControls {...defaultProps} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toBeInTheDocument()
      expect(fixAllButton).not.toBeDisabled()
    })

    it('should disable Fix All button when no fixes available', () => {
      const props = { ...defaultProps, fixableCount: 0 }
      render(<BatchFixControls {...props} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toBeDisabled()
    })

    it('should show processing state', () => {
      const props = { ...defaultProps, isProcessing: true }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/fixing issues/i)).toBeInTheDocument()
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toBeDisabled()
    })

    it('should show progress bar when processing', () => {
      const props = { 
        ...defaultProps, 
        isProcessing: true,
        progress: { current: 3, total: 5, phase: 'fixing' }
      }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByText('3 / 5')).toBeInTheDocument()
      expect(screen.getByText('fixing')).toBeInTheDocument()
    })
  })

  describe('user interactions', () => {
    it('should call onBatchFix when Fix All button is clicked', async () => {
      const user = userEvent.setup()
      render(<BatchFixControls {...defaultProps} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      expect(mockOnBatchFix).toHaveBeenCalledTimes(1)
    })

    it('should not call onBatchFix when button is disabled', async () => {
      const user = userEvent.setup()
      const props = { ...defaultProps, fixableCount: 0 }
      render(<BatchFixControls {...props} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      expect(mockOnBatchFix).not.toHaveBeenCalled()
    })

    it('should not call onBatchFix when processing', async () => {
      const user = userEvent.setup()
      const props = { ...defaultProps, isProcessing: true }
      render(<BatchFixControls {...props} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      await user.click(fixAllButton)
      
      expect(mockOnBatchFix).not.toHaveBeenCalled()
    })
  })

  describe('progress tracking', () => {
    it('should update progress bar during processing', () => {
      const { rerender } = render(<BatchFixControls {...defaultProps} />)
      
      // Start processing
      rerender(
        <BatchFixControls 
          {...defaultProps} 
          isProcessing={true}
          progress={{ current: 0, total: 5, phase: 'analyzing' }}
        />
      )
      
      expect(screen.getByText('0 / 5')).toBeInTheDocument()
      expect(screen.getByText('analyzing')).toBeInTheDocument()
      
      // Update progress
      rerender(
        <BatchFixControls 
          {...defaultProps} 
          isProcessing={true}
          progress={{ current: 3, total: 5, phase: 'fixing' }}
        />
      )
      
      expect(screen.getByText('3 / 5')).toBeInTheDocument()
      expect(screen.getByText('fixing')).toBeInTheDocument()
      
      // Complete processing
      rerender(
        <BatchFixControls 
          {...defaultProps} 
          isProcessing={false}
          progress={{ current: 5, total: 5, phase: 'complete' }}
        />
      )
      
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('should show different phase messages', () => {
      const phases = [
        { phase: 'analyzing', message: 'Analyzing code...' },
        { phase: 'fixing', message: 'Applying fixes...' },
        { phase: 'validating', message: 'Validating changes...' },
        { phase: 'complete', message: 'Complete!' }
      ]

      phases.forEach(({ phase, message }) => {
        const { rerender } = render(
          <BatchFixControls 
            {...defaultProps} 
            isProcessing={true}
            progress={{ current: 1, total: 5, phase }}
          />
        )
        
        expect(screen.getByText(new RegExp(message, 'i'))).toBeInTheDocument()
      })
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BatchFixControls {...defaultProps} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toHaveAttribute('aria-label', expect.stringContaining('Fix all 5 issues'))
    })

    it('should have proper ARIA attributes for progress bar', () => {
      const props = { 
        ...defaultProps, 
        isProcessing: true,
        progress: { current: 3, total: 5, phase: 'fixing' }
      }
      render(<BatchFixControls {...props} />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '3')
      expect(progressBar).toHaveAttribute('aria-valuemax', '5')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    })

    it('should announce progress changes to screen readers', () => {
      const { rerender } = render(<BatchFixControls {...defaultProps} />)
      
      rerender(
        <BatchFixControls 
          {...defaultProps} 
          isProcessing={true}
          progress={{ current: 3, total: 5, phase: 'fixing' }}
        />
      )
      
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/fixing 3 of 5/i)
    })
  })

  describe('edge cases', () => {
    it('should handle zero fixable issues', () => {
      const props = { ...defaultProps, fixableCount: 0, totalCount: 3 }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/0 of 3 issues can be fixed automatically/)).toBeInTheDocument()
      expect(screen.getByText(/no automatic fixes available/i)).toBeInTheDocument()
    })

    it('should handle all issues being fixable', () => {
      const props = { ...defaultProps, fixableCount: 5, totalCount: 5 }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/all 5 issues can be fixed automatically/)).toBeInTheDocument()
    })

    it('should handle single issue', () => {
      const props = { ...defaultProps, fixableCount: 1, totalCount: 1 }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/1 issue can be fixed automatically/)).toBeInTheDocument()
    })

    it('should handle no issues', () => {
      const props = { ...defaultProps, fixableCount: 0, totalCount: 0 }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/no issues found/i)).toBeInTheDocument()
    })

    it('should handle missing progress data', () => {
      const props = { ...defaultProps, isProcessing: true }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })

    it('should handle invalid progress data', () => {
      const props = { 
        ...defaultProps, 
        isProcessing: true,
        progress: { current: -1, total: 0, phase: 'unknown' }
      }
      render(<BatchFixControls {...props} />)
      
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })
  })

  describe('styling and layout', () => {
    it('should apply correct CSS classes', () => {
      render(<BatchFixControls {...defaultProps} />)
      
      const container = screen.getByTestId('batch-fix-controls')
      expect(container).toHaveClass('batch-fix-controls')
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toHaveClass('fix-all-button')
    })

    it('should apply processing styles when active', () => {
      const props = { ...defaultProps, isProcessing: true }
      render(<BatchFixControls {...props} />)
      
      const container = screen.getByTestId('batch-fix-controls')
      expect(container).toHaveClass('processing')
    })

    it('should apply disabled styles when no fixes available', () => {
      const props = { ...defaultProps, fixableCount: 0 }
      render(<BatchFixControls {...props} />)
      
      const fixAllButton = screen.getByRole('button', { name: /fix all/i })
      expect(fixAllButton).toHaveClass('disabled')
    })
  })
})