import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * DialogBody component - provides proper scrolling for dialog content on mobile
 * Wraps the main content area between DialogHeader and DialogFooter
 * On mobile: full-screen with fixed header/footer and scrollable body
 * On desktop: normal dialog behavior
 */
const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex-1 overflow-y-auto',
      'max-md:px-6 max-md:py-4',
      className
    )}
    {...props}
  />
))
DialogBody.displayName = 'DialogBody'

export { DialogBody }
