/**
 * REAL COMPONENT TESTS - Testing Actual UI Components
 * Tests for src/components/ui/badge.tsx
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from '@/components/ui/badge'

describe('Badge Component - Real Source Code Tests', () => {
  describe('Basic Rendering', () => {
    test('should render badge with text', () => {
      render(<Badge>Test Badge</Badge>)
      expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    test('should render badge with default variant', () => {
      const { container } = render(<Badge>Default</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-primary')
      expect(badge).toHaveClass('text-primary-foreground')
    })

    test('should render empty badge', () => {
      const { container } = render(<Badge />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('Variant Styles', () => {
    test('should render secondary variant', () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-secondary')
      expect(badge).toHaveClass('text-secondary-foreground')
    })

    test('should render destructive variant', () => {
      const { container } = render(<Badge variant="destructive">Error</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-destructive')
      expect(badge).toHaveClass('text-destructive-foreground')
    })

    test('should render outline variant', () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('text-foreground')
      expect(badge).not.toHaveClass('border-transparent')
    })
  })

  describe('Custom Styling', () => {
    test('should accept custom className', () => {
      const { container } = render(
        <Badge className="custom-class">Custom</Badge>
      )
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('custom-class')
    })

    test('should merge custom className with variant classes', () => {
      const { container } = render(
        <Badge variant="secondary" className="text-lg">
          Merged
        </Badge>
      )
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-secondary')
      expect(badge).toHaveClass('text-lg')
    })
  })

  describe('HTML Attributes', () => {
    test('should accept id attribute', () => {
      const { container } = render(<Badge id="test-badge">ID Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveAttribute('id', 'test-badge')
    })

    test('should accept data attributes', () => {
      const { container } = render(
        <Badge data-testid="badge-test">Data Attr</Badge>
      )
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveAttribute('data-testid', 'badge-test')
    })

    test('should accept onClick handler', () => {
      const handleClick = jest.fn()
      render(<Badge onClick={handleClick}>Clickable</Badge>)
      const badge = screen.getByText('Clickable')
      badge.click()
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Badge Variants CVA', () => {
    test('badgeVariants should return correct class for default', () => {
      const classes = badgeVariants()
      expect(classes).toContain('bg-primary')
      expect(classes).toContain('text-primary-foreground')
    })

    test('badgeVariants should return correct class for secondary', () => {
      const classes = badgeVariants({ variant: 'secondary' })
      expect(classes).toContain('bg-secondary')
    })

    test('badgeVariants should return correct class for destructive', () => {
      const classes = badgeVariants({ variant: 'destructive' })
      expect(classes).toContain('bg-destructive')
    })

    test('badgeVariants should return correct class for outline', () => {
      const classes = badgeVariants({ variant: 'outline' })
      expect(classes).toContain('text-foreground')
    })

    test('badgeVariants should include base classes', () => {
      const classes = badgeVariants()
      expect(classes).toContain('inline-flex')
      expect(classes).toContain('items-center')
      expect(classes).toContain('rounded-full')
      expect(classes).toContain('border')
    })
  })

  describe('Accessibility', () => {
    test('should be a div element', () => {
      const { container } = render(<Badge>Accessible</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge.tagName).toBe('DIV')
    })

    test('should support role attribute', () => {
      const { container } = render(<Badge role="status">Status</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveAttribute('role', 'status')
    })

    test('should support aria-label', () => {
      const { container } = render(<Badge aria-label="Test badge">Badge</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveAttribute('aria-label', 'Test badge')
    })
  })

  describe('Complex Content', () => {
    test('should render with nested elements', () => {
      render(
        <Badge>
          <span>Icon</span>
          <span>Text</span>
        </Badge>
      )
      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })

    test('should render with React nodes', () => {
      render(
        <Badge>
          <strong>Bold</strong> and <em>italic</em>
        </Badge>
      )
      expect(screen.getByText('Bold')).toBeInTheDocument()
      expect(screen.getByText(/and/)).toBeInTheDocument()
      expect(screen.getByText('italic')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    test('should handle very long text', () => {
      const longText =
        'This is a very long badge text that might wrap or truncate'
      render(<Badge>{longText}</Badge>)
      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    test('should handle special characters', () => {
      render(<Badge>{'<>&"\''}</Badge>)
      expect(screen.getByText('<>&"\'')).toBeInTheDocument()
    })

    test('should handle numbers as children', () => {
      render(<Badge>{42}</Badge>)
      expect(screen.getByText('42')).toBeInTheDocument()
    })
  })
})
