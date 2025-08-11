# NetNeural UI Project Relationship Map

## Overview
The NetNeural monorepo contains 7 UI-related projects with a shared component library architecture. These projects serve different aspects of the IoT platform ecosystem.

## UI Project Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NetNeural IoT Platform                            │
│                              Frontend Ecosystem                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   react-components  │ ← Core Shared Component Library
│  @netneural/react-  │   
│     components      │   - Version: 0.0.0 (dev)
│                     │   - Tech: React 18/19, Vite, TypeScript, Storybook
│   📦 Shared Library │   - Purpose: Reusable UI components
└─────────────────────┘
           │
           │ (consumed by)
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Consumer Applications                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    cellular-ui      │  │     origin-ui       │  │      sso-ui         │
│                     │  │                     │  │                     │
│ 📱 Cellular Device   │  │ 🏠 Main Platform    │  │ 🔐 Authentication   │
│    Management       │  │    Digital Twin     │  │    Single Sign-On   │
│                     │  │                     │  │                     │
│ • React 18.3.1      │  │ • React 19.0.0      │  │ • React 18.3.1      │
│ • Vite + TypeScript │  │ • Vite + TypeScript │  │ • Vite + TypeScript │
│ • Uses @netneural/  │  │ • Uses @netneural/  │  │ • Uses @netneural/  │
│   react-components  │  │   react-components  │  │   react-components  │
│ • Storybook         │  │ • Redux Toolkit     │  │ • Storybook         │
│ • Docker ready      │  │ • Socket.io client  │  │ • Docker ready      │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│     store-ui        │  │     core-ui         │  │   ui-dev-server     │
│                     │  │                     │  │                     │
│ 🛒 E-commerce       │  │ ⚙️ Core Platform    │  │ 🔧 Development      │
│    Store (Planned)  │  │    UI (TBD)         │  │    Backend Mock     │
│                     │  │                     │  │                     │
│ • Status: Placeholder│ │ • Status: Not Built │  │ • Go Backend        │
│ • Static HTML page  │  │ • Directory exists  │  │ • Port 8080         │
│ • "Under Construction"│ │   but no source    │  │ • Simulates API     │
│ • Docker config     │  │                     │  │ • UI Dev Support    │
│ • Nginx ready       │  │                     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

## Project Details

### 1. react-components (Shared Library)
**Purpose**: Central component library providing reusable UI components
- **Type**: NPM Package (`@netneural/react-components`)
- **Tech Stack**: React 18/19, Vite, TypeScript, Storybook
- **Status**: Active development (v0.0.0)
- **Consumers**: cellular-ui, origin-ui, sso-ui
- **Features**: 
  - Dual React version support (18 & 19)
  - UMD/ES module exports
  - Storybook documentation
  - GitHub Packages registry

### 2. origin-ui (Main Platform)
**Purpose**: Primary digital twin platform interface
- **Tech Stack**: React 19.0.0, Redux Toolkit, Socket.io
- **Features**:
  - Real-time data visualization
  - Location-based routing
  - Store integration
  - WebSocket connectivity
- **Dependencies**: @netneural/react-components ^0.1.1
- **Status**: Active development

### 3. cellular-ui (Device Management)
**Purpose**: Cellular device management interface
- **Tech Stack**: React 18.3.1, Vite, TypeScript
- **Features**:
  - Device configuration
  - Network status monitoring
  - Device lifecycle management
- **Dependencies**: @netneural/react-components ^0.1.1
- **Status**: Active development

### 4. sso-ui (Authentication)
**Purpose**: Single Sign-On authentication interface
- **Tech Stack**: React 18.3.1, Vite, TypeScript
- **Features**:
  - User authentication flows
  - OAuth integration
  - Session management
- **Dependencies**: @netneural/react-components ^0.1.1
- **Status**: Active development

### 5. store-ui (E-commerce - Planned)
**Purpose**: E-commerce store for IoT devices/services
- **Status**: Placeholder/Under Construction
- **Current State**: Static HTML "Coming Soon" page
- **Infrastructure**: Docker + Nginx configured
- **Future**: Will likely use shared component library

### 6. core-ui (Core Platform - TBD)
**Purpose**: Core platform UI (undefined)
- **Status**: Directory exists but no source code
- **Future**: Likely core administrative interface

### 7. ui-dev-server (Development Support)
**Purpose**: Mock backend for UI development
- **Tech Stack**: Go
- **Port**: 8080
- **Function**: Simulates platform APIs for UI development
- **Status**: Active utility

## Dependency Relationships

### Component Library Dependencies
```
@netneural/react-components (v0.1.1)
├── cellular-ui ✓
├── origin-ui ✓  
├── sso-ui ✓
├── store-ui (future)
└── core-ui (future)
```

### Technology Stack Variations
```
React 19.x
└── origin-ui

React 18.x  
├── cellular-ui
└── sso-ui

Static HTML
└── store-ui

Go Backend
└── ui-dev-server

Undefined
└── core-ui
```

## Development Workflow

### 1. Shared Component Development
- Components developed in `react-components`
- Published to GitHub Packages as `@netneural/react-components`
- Consumer apps import and use shared components

### 2. Individual App Development
- Each UI app has independent development workflow
- All use Vite for bundling and dev server
- Storybook for component documentation (where configured)
- Docker containerization for deployment

### 3. Backend Integration
- Production: Apps connect to NetNeural platform APIs
- Development: Use `ui-dev-server` for API simulation

## Architecture Patterns

### Shared Component Strategy
- **Centralized**: Single component library shared across apps
- **Versioned**: Semantic versioning for component library updates
- **Flexible**: Supports React 18.x and 19.x consumers

### Application Specialization
- **cellular-ui**: Device-specific management interface
- **origin-ui**: Main platform dashboard with real-time features
- **sso-ui**: Authentication-focused user flows
- **store-ui**: Future e-commerce integration
- **core-ui**: Future core administrative functions

### Technology Consistency
- **Build Tool**: Vite across all React applications
- **Language**: TypeScript for type safety
- **Styling**: Shared component styling through library
- **Documentation**: Storybook for component documentation

## Future Considerations

### Planned Expansions
1. **store-ui**: Full e-commerce implementation
2. **core-ui**: Core platform administrative interface
3. **Component Library**: Continuous expansion of shared components

### Version Management
- React version standardization across apps
- Component library versioning strategy
- Breaking change management

### Integration Points
- API standardization with backend services
- Authentication flow integration across all UIs
- Shared state management patterns

## Summary
The NetNeural UI ecosystem follows a hub-and-spoke model with `react-components` as the central shared library serving specialized application interfaces. This architecture promotes code reuse, consistent UX, and efficient development while allowing each application to focus on its specific domain requirements.
