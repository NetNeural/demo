/**
 * COMPREHENSIVE UI COMPONENTS TESTS
 * Testing all remaining UI components for 100% coverage
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Import all UI components
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table'
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select'
import * as Icons from '@/components/ui/icons'

describe('Textarea Component', () => {
  test('renders textarea element', () => {
    const { container } = render(<Textarea />)
    expect(container.querySelector('textarea')).toBeInTheDocument()
  })

  test('accepts placeholder', () => {
    render(<Textarea placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  test('handles onChange', () => {
    const handleChange = jest.fn()
    const { container } = render(<Textarea onChange={handleChange} />)
    const textarea = container.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'test' } })
    expect(handleChange).toHaveBeenCalled()
  })

  test('accepts custom className', () => {
    const { container } = render(<Textarea className="custom" />)
    expect(container.querySelector('textarea')).toHaveClass('custom')
  })

  test('forwards ref', () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  test('accepts disabled prop', () => {
    const { container } = render(<Textarea disabled />)
    expect(container.querySelector('textarea')).toBeDisabled()
  })

  test('accepts rows attribute', () => {
    const { container } = render(<Textarea rows={5} />)
    expect(container.querySelector('textarea')).toHaveAttribute('rows', '5')
  })

  test('accepts value prop', () => {
    const { container } = render(<Textarea value="test" readOnly />)
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('test')
  })
})

describe('Switch Component', () => {
  test('renders switch element', () => {
    const { container } = render(<Switch />)
    expect(container.querySelector('button')).toBeInTheDocument()
  })

  test('handles onCheckedChange', () => {
    const handleChange = jest.fn()
    const { container } = render(<Switch onCheckedChange={handleChange} />)
    const button = container.querySelector('button')!
    fireEvent.click(button)
    expect(handleChange).toHaveBeenCalled()
  })

  test('accepts checked prop', () => {
    const { container } = render(<Switch checked={true} />)
    const button = container.querySelector('button')
    expect(button).toHaveAttribute('data-state', 'checked')
  })

  test('accepts disabled prop', () => {
    const { container } = render(<Switch disabled />)
    expect(container.querySelector('button')).toBeDisabled()
  })

  test('accepts custom className', () => {
    const { container } = render(<Switch className="custom" />)
    expect(container.querySelector('button')).toHaveClass('custom')
  })
})

describe('Progress Component', () => {
  test('renders progress element', () => {
    const { container } = render(<Progress value={50} />)
    // Progress is a div with styled inner div for the bar
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  test('accepts value prop', () => {
    const { container } = render(<Progress value={75} />)
    const progressBar = container.querySelector('div > div')
    // Progress bar exists
    expect(progressBar).toBeInTheDocument()
  })

  test('accepts custom className', () => {
    const { container } = render(<Progress value={50} className="custom" />)
    expect(container.firstChild).toHaveClass('custom')
  })

  test('handles 0 value', () => {
    const { container } = render(<Progress value={0} />)
    const progressBar = container.querySelector('div > div')
    expect(progressBar).toBeInTheDocument()
  })

  test('handles 100 value', () => {
    const { container } = render(<Progress value={100} />)
    const progressBar = container.querySelector('div > div')
    expect(progressBar).toBeInTheDocument()
  })
})

describe('Tabs Component', () => {
  test('renders tabs structure', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
  })

  test('shows content for active tab', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  test('handles tab switching', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    fireEvent.click(screen.getByText('Tab 2'))
    expect(screen.getByText('Content 2')).toBeVisible()
  })

  test('accepts custom className on TabsList', () => {
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList className="custom">
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(container.querySelector('.custom')).toBeInTheDocument()
  })
})

describe('Table Component', () => {
  test('renders table element', () => {
    const { container } = render(
      <Table>
        <tbody></tbody>
      </Table>
    )
    expect(container.querySelector('table')).toBeInTheDocument()
  })

  test('renders complete table structure', () => {
    render(
      <Table>
        <TableCaption>Test Caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Header 1</TableHead>
            <TableHead>Header 2</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Cell 1</TableCell>
            <TableCell>Cell 2</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Footer 1</TableCell>
            <TableCell>Footer 2</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
    expect(screen.getByText('Test Caption')).toBeInTheDocument()
    expect(screen.getByText('Header 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
    expect(screen.getByText('Footer 1')).toBeInTheDocument()
  })

  test('accepts custom className on Table', () => {
    const { container } = render(
      <Table className="custom">
        <tbody></tbody>
      </Table>
    )
    expect(container.querySelector('table')).toHaveClass('custom')
  })

  test('forwards ref on Table', () => {
    const ref = React.createRef<HTMLTableElement>()
    render(
      <Table ref={ref}>
        <tbody></tbody>
      </Table>
    )
    expect(ref.current).toBeInstanceOf(HTMLTableElement)
  })
})

describe('Select Component', () => {
  test('renders select trigger', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
      </Select>
    )
    expect(screen.getByText('Select')).toBeInTheDocument()
  })

  test('opens select content on click', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )
    fireEvent.click(screen.getByText('Select'))
    expect(screen.getByText('Option 1')).toBeInTheDocument()
  })

  test('renders select with groups', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Group 2</SelectLabel>
            <SelectItem value="2">Option 2</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )
    fireEvent.click(screen.getByText('Select'))
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
  })

  test('accepts custom className on SelectTrigger', () => {
    const { container } = render(
      <Select>
        <SelectTrigger className="custom">
          <SelectValue />
        </SelectTrigger>
      </Select>
    )
    expect(container.querySelector('.custom')).toBeInTheDocument()
  })
})

describe('Icons Component', () => {
  test('Icons are exported from lucide-react', () => {
    // Icons module re-exports from lucide-react
    expect(Icons.Loader2).toBeDefined()
    expect(Icons.Bell).toBeDefined()
    expect(Icons.Home).toBeDefined()
  })

  test('Icons can be rendered', () => {
    const { container } = render(<Icons.Loader2 />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  test('Icons accept className', () => {
    const { container } = render(<Icons.Bell className="custom-icon" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('custom-icon')
  })

  test('Icons accept size props', () => {
    const { container } = render(<Icons.Home size={24} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

// Additional edge cases and integration tests
describe('UI Components Integration', () => {
  test('form with multiple components', () => {
    const handleSubmit = jest.fn((e) => e.preventDefault())
    render(
      <form onSubmit={handleSubmit}>
        <Textarea placeholder="Message" />
        <Switch />
        <Progress value={50} />
        <button type="submit">Submit</button>
      </form>
    )
    fireEvent.click(screen.getByText('Submit'))
    expect(handleSubmit).toHaveBeenCalled()
  })

  test('tabs with table content', () => {
    render(
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Data</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})
