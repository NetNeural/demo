import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles matching custom .btn class exactly
  "inline-flex items-center justify-center whitespace-nowrap select-none no-underline " +
  "border border-transparent cursor-pointer " +
  "transition-all duration-150 ease-in-out " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Matching .btn-primary - gradient with lift on hover
        default: 
          "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm rounded-lg " +
          "hover:from-blue-700 hover:to-blue-600 hover:shadow hover:-translate-y-px " +
          "active:translate-y-0 " +
          "disabled:hover:from-blue-600 disabled:hover:to-blue-500 disabled:hover:translate-y-0 disabled:hover:shadow-sm",
        
        // Matching .btn-secondary - white background with border
        secondary:
          "bg-white text-gray-700 border-gray-300 shadow-sm rounded-lg " +
          "hover:bg-gray-50 hover:border-gray-400 " +
          "disabled:hover:bg-white disabled:hover:border-gray-300",
        
        // Matching .btn-ghost - transparent background
        ghost: 
          "bg-transparent text-gray-600 rounded-lg " +
          "hover:bg-gray-100 hover:text-gray-700 " +
          "disabled:hover:bg-transparent disabled:hover:text-gray-600",
        
        // Additional useful variants
        outline:
          "border border-gray-300 bg-background rounded-lg hover:bg-gray-50 hover:text-gray-900",
        
        destructive:
          "bg-red-600 text-white shadow-sm rounded-lg hover:bg-red-700 hover:shadow",
        
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        // Matching default button size (0.75rem x 1rem padding)
        default: "px-4 py-3 text-sm font-medium",
        
        // Matching .btn-sm
        sm: "px-3 py-2 text-xs font-medium",
        
        // Matching .btn-lg  
        lg: "px-6 py-4 text-base font-medium",
        
        // Icon button
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }