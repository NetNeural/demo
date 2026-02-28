/**
 * REAL COMPONENT TESTS - Label, Card, Alert Components
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

describe('Label Component - Real Source Code Tests', () => {
  test('should render label element', () => {
    render(<Label>Test Label</Label>)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  test('should accept htmlFor attribute', () => {
    const { container } = render(<Label htmlFor="input-id">Label</Label>)
    const label = container.querySelector('label')
    expect(label).toHaveAttribute('for', 'input-id')
  })

  test('should accept custom className', () => {
    const { container } = render(<Label className="custom">Label</Label>)
    const label = container.querySelector('label')
    expect(label).toHaveClass('custom')
    expect(label).toHaveClass('text-sm')
  })

  test('should forward ref', () => {
    const ref = React.createRef<HTMLLabelElement>()
    render(<Label ref={ref}>Label</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })

  test('should have peer-disabled styles', () => {
    const { container } = render(<Label>Label</Label>)
    const label = container.querySelector('label')
    expect(label).toHaveClass('peer-disabled:cursor-not-allowed')
    expect(label).toHaveClass('peer-disabled:opacity-70')
  })
})

describe('Card Component - Real Source Code Tests', () => {
  test('should render card', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  test('should render CardHeader', () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  test('should render CardTitle', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  test('should render CardDescription', () => {
    render(<CardDescription>Description</CardDescription>)
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  test('should render CardContent', () => {
    render(<CardContent>Content</CardContent>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  test('should render CardFooter', () => {
    render(<CardFooter>Footer</CardFooter>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  test('should render complete card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Card Content</CardContent>
        <CardFooter>Card Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card Description')).toBeInTheDocument()
    expect(screen.getByText('Card Content')).toBeInTheDocument()
    expect(screen.getByText('Card Footer')).toBeInTheDocument()
  })

  test('should accept custom className on Card', () => {
    const { container } = render(<Card className="custom">Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('custom')
  })

  test('should forward ref on Card', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Card ref={ref}>Content</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('Alert Component - Real Source Code Tests', () => {
  test('should render alert', () => {
    render(<Alert>Alert content</Alert>)
    expect(screen.getByText('Alert content')).toBeInTheDocument()
  })

  test('should render AlertTitle', () => {
    render(<AlertTitle>Alert Title</AlertTitle>)
    expect(screen.getByText('Alert Title')).toBeInTheDocument()
  })

  test('should render AlertDescription', () => {
    render(<AlertDescription>Alert Description</AlertDescription>)
    expect(screen.getByText('Alert Description')).toBeInTheDocument()
  })

  test('should render complete alert structure', () => {
    render(
      <Alert>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>
    )
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  test('should accept default variant', () => {
    const { container } = render(<Alert>Alert</Alert>)
    const alert = container.firstChild as HTMLElement
    expect(alert).toBeInTheDocument()
  })

  test('should accept destructive variant', () => {
    const { container } = render(<Alert variant="destructive">Error</Alert>)
    const alert = container.firstChild as HTMLElement
    // The destructive variant includes border-destructive (possibly with opacity like border-destructive/50)
    expect(alert.className).toContain('border-destructive')
  })

  test('should accept custom className', () => {
    const { container } = render(<Alert className="custom">Alert</Alert>)
    const alert = container.firstChild as HTMLElement
    expect(alert).toHaveClass('custom')
  })

  test('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Alert ref={ref}>Alert</Alert>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
