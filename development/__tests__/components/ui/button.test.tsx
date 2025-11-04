/**
 * REAL COMPONENT TESTS - Testing Actual UI Components
 * Tests for src/components/ui/button.tsx
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, buttonVariants } from '@/components/ui/button'

describe('Button Component - Real Source Code Tests', () => {
  describe('Basic Rendering', () => {
    test('should render button with text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    test('should render as button element by default', () => {
      const { container } = render(<Button>Button</Button>)
      const button = container.querySelector('button')
      expect(button).toBeInTheDocument()
    })

    test('should render with default variant', () => {
      const { container } = render(<Button>Default</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('bg-gradient-to-br')
      expect(button).toHaveClass('from-blue-600')
    })
  })

  describe('Variant Styles', () => {
    test('should render secondary variant', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('bg-white')
      expect(button).toHaveClass('text-gray-700')
      expect(button).toHaveClass('border-gray-300')
    })

    test('should render ghost variant', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('bg-transparent')
      expect(button).toHaveClass('text-gray-600')
    })

    test('should render outline variant', () => {
      const { container } = render(<Button variant="outline">Outline</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('border-gray-300')
      expect(button).toHaveClass('bg-background')
    })

    test('should render destructive variant', () => {
      const { container } = render(<Button variant="destructive">Delete</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('bg-red-600')
      expect(button).toHaveClass('text-white')
    })

    test('should render link variant', () => {
      const { container } = render(<Button variant="link">Link</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('text-blue-600')
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  describe('Size Variants', () => {
    test('should render default size', () => {
      const { container } = render(<Button size="default">Default Size</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('px-4')
      expect(button).toHaveClass('py-3')
      expect(button).toHaveClass('text-sm')
    })

    test('should render small size', () => {
      const { container } = render(<Button size="sm">Small</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('px-3')
      expect(button).toHaveClass('py-2')
      expect(button).toHaveClass('text-xs')
    })

    test('should render large size', () => {
      const { container } = render(<Button size="lg">Large</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('px-6')
      expect(button).toHaveClass('py-4')
      expect(button).toHaveClass('text-base')
    })

    test('should render icon size', () => {
      const { container } = render(<Button size="icon">🔍</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('w-10')
    })
  })

  describe('Event Handlers', () => {
    test('should call onClick when clicked', () => {
      const handleClick = jest.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      fireEvent.click(screen.getByText('Click me'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should not call onClick when disabled', () => {
      const handleClick = jest.fn()
      render(<Button onClick={handleClick} disabled>Disabled</Button>)
      fireEvent.click(screen.getByText('Disabled'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    test('should handle onMouseEnter event', () => {
      const handleMouseEnter = jest.fn()
      render(<Button onMouseEnter={handleMouseEnter}>Hover me</Button>)
      fireEvent.mouseEnter(screen.getByText('Hover me'))
      expect(handleMouseEnter).toHaveBeenCalledTimes(1)
    })
  })

  describe('Disabled State', () => {
    test('should render disabled button', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByText('Disabled')
      expect(button).toBeDisabled()
    })

    test('should have disabled styling', () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toHaveClass('disabled:cursor-not-allowed')
    })
  })

  describe('HTML Attributes', () => {
    test('should accept type attribute', () => {
      render(<Button type="submit">Submit</Button>)
      const button = screen.getByText('Submit')
      expect(button).toHaveAttribute('type', 'submit')
    })

    test('should accept custom className', () => {
      const { container } = render(<Button className="custom-class">Custom</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('custom-class')
    })

    test('should accept data attributes', () => {
      render(<Button data-testid="test-button">Test</Button>)
      expect(screen.getByTestId('test-button')).toBeInTheDocument()
    })

    test('should accept id attribute', () => {
      render(<Button id="my-button">ID Test</Button>)
      const button = screen.getByText('ID Test')
      expect(button).toHaveAttribute('id', 'my-button')
    })
  })

  describe('Ref Forwarding', () => {
    test('should forward ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Ref Test</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    test('should allow calling focus on ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Focus Test</Button>)
      ref.current?.focus()
      expect(ref.current).toHaveFocus()
    })
  })

  describe('Button Variants CVA', () => {
    test('buttonVariants should return correct class for default', () => {
      const classes = buttonVariants()
      expect(classes).toContain('bg-gradient-to-br')
      expect(classes).toContain('from-blue-600')
    })

    test('buttonVariants should include base classes', () => {
      const classes = buttonVariants()
      expect(classes).toContain('inline-flex')
      expect(classes).toContain('items-center')
      expect(classes).toContain('justify-center')
      expect(classes).toContain('cursor-pointer')
    })

    test('buttonVariants should combine variant and size', () => {
      const classes = buttonVariants({ variant: 'destructive', size: 'lg' })
      expect(classes).toContain('bg-red-600')
      expect(classes).toContain('px-6')
      expect(classes).toContain('py-4')
    })
  })

  describe('Accessibility', () => {
    test('should support aria-label', () => {
      render(<Button aria-label="Close button">X</Button>)
      expect(screen.getByLabelText('Close button')).toBeInTheDocument()
    })

    test('should support aria-pressed', () => {
      render(<Button aria-pressed="true">Toggle</Button>)
      const button = screen.getByText('Toggle')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    test('should have focus styles', () => {
      const { container } = render(<Button>Focus</Button>)
      const button = container.firstChild as HTMLElement
      expect(button).toHaveClass('focus-visible:outline-none')
      expect(button).toHaveClass('focus-visible:ring-2')
    })
  })

  describe('Complex Content', () => {
    test('should render with icon and text', () => {
      render(
        <Button>
          <span>🔍</span>
          <span>Search</span>
        </Button>
      )
      expect(screen.getByText('🔍')).toBeInTheDocument()
      expect(screen.getByText('Search')).toBeInTheDocument()
    })

    test('should render with nested elements', () => {
      render(
        <Button>
          <strong>Bold</strong> text
        </Button>
      )
      expect(screen.getByText('Bold')).toBeInTheDocument()
    })
  })

  describe('Form Integration', () => {
    test('should submit form when type is submit', () => {
      const handleSubmit = jest.fn((e) => e.preventDefault())
      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>
      )
      fireEvent.click(screen.getByText('Submit'))
      expect(handleSubmit).toHaveBeenCalled()
    })

    // Note: Form reset behavior is browser-specific and hard to test in jsdom
    test('should have reset type when specified', () => {
      render(
        <form>
          <Button type="reset">Reset</Button>
        </form>
      )
      const button = screen.getByText('Reset')
      expect(button).toHaveAttribute('type', 'reset')
    })
  })

  describe('Edge Cases', () => {
    test('should handle very long text', () => {
      const longText = 'This is a very long button text that might wrap'
      render(<Button>{longText}</Button>)
      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    test('should handle number as children', () => {
      render(<Button>{123}</Button>)
      expect(screen.getByText('123')).toBeInTheDocument()
    })

    test('should handle undefined children gracefully', () => {
      const { container } = render(<Button>{undefined}</Button>)
      expect(container.querySelector('button')).toBeInTheDocument()
    })
  })

  describe('Combination Tests', () => {
    test('should combine all props correctly', () => {
      const handleClick = jest.fn()
      const { container } = render(
        <Button
          variant="destructive"
          size="lg"
          disabled
          onClick={handleClick}
          className="custom-class"
          data-testid="combo-button"
        >
          Delete All
        </Button>
      )
      const button = container.firstChild as HTMLElement
      
      expect(button).toHaveClass('bg-red-600')
      expect(button).toHaveClass('px-6')
      expect(button).toHaveClass('custom-class')
      expect(button).toBeDisabled()
      expect(screen.getByTestId('combo-button')).toBeInTheDocument()
      
      fireEvent.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })
})
