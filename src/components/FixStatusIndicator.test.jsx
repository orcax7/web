import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FixStatusIndicator from './FixStatusIndicator.jsx'

describe('FixStatusIndicator', () => {
  describe('rendering states', () => {
    it('should render fixable state', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('fixable')
      expect(screen.getByTitle(/can be fixed automatically/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/fixable/i)).toBeInTheDocument()
    })

    it('should render non-fixable state', () => {
      render(
        <FixStatusIndicator 
          isFixable={false}
          isApplying={false}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('not-fixable')
      expect(screen.getByTitle(/cannot be fixed automatically/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/not fixable/i)).toBeInTheDocument()
    })

    it('should render applying state', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={true}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('applying')
      expect(screen.getByTitle(/applying fix/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/applying fix/i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })

    it('should render success state', () => {
      const fixResult = {
        success: true,
        message: 'Fix applied successfully',
        warnings: []
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('success')
      expect(screen.getByTitle(/fix applied successfully/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/fix successful/i)).toBeInTheDocument()
    })

    it('should render failure state', () => {
      const fixResult = {
        success: false,
        message: 'Fix failed to apply',
        warnings: []
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('failure')
      expect(screen.getByTitle(/fix failed to apply/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/fix failed/i)).toBeInTheDocument()
    })

    it('should render warning state', () => {
      const fixResult = {
        success: true,
        message: 'Fix applied with warnings',
        warnings: ['Warning: Potential issue detected']
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('warning')
      expect(screen.getByTitle(/fix applied with warnings/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/fix applied with warnings/i)).toBeInTheDocument()
    })
  })

  describe('visual indicators', () => {
    it('should show correct icon for fixable state', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-icon')).toHaveClass('fixable-icon')
    })

    it('should show correct icon for non-fixable state', () => {
      render(
        <FixStatusIndicator 
          isFixable={false}
          isApplying={false}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-icon')).toHaveClass('not-fixable-icon')
    })

    it('should show spinner when applying', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={true}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByTestId('spinner')).toHaveClass('spinning')
    })

    it('should show success icon after successful fix', () => {
      const fixResult = { success: true, message: 'Fixed', warnings: [] }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('success-icon')).toBeInTheDocument()
    })

    it('should show error icon after failed fix', () => {
      const fixResult = { success: false, message: 'Failed', warnings: [] }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
    })

    it('should show warning icon for fixes with warnings', () => {
      const fixResult = { 
        success: true, 
        message: 'Fixed', 
        warnings: ['Warning message'] 
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
    })
  })

  describe('tooltips and messages', () => {
    it('should show detailed tooltip for fixable issues', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
          ruleId="semi"
          errorMessage="Missing semicolon"
        />
      )
      
      const indicator = screen.getByTestId('fix-status-indicator')
      expect(indicator).toHaveAttribute('title', expect.stringContaining('semi'))
      expect(indicator).toHaveAttribute('title', expect.stringContaining('Missing semicolon'))
    })

    it('should show custom message in tooltip', () => {
      const fixResult = { 
        success: true, 
        message: 'Custom fix message', 
        warnings: [] 
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTitle(/custom fix message/i)).toBeInTheDocument()
    })

    it('should show warnings in tooltip', () => {
      const fixResult = { 
        success: true, 
        message: 'Fixed', 
        warnings: ['Warning 1', 'Warning 2'] 
      }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      const indicator = screen.getByTestId('fix-status-indicator')
      expect(indicator).toHaveAttribute('title', expect.stringContaining('Warning 1'))
      expect(indicator).toHaveAttribute('title', expect.stringContaining('Warning 2'))
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      const indicator = screen.getByTestId('fix-status-indicator')
      expect(indicator).toHaveAttribute('role', 'status')
      expect(indicator).toHaveAttribute('aria-label', expect.stringContaining('fixable'))
    })

    it('should announce state changes to screen readers', () => {
      const { rerender } = render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      // Start applying
      rerender(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={true}
          fixResult={null}
        />
      )
      
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
      
      // Complete with success
      const fixResult = { success: true, message: 'Fixed', warnings: [] }
      rerender(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })

    it('should have proper keyboard navigation support', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      const indicator = screen.getByTestId('fix-status-indicator')
      expect(indicator).toHaveAttribute('tabindex', '0')
    })
  })

  describe('edge cases', () => {
    it('should handle missing fixResult gracefully', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toBeInTheDocument()
    })

    it('should handle empty fixResult', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={{}}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toBeInTheDocument()
    })

    it('should handle fixResult without message', () => {
      const fixResult = { success: true, warnings: [] }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('success')
    })

    it('should handle fixResult without warnings array', () => {
      const fixResult = { success: true, message: 'Fixed' }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={fixResult}
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('success')
    })

    it('should handle conflicting states', () => {
      // isApplying true but fixResult present (shouldn't happen but handle gracefully)
      const fixResult = { success: true, message: 'Fixed', warnings: [] }

      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={true}
          fixResult={fixResult}
        />
      )
      
      // Should prioritize applying state
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('applying')
    })
  })

  describe('styling', () => {
    it('should apply correct CSS classes for each state', () => {
      const states = [
        { props: { isFixable: true, isApplying: false, fixResult: null }, expectedClass: 'fixable' },
        { props: { isFixable: false, isApplying: false, fixResult: null }, expectedClass: 'not-fixable' },
        { props: { isFixable: true, isApplying: true, fixResult: null }, expectedClass: 'applying' },
        { props: { isFixable: true, isApplying: false, fixResult: { success: true, warnings: [] } }, expectedClass: 'success' },
        { props: { isFixable: true, isApplying: false, fixResult: { success: false, warnings: [] } }, expectedClass: 'failure' },
        { props: { isFixable: true, isApplying: false, fixResult: { success: true, warnings: ['warning'] } }, expectedClass: 'warning' }
      ]

      states.forEach(({ props, expectedClass }) => {
        const { unmount } = render(<FixStatusIndicator {...props} />)
        expect(screen.getByTestId('fix-status-indicator')).toHaveClass(expectedClass)
        unmount()
      })
    })

    it('should support custom className prop', () => {
      render(
        <FixStatusIndicator 
          isFixable={true}
          isApplying={false}
          fixResult={null}
          className="custom-class"
        />
      )
      
      expect(screen.getByTestId('fix-status-indicator')).toHaveClass('custom-class')
    })
  })
})