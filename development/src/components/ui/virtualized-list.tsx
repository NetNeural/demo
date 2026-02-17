/**
 * VirtualizedList Component
 * 
 * TEMPORARILY DISABLED: react-window package has version issues
 * TODO: Fix react-window version (should be 1.8.x not 2.2.7) and re-enable
 * 
 * High-performance list component using react-window for rendering
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

// TODO: Fix react-window version before re-enabling
// import { FixedSizeList as List, type ListChildComponentProps } from 'react-window'
// import AutoSizer from 'react-virtualized-auto-sizer'
// import { memo } from 'react'

interface VirtualizedListProps<T> {
  items: T[]
  height?: number | string
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscanCount?: number  // Number of items to render outside viewport (default: 3)
  onItemsRendered?: (startIndex: number, endIndex: number) => void
}

/**
 * Virtualized List Component (TEMPORARILY DISABLED)
 * 
 * This component is temporarily disabled due to react-window package version issues.
 * Use a regular map for now, or fix the package version first.
 */
export function VirtualizedList<T>({
  items,
  height = '100%',
  renderItem,
  className = '',
}: Pick<VirtualizedListProps<T>, 'items' | 'height' | 'renderItem' | 'className'>) {
  // Fallback to regular rendering until react-window is fixed
  return (
    <div className={className} style={{ height: typeof height === 'number' ? `${height}px` : height, overflow: 'auto' }}>
      {items.map((item, index) => (
        <div key={index}>{renderItem(item, index)}</div>
      ))}
    </div>
  )
}

/**
 * Example Usage: DevicesList with Virtualization
 * 
 * NOTE: This component is temporarily using regular rendering.
 * To re-enable virtualization, fix react-window package version first.
 * 
 * @example
 * ```tsx
 * import { VirtualizedList } from '@/components/ui/virtualized-list'
 * 
 * export function DevicesListVirtualized() {
 *   const [devices, setDevices] = useState<Device[]>([])
 * 
 *   return (
 *     <VirtualizedList
 *       items={devices}
 *       height="calc(100vh - 200px)"  // Responsive height
 *       itemHeight={80}  // Each device card is 80px tall
 *       renderItem={(device) => (
 *         <DeviceCard 
 *           key={device.id}
 *           device={device}
 *           onClick={() => handleDeviceClick(device.id)}
 *         />
 *       )}
 *     />
 *   )
 * }
 * ```
 */

export default VirtualizedList
