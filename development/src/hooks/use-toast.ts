import { useState } from "react"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({ 
    title, 
    description, 
    variant = "default" 
  }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2)
    const newToast: Toast = { 
      id, 
      variant,
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description })
    }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
    
    return { id }
  }

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return {
    toast,
    dismiss,
    toasts,
  }
}