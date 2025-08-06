# Frontend Applications Documentation

## Overview
The NetNeural platform includes 5 frontend applications built with modern React and TypeScript, providing user interfaces for different aspects of the IoT platform.

## Applications

### 1. origin-ui - Main Dashboard
**Location**: `./origin-ui/`
**Purpose**: Primary user interface for the NetNeural platform

#### Technology Stack
- **React**: 19.0.0
- **TypeScript**: 5.7.2
- **Build Tool**: Vite 6.2.0
- **UI Framework**: Ant Design 5.25.1
- **State Management**: Redux Toolkit 2.8.2
- **3D Graphics**: Three.js 0.177.0
- **Charts**: Recharts 2.15.3

#### Key Features
- Real-time device monitoring dashboard
- Interactive 3D visualizations
- Drag-and-drop interface components
- WebSocket connections for live data
- Zoom/pan/pinch interactions
- Comprehensive charting and analytics

#### Development Commands
```bash
cd origin-ui
npm install
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Code linting
npm run storybook    # Component documentation
npm run preview      # Preview production build
```

#### Dependencies
- `@netneural/react-components`: Shared component library
- `@ant-design/icons`: Icon library
- `react-dnd`: Drag and drop functionality
- `react-use-websocket`: WebSocket integration
- `react-zoom-pan-pinch`: Interactive pan/zoom

---

### 2. sso-ui - Authentication Interface
**Location**: `./sso-ui/`
**Purpose**: Single Sign-On user interface

#### Features
- User login/logout flows
- Password recovery
- Account registration
- JWT token management

---

### 3. cellular-ui - Cellular Device Management
**Location**: `./cellular-ui/`
**Purpose**: Interface for managing cellular IoT devices

#### Features
- Cellular device monitoring
- Signal strength visualization
- Device configuration
- Data usage tracking

---

### 4. store-ui - E-commerce Frontend
**Location**: `./store-ui/`
**Purpose**: E-commerce interface for NetNeural products

#### Features
- Product catalog
- Shopping cart
- Order management
- Payment integration

---

### 5. react-components - Shared Component Library
**Location**: `./react-components/`
**Purpose**: Reusable React components across all applications

#### Technology Stack
- **React**: 19.0.0 (peer dependency)
- **TypeScript**: 5.7.2
- **Build**: Vite with TypeScript declarations
- **Documentation**: Storybook 8.6.12

#### Package Information
- **NPM Package**: `@netneural/react-components`
- **Registry**: GitHub Packages (`@netneural:registry`)
- **Exports**: ESM and UMD formats

#### Development Commands
```bash
cd react-components
npm run build              # Build library
npm run lint              # Code linting
npm run storybook         # View component documentation
npm run build-storybook   # Build Storybook for deployment
```

#### Build Outputs
- `dist/nn-component-library.es.js` - ESM format
- `dist/nn-component-library.umd.js` - UMD format
- `dist/index.d.ts` - TypeScript definitions

## Shared Development Setup

### Prerequisites
```bash
# Install Node.js 18+
node --version

# Install dependencies for all projects
for dir in origin-ui sso-ui cellular-ui store-ui react-components; do
  cd $dir && npm install && cd ..
done
```

### Development Workflow

1. **Component Development**:
   ```bash
   # Start with shared components
   cd react-components
   npm run storybook    # Develop components in isolation
   npm run build        # Build library
   ```

2. **Application Development**:
   ```bash
   # Link shared components locally (if needed)
   cd react-components && npm link
   cd ../origin-ui && npm link @netneural/react-components
   
   # Start development
   npm run dev
   ```

3. **Testing**:
   ```bash
   # Each application
   npm run lint         # ESLint checking
   npm test            # Unit tests (if configured)
   ```

### Build Configuration

#### Common Vite Configuration Features
- TypeScript support with strict mode
- ESLint integration
- React Fast Refresh
- SSL support for development
- Storybook integration

#### ESLint Configuration
All projects use consistent ESLint rules:
- `@eslint/js` recommended rules
- `eslint-plugin-react-hooks` for React hooks
- `eslint-plugin-react-refresh` for Fast Refresh
- `eslint-plugin-storybook` for Storybook files

### Deployment

#### Development Deployment
```bash
# Each application
npm run build        # Creates dist/ directory
npm run preview      # Preview production build
```

#### Production Deployment
All applications are containerized using Docker:
```dockerfile
# Example Dockerfile pattern
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### API Integration

#### Backend Communication
- **Authentication**: Integrates with `sso/` service
- **Real-time Data**: WebSocket connections to various Go services
- **REST APIs**: Standard HTTP requests to microservices
- **State Management**: Redux Toolkit for complex state

#### Environment Variables
Each application requires environment-specific configuration:
```bash
# Example .env.local
VITE_API_BASE_URL=https://api.netneural.com
VITE_WS_URL=wss://ws.netneural.com
VITE_AUTH_SERVICE=https://sso.netneural.com
```

### Component Library Usage

#### Installing Shared Components
```bash
npm install @netneural/react-components
```

#### Usage in Applications
```typescript
import { Button, Dashboard, DeviceCard } from '@netneural/react-components';

function App() {
  return (
    <Dashboard>
      <DeviceCard device={device} />
      <Button onClick={handleClick}>Action</Button>
    </Dashboard>
  );
}
```

### Storybook Documentation

Access component documentation:
```bash
cd react-components
npm run storybook
# Opens http://localhost:6006
```

Features:
- Interactive component playground
- Props documentation
- Usage examples
- Design system guidelines

## Best Practices

### Code Organization
```
src/
├── components/     # Reusable UI components
├── pages/         # Route-level components
├── hooks/         # Custom React hooks
├── services/      # API integration
├── store/         # Redux store setup
├── types/         # TypeScript definitions
└── utils/         # Utility functions
```

### State Management
- **Local State**: React hooks for component-specific state
- **Global State**: Redux Toolkit for application-wide state
- **Server State**: React Query or SWR for API data caching
- **Form State**: Controlled components with validation

### Performance Optimization
- **Code Splitting**: Dynamic imports for route-level components
- **Lazy Loading**: Lazy load heavy components
- **Memoization**: React.memo for expensive components
- **Bundle Analysis**: Regular bundle size monitoring

### Testing Strategy
- **Unit Tests**: Jest + React Testing Library
- **Component Tests**: Storybook interaction tests
- **E2E Tests**: Playwright for critical user flows
- **Visual Tests**: Storybook visual regression testing

## Troubleshooting

### Common Issues

1. **Module Resolution**:
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **TypeScript Errors**:
   ```bash
   # Check TypeScript configuration
   npx tsc --noEmit
   ```

3. **Build Failures**:
   ```bash
   # Clear Vite cache
   rm -rf node_modules/.vite
   npm run build
   ```

4. **Storybook Issues**:
   ```bash
   # Rebuild Storybook
   npm run build-storybook
   ```

### Development Server Issues
- **Port Conflicts**: Change port in vite.config.ts
- **HTTPS**: Enable SSL for local development
- **Hot Reload**: Restart dev server if HMR breaks

## Future Enhancements

### Planned Features
- **Micro-frontends**: Module federation setup
- **PWA Support**: Service workers and offline functionality
- **Internationalization**: i18n support for multiple languages
- **Advanced Testing**: Visual regression and accessibility testing

### Architecture Evolution
- **Component Design System**: Comprehensive design token system
- **Monorepo Tooling**: Nx or Lerna for better monorepo management
- **Build Optimization**: Advanced Vite plugins and optimizations
