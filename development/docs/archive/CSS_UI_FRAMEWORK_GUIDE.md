# CSS & UI Framework Stack

## 🎨 Your Current Setup

### **CSS Framework: Tailwind CSS 3.4.13**

**Core:**

- **Tailwind CSS** - Utility-first CSS framework
- **@tailwindcss/forms** - Beautiful form styling
- **@tailwindcss/typography** - Rich text formatting
- **tailwindcss-animate** - Animation utilities
- **tailwind-merge** - Intelligent class merging
- **prettier-plugin-tailwindcss** - Auto-sort classes

**Configuration:**

- Custom color scheme with CSS variables (HSL-based)
- Custom theme extending Tailwind defaults
- Dark mode support (class-based)
- Responsive breakpoints
- Custom animations (accordion, fade, slide, etc.)

### **UI Component Library: Custom shadcn/ui-style**

**Component Architecture:**

- Based on **Radix UI** primitives (accessible, unstyled)
- Styled with **Tailwind CSS**
- Type-safe with **TypeScript**
- Component variants using **class-variance-authority (CVA)**

**Available Components:**

```
src/components/ui/
├── alert.tsx              - Alert messages
├── badge.tsx              - Status badges
├── button.tsx             - Buttons with variants
├── card.tsx               - Card containers
├── dialog.tsx             - Modal dialogs
├── enterprise-cards.tsx   - Enterprise-specific cards
├── enterprise-layout.tsx  - Layout components
├── icons.tsx              - Icon components
├── input.tsx              - Form inputs
├── label.tsx              - Form labels
├── loading-spinner.tsx    - Loading states
├── notification-modal.tsx - Notifications
├── progress.tsx           - Progress bars
├── select.tsx             - Select dropdowns
├── switch.tsx             - Toggle switches
├── tabs.tsx               - Tab navigation
├── textarea.tsx           - Text areas
└── toaster.tsx            - Toast notifications
```

### **Styling Approach:**

1. **Utility-First**: Tailwind classes in JSX
2. **Component Variants**: CVA for button/card variants
3. **CSS Variables**: HSL colors for theming
4. **Responsive**: Mobile-first design
5. **Dark Mode**: Class-based theming support

## 🚀 MCP Servers Added

### **New: Tailwind CSS MCP Server**

Now you have AI-powered assistance for:

- ✅ **Class Lookup**: What classes to use
- ✅ **Configuration**: Tailwind config help
- ✅ **Best Practices**: Responsive design patterns
- ✅ **Color Palette**: Using your custom colors
- ✅ **Animation**: Animation utility classes
- ✅ **Plugin Help**: Forms, typography plugins

### **All MCP Servers (16 Total):**

#### Frontend & Styling (5)

1. **Next.js Docs** - App Router, SSR, routing
2. **React Docs** - Components, hooks, patterns
3. **TypeScript Docs** - Type safety
4. **MDN Web Docs** - Web standards, HTML, CSS
5. **Tailwind CSS** - Utility classes ⭐ NEW

#### Backend & Database (2)

6. **Supabase Official** - Full Supabase integration
7. **PostgreSQL** - Database queries

#### Development Tools (3)

8. **Git** - Version control
9. **Filesystem** - File operations
10. **GitHub** - Repository management

#### Testing (2)

11. **Jest Docs** - Unit testing
12. **Playwright Docs** - E2E testing

#### Utilities (3)

13. **Fetch** - HTTP requests
14. **Memory** - Knowledge retention
15. **Sequential Thinking** - Problem solving

#### Runtime (1)

16. **Node.js Docs** - Node APIs

## 💡 How to Use with AI

### **Example Prompts for Tailwind:**

**Layout Questions:**

- "How do I create a responsive grid with Tailwind?"
- "What's the best way to center content vertically and horizontally?"
- "Show me a Tailwind navbar pattern"

**Component Styling:**

- "Style this button with Tailwind to look like a primary action"
- "Create a card component with shadow and hover effects"
- "What Tailwind classes for a sticky sidebar?"

**Colors & Theme:**

- "What are the available color utilities in Tailwind?"
- "How do I use custom CSS variables with Tailwind?"
- "Create a gradient background"

**Responsive Design:**

- "Make this div stack on mobile but flex on desktop"
- "Hide this element on mobile only"
- "Responsive text sizing"

**Animations:**

- "Add a fade-in animation to this component"
- "Transition on hover with Tailwind"
- "Animate height changes"

### **Example Prompts for UI Components:**

**Component Creation:**

- "Create a shadcn-style dropdown menu"
- "Build an accessible modal dialog"
- "Design a loading spinner component"

**Radix UI Integration:**

- "Show me how to use Radix UI Select with Tailwind"
- "Create an accessible accordion"
- "Build a tooltip component"

## 📚 Documentation Links

### **Official Docs:**

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/primitives
- **shadcn/ui**: https://ui.shadcn.com (inspiration, not using directly)
- **CVA**: https://cva.style/docs

### **Your Config Files:**

- `tailwind.config.js` - Tailwind configuration
- `src/app/globals.css` - Global styles & CSS variables
- `src/lib/utils.ts` - Utility functions (cn, etc.)
- `src/components/ui/*` - UI components

## 🎯 Best Practices in Your Project

### **1. Class Naming with `cn` utility:**

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "base-classes",
  conditionalClass && "conditional-classes",
  className // Props override
)} />
```

### **2. Component Variants:**

```typescript
const buttonVariants = cva('base classes', {
  variants: {
    variant: {
      default: 'default classes',
      outline: 'outline classes',
    },
  },
})
```

### **3. Responsive Design:**

```typescript
<div className="
  grid grid-cols-1     // Mobile
  md:grid-cols-2       // Tablet
  lg:grid-cols-3       // Desktop
" />
```

### **4. Custom Colors:**

```typescript
// Use your theme colors
<div className="bg-primary text-primary-foreground" />
<div className="bg-card text-card-foreground" />
```

### **5. Dark Mode:**

```typescript
// Class-based dark mode
<div className="bg-white dark:bg-gray-900" />
```

## 🔄 Next Steps

1. ✅ **Restart VS Code** (to activate Tailwind MCP)
2. 💬 **Try AI prompts** with Tailwind questions
3. 🎨 **Build components** with AI assistance
4. 📖 **Explore patterns** using MCP docs

## 🆘 Common Tasks

### **Create a New Component:**

```typescript
// Ask AI: "Create a shadcn-style Alert component with variants"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"

const alertVariants = cva(
  "rounded-lg border p-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "bg-destructive/10 text-destructive",
      }
    }
  }
)

export function Alert({ variant, className, ...props }) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}
```

### **Style a Form:**

```typescript
// Ask AI: "Create a beautiful form with Tailwind"
<form className="space-y-6">
  <div className="space-y-2">
    <label className="text-sm font-medium">
      Email
    </label>
    <input
      type="email"
      className="w-full px-3 py-2 border rounded-md
                focus:outline-none focus:ring-2
                focus:ring-primary"
    />
  </div>
</form>
```

### **Create a Layout:**

```typescript
// Ask AI: "Create a dashboard layout with sidebar"
<div className="flex h-screen">
  <aside className="w-64 bg-card border-r">
    {/* Sidebar */}
  </aside>
  <main className="flex-1 overflow-auto p-6">
    {/* Content */}
  </main>
</div>
```

---

**You now have complete AI assistance for your entire CSS/UI stack!** 🎉
