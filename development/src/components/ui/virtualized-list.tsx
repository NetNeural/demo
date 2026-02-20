/**
 * VirtualizedList Component
 *
 * High-performance list component using react-window v2 for rendering
 * only visible items. Use this for lists with 50+ items.
 *
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={devices}
 *   height={600}
 *   itemHeight={80}
 *   renderItem={(device, index) => (
 *     <DeviceCard key={device.id} device={device} />
 *   )}
 * />
 * ```
 */

import { List } from 'react-window'
import { type CSSProperties, type ReactElement } from 'react'

interface VirtualizedListProps<T> {
  items: T[]
  height?: number | string
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscanCount?: number
  onItemsRendered?: (startIndex: number, endIndex: number) => void
}

/**
 * High-performance virtualized list using react-window v2.
 * Only renders visible rows plus overscan, dramatically reducing DOM nodes
 * for large datasets (200+ devices, 1000+ alerts, etc.).
 */
export function VirtualizedList<T>({
  items,
  height = 600,
  itemHeight,
  renderItem,
  className = '',
  overscanCount = 5,
  onItemsRendered,
}: VirtualizedListProps<T>) {
  // For small lists, skip virtualization overhead
  if (items.length < 30) {
    return (
      <div
        className={className}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          overflow: 'auto',
        }}
      >
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  type NoExtraProps = Record<string, never>

  const Row = ({
    index,
    style,
  }: {
    index: number
    style: CSSProperties
    ariaAttributes: Record<string, unknown>
  }): ReactElement | null => {
    const item = items[index]
    if (!item) return null
    return <div style={style}>{renderItem(item, index)}</div>
  }

  const numericHeight = typeof height === 'number' ? height : 600

  return (
    <div className={className}>
      <List<NoExtraProps>
        rowComponent={Row}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowProps={{}}
        defaultHeight={numericHeight}
        overscanCount={overscanCount}
        onRowsRendered={
          onItemsRendered
            ? (visible) => {
                onItemsRendered(visible.startIndex, visible.stopIndex)
              }
            : undefined
        }
      />
    </div>
  )
}

export default VirtualizedList
