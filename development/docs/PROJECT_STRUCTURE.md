# NetNeural Project Structure Blueprint

This document defines the **exact folder structure, naming conventions, and organization patterns** for the NetNeural IoT Platform implementation.

## 📁 Complete Directory Structure

```
development/
├── 📄 README.md                        # Development setup guide
├── 📄 TECHNICAL_SPECIFICATION.md       # Master technical specification
├── 📄 CO├── 📁 docs/                         # Development documentation
│   ├── 📄 api.md                       # API documentation
│   ├── 📄 deployment.md                # Deployment guide
│   ├── 📄 testing.md                   # Testing guide
│   ├── 📄 database.md                  # Database schema docs
│   ├── 📄 golioth.md                   # Golioth integration guide
│   ├── 📄 security.md                  # Security guidelines
│   ├── 📄 performance.md               # Performance optimization
│   ├── 📄 troubleshooting.md           # Common issues and solutions
│   ├── 📄 architecture.md              # System architecture
│   ├── 📄 contributing.md              # Contributing guidelines
│   ├── 📄 changelog.md                 # Version history
│   └── 📄 faq.md                       # Frequently asked questionsDARDS.md              # Development standards and guidelines
├── 📄 .env.example                     # Environment template
├── 📄 .env                             # Local environment (git-ignored)
├── 📄 .gitignore                       # Git ignore patterns
├── 📄 package.json                     # Project dependencies and scripts
├── 📄 package-lock.json                # Locked dependency versions
├── 📄 next.config.js                   # Next.js configuration
├── 📄 tailwind.config.js               # Tailwind CSS configuration
├── 📄 tsconfig.json                    # TypeScript configuration
├── 📄 .eslintrc.json                   # ESLint configuration
├── 📄 .prettierrc                      # Prettier configuration
├── 📄 jest.config.js                   # Jest testing configuration
├── 📄 playwright.config.ts             # E2E testing configuration
├── 📄 docker-compose.yml               # Local development services
├── 📄 Dockerfile                       # Production container
├── 📄 Dockerfile.dev                   # Development container
│
├── 📁 .github/                         # GitHub Actions and templates
│   ├── 📁 workflows/                   # CI/CD pipelines
│   │   ├── 📄 development.yml          # Development pipeline
│   │   ├── 📄 production.yml           # Production deployment
│   │   └── 📄 security.yml             # Security scanning
│   ├── 📁 ISSUE_TEMPLATE/              # Issue templates
│   ├── 📁 PULL_REQUEST_TEMPLATE/       # PR templates
│   └── 📄 dependabot.yml               # Dependency updates
│
├── 📁 supabase/                        # Supabase configuration
│   ├── 📄 config.toml                  # Supabase CLI configuration
│   ├── 📁 migrations/                  # Database migrations
│   │   ├── 📄 20250918000001_initial_schema.sql
│   │   ├── 📄 20250918000002_device_management.sql
│   │   ├── 📄 20250918000003_golioth_integration.sql
│   │   └── 📄 20250918000004_monitoring_tables.sql
│   ├── 📄 seed.sql                     # Development seed data
│   └── 📁 functions/                   # Edge functions
│       ├── 📄 device-sync/             # Device synchronization
│       └── 📄 webhook-handler/         # Webhook processing
│
├── 📁 src/                             # Application source code
│   ├── 📁 app/                         # Next.js App Router
│   │   ├── 📄 layout.tsx               # Root application layout
│   │   ├── 📄 page.tsx                 # Landing/home page
│   │   ├── 📄 loading.tsx              # Global loading component
│   │   ├── 📄 error.tsx                # Global error boundary
│   │   ├── 📄 not-found.tsx            # 404 page
│   │   ├── 📄 globals.css              # Global CSS styles
│   │   │
│   │   ├── 📁 (auth)/                  # Authentication group
│   │   │   ├── 📄 layout.tsx           # Auth layout (centered forms)
│   │   │   ├── 📁 login/               # Login page
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 register/            # Registration page
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 forgot-password/     # Password reset
│   │   │   │   └── 📄 page.tsx
│   │   │   └── 📁 reset-password/      # Password reset form
│   │   │       └── 📄 page.tsx
│   │   │
│   │   ├── 📁 (dashboard)/             # Dashboard group (authenticated)
│   │   │   ├── 📄 layout.tsx           # Dashboard layout (sidebar, header)
│   │   │   ├── 📁 dashboard/           # Main dashboard
│   │   │   │   ├── 📄 page.tsx         # Dashboard overview
│   │   │   │   ├── 📄 loading.tsx      # Dashboard loading state
│   │   │   │   └── 📄 error.tsx        # Dashboard error boundary
│   │   │   │
│   │   │   ├── 📁 devices/             # Device management
│   │   │   │   ├── 📄 page.tsx         # Device list view
│   │   │   │   ├── 📄 loading.tsx      # Devices loading state
│   │   │   │   ├── 📁 [deviceId]/      # Dynamic device routes
│   │   │   │   │   ├── 📄 page.tsx     # Device details
│   │   │   │   │   ├── 📄 edit/        # Device edit form
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 history/     # Device history
│   │   │   │   │       └── 📄 page.tsx
│   │   │   │   ├── 📁 new/             # Create device
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📁 bulk/            # Bulk operations
│   │   │   │       ├── 📄 import/
│   │   │   │       │   └── 📄 page.tsx
│   │   │   │       └── 📄 export/
│   │   │   │           └── 📄 page.tsx
│   │   │   │
│   │   │   ├── 📁 services/            # IoT service management
│   │   │   │   ├── 📄 page.tsx         # Services list
│   │   │   │   ├── 📁 golioth/         # Golioth integration
│   │   │   │   │   ├── 📄 page.tsx     # Golioth dashboard
│   │   │   │   │   ├── 📄 sync/        # Sync management
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 settings/    # Golioth settings
│   │   │   │   │       └── 📄 page.tsx
│   │   │   │   └── 📁 [serviceId]/     # Dynamic service routes
│   │   │   │       └── 📄 page.tsx
│   │   │   │
│   │   │   ├── 📁 analytics/           # Analytics and monitoring
│   │   │   │   ├── 📄 page.tsx         # Analytics overview
│   │   │   │   ├── 📁 devices/         # Device analytics
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 performance/     # Performance metrics
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📁 alerts/          # Alert analytics
│   │   │   │       └── 📄 page.tsx
│   │   │   │
│   │   │   ├── 📁 alerts/              # Alert management
│   │   │   │   ├── 📄 page.tsx         # Alert list
│   │   │   │   ├── 📁 rules/           # Alert rules
│   │   │   │   │   ├── 📄 page.tsx     # Rules list
│   │   │   │   │   ├── 📁 new/         # Create rule
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📁 [ruleId]/    # Edit rule
│   │   │   │   │       └── 📄 page.tsx
│   │   │   │   └── 📁 notifications/   # Notification settings
│   │   │   │       └── 📄 page.tsx
│   │   │   │
│   │   │   ├── 📁 organization/        # Organization management
│   │   │   │   ├── 📄 page.tsx         # Organization overview
│   │   │   │   ├── 📁 users/           # User management
│   │   │   │   │   ├── 📄 page.tsx     # Users list
│   │   │   │   │   ├── 📁 invite/      # Invite users
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📁 [userId]/    # User details
│   │   │   │   │       └── 📄 page.tsx
│   │   │   │   ├── 📁 settings/        # Organization settings
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📁 billing/         # Billing management
│   │   │   │       └── 📄 page.tsx
│   │   │   │
│   │   │   └── 📁 profile/             # User profile
│   │   │       ├── 📄 page.tsx         # Profile overview
│   │   │       ├── 📁 settings/        # Profile settings
│   │   │       │   └── 📄 page.tsx
│   │   │       └── 📁 security/        # Security settings
│   │   │           └── 📄 page.tsx
│   │   │
│   │   └── 📁 api/                     # API routes
│   │       ├── 📁 auth/                # Authentication endpoints
│   │       │   ├── 📄 session/         # Session management
│   │       │   │   └── 📄 route.ts
│   │       │   ├── 📄 login/           # Login endpoint
│   │       │   │   └── 📄 route.ts
│   │       │   ├── 📄 logout/          # Logout endpoint
│   │       │   │   └── 📄 route.ts
│   │       │   └── 📄 refresh/         # Token refresh
│   │       │       └── 📄 route.ts
│   │       │
│   │       ├── 📁 devices/             # Device management APIs
│   │       │   ├── 📄 route.ts         # GET /api/devices, POST /api/devices
│   │       │   ├── 📁 [deviceId]/      # Device-specific endpoints
│   │       │   │   ├── 📄 route.ts     # GET, PUT, DELETE device
│   │       │   │   ├── 📁 sync/        # Device sync operations
│   │       │   │   │   └── 📄 route.ts
│   │       │   │   └── 📁 history/     # Device history
│   │       │   │       └── 📄 route.ts
│   │       │   ├── 📁 bulk/            # Bulk operations
│   │       │   │   ├── 📄 import/      
│   │       │   │   │   └── 📄 route.ts
│   │       │   │   ├── 📄 export/      
│   │       │   │   │   └── 📄 route.ts
│   │       │   │   └── 📄 delete/      
│   │       │   │       └── 📄 route.ts
│   │       │   └── 📁 search/          # Device search
│   │       │       └── 📄 route.ts
│   │       │
│   │       ├── 📁 golioth/             # Golioth integration APIs
│   │       │   ├── 📁 devices/         # Golioth device operations
│   │       │   │   └── 📄 route.ts     # GET, POST golioth devices
│   │       │   ├── 📁 projects/        # Golioth projects
│   │       │   │   └── 📄 route.ts     # GET golioth projects
│   │       │   ├── 📁 sync/            # Sync operations
│   │       │   │   ├── 📄 route.ts     # GET sync status, POST manual sync
│   │       │   │   └── 📁 logs/        # Sync logs
│   │       │   │       └── 📄 route.ts
│   │       │   └── 📁 webhooks/        # Webhook handlers
│   │       │       └── 📄 route.ts
│   │       │
│   │       ├── 📁 organizations/       # Organization management
│   │       │   ├── 📄 route.ts         # Organization CRUD
│   │       │   ├── 📁 users/           # Organization users
│   │       │   │   └── 📄 route.ts
│   │       │   ├── 📁 settings/        # Organization settings
│   │       │   │   └── 📄 route.ts
│   │       │   └── 📁 invites/         # User invitations
│   │       │       └── 📄 route.ts
│   │       │
│   │       ├── 📁 alerts/              # Alert management APIs
│   │       │   ├── 📄 route.ts         # Alert CRUD
│   │       │   ├── 📁 rules/           # Alert rules
│   │       │   │   └── 📄 route.ts
│   │       │   └── 📁 notifications/   # Notification settings
│   │       │       └── 📄 route.ts
│   │       │
│   │       ├── 📁 analytics/           # Analytics APIs
│   │       │   ├── 📁 devices/         # Device analytics
│   │       │   │   └── 📄 route.ts
│   │       │   ├── 📁 performance/     # Performance metrics
│   │       │   │   └── 📄 route.ts
│   │       │   └── 📁 dashboard/       # Dashboard data
│   │       │       └── 📄 route.ts
│   │       │
│   │       └── 📁 health/              # Health and monitoring
│   │           ├── 📄 route.ts         # Health check endpoint
│   │           ├── 📁 live/            # Liveness probe
│   │           │   └── 📄 route.ts
│   │           └── 📁 ready/           # Readiness probe
│   │               └── 📄 route.ts
│   │
│   ├── 📁 components/                  # React components
│   │   ├── 📁 ui/                      # Base UI components (shadcn/ui style)
│   │   │   ├── 📄 button.tsx           # Button component
│   │   │   ├── 📄 input.tsx            # Input component
│   │   │   ├── 📄 card.tsx             # Card component
│   │   │   ├── 📄 table.tsx            # Table component
│   │   │   ├── 📄 dialog.tsx           # Dialog/Modal component
│   │   │   ├── 📄 select.tsx           # Select dropdown
│   │   │   ├── 📄 checkbox.tsx         # Checkbox component
│   │   │   ├── 📄 radio.tsx            # Radio button
│   │   │   ├── 📄 textarea.tsx         # Textarea component
│   │   │   ├── 📄 badge.tsx            # Badge component
│   │   │   ├── 📄 alert.tsx            # Alert component
│   │   │   ├── 📄 toast.tsx            # Toast notification
│   │   │   ├── 📄 spinner.tsx          # Loading spinner
│   │   │   ├── 📄 tooltip.tsx          # Tooltip component
│   │   │   ├── 📄 popover.tsx          # Popover component
│   │   │   └── 📄 separator.tsx        # Separator line
│   │   │
│   │   ├── 📁 layout/                  # Layout components
│   │   │   ├── 📄 Header.tsx           # Application header
│   │   │   ├── 📄 Sidebar.tsx          # Navigation sidebar
│   │   │   ├── 📄 Footer.tsx           # Application footer
│   │   │   ├── 📄 Navigation.tsx       # Main navigation
│   │   │   ├── 📄 Breadcrumbs.tsx      # Breadcrumb navigation
│   │   │   ├── 📄 UserMenu.tsx         # User dropdown menu
│   │   │   └── 📄 MobileMenu.tsx       # Mobile navigation
│   │   │
│   │   ├── 📁 forms/                   # Form components
│   │   │   ├── 📄 DeviceForm.tsx       # Device creation/edit form
│   │   │   ├── 📄 UserForm.tsx         # User management form
│   │   │   ├── 📄 OrganizationForm.tsx # Organization settings form
│   │   │   ├── 📄 AlertRuleForm.tsx    # Alert rule configuration
│   │   │   ├── 📄 ServiceForm.tsx      # IoT service configuration
│   │   │   ├── 📄 BulkImportForm.tsx   # Bulk device import
│   │   │   └── 📄 SearchForm.tsx       # Advanced search form
│   │   │
│   │   ├── 📁 devices/                 # Device-specific components
│   │   │   ├── 📄 DeviceCard.tsx       # Device display card
│   │   │   ├── 📄 DeviceList.tsx       # Device list view
│   │   │   ├── 📄 DeviceTable.tsx      # Device table with sorting
│   │   │   ├── 📄 DeviceStatus.tsx     # Device status indicator
│   │   │   ├── 📄 DeviceMetrics.tsx    # Device metrics display
│   │   │   ├── 📄 DeviceActions.tsx    # Device action buttons
│   │   │   ├── 📄 DeviceHistory.tsx    # Device history timeline
│   │   │   ├── 📄 DeviceSync.tsx       # Sync status and controls
│   │   │   └── 📄 DeviceFilters.tsx    # Device filtering controls
│   │   │
│   │   ├── 📁 charts/                  # Data visualization components
│   │   │   ├── 📄 LineChart.tsx        # Time series charts
│   │   │   ├── 📄 BarChart.tsx         # Bar charts
│   │   │   ├── 📄 PieChart.tsx         # Pie charts
│   │   │   ├── 📄 DonutChart.tsx       # Donut charts
│   │   │   ├── 📄 AreaChart.tsx        # Area charts
│   │   │   ├── 📄 MetricCard.tsx       # Metric display cards
│   │   │   ├── 📄 Dashboard.tsx        # Dashboard layout
│   │   │   └── 📄 RealTimeChart.tsx    # Real-time data charts
│   │   │
│   │   ├── 📁 alerts/                  # Alert-related components
│   │   │   ├── 📄 AlertList.tsx        # Alert list display
│   │   │   ├── 📄 AlertCard.tsx        # Individual alert card
│   │   │   ├── 📄 AlertStatus.tsx      # Alert status indicator
│   │   │   ├── 📄 AlertRules.tsx       # Alert rules management
│   │   │   ├── 📄 NotificationSettings.tsx # Notification configuration
│   │   │   └── 📄 AlertHistory.tsx     # Alert history view
│   │   │
│   │   ├── 📁 auth/                    # Authentication components
│   │   │   ├── 📄 LoginForm.tsx        # Login form
│   │   │   ├── 📄 RegisterForm.tsx     # Registration form
│   │   │   ├── 📄 ForgotPasswordForm.tsx # Password reset request
│   │   │   ├── 📄 ResetPasswordForm.tsx # Password reset form
│   │   │   ├── 📄 AuthGuard.tsx        # Route protection
│   │   │   └── 📄 AuthProvider.tsx     # Authentication context
│   │   │
│   │   └── 📁 common/                  # Common/shared components
│   │       ├── 📄 LoadingSpinner.tsx   # Loading indicators
│   │       ├── 📄 ErrorBoundary.tsx    # Error boundary component
│   │       ├── 📄 EmptyState.tsx       # Empty state displays
│   │       ├── 📄 ConfirmDialog.tsx    # Confirmation dialogs
│   │       ├── 📄 DataTable.tsx        # Reusable data table
│   │       ├── 📄 SearchInput.tsx      # Search input component
│   │       ├── 📄 DatePicker.tsx       # Date picker component
│   │       ├── 📄 FileUpload.tsx       # File upload component
│   │       ├── 📄 Pagination.tsx       # Pagination component
│   │       └── 📄 StatusBadge.tsx      # Status badge component
│   │
│   ├── 📁 lib/                         # Utility libraries and services
│   │   ├── 📄 supabase.ts              # Supabase client configuration
│   │   ├── 📄 database.types.ts        # Generated database types
│   │   ├── 📄 auth.ts                  # Authentication utilities
│   │   ├── 📄 utils.ts                 # General utility functions
│   │   ├── 📄 constants.ts             # Application constants
│   │   ├── 📄 validations.ts           # Form validation schemas
│   │   ├── 📄 api.ts                   # API client utilities
│   │   ├── 📄 errors.ts                # Error handling utilities
│   │   ├── 📄 crypto.ts                # Encryption/decryption utilities
│   │   ├── 📄 date.ts                  # Date formatting utilities
│   │   ├── 📄 string.ts                # String manipulation utilities
│   │   │
│   │   ├── 📁 services/                # External service integrations
│   │   │   ├── 📄 golioth.ts           # Golioth API service
│   │   │   ├── 📄 email.ts             # Email service
│   │   │   ├── 📄 notifications.ts     # Notification service
│   │   │   ├── 📄 analytics.ts         # Analytics service
│   │   │   ├── 📄 monitoring.ts        # Monitoring service
│   │   │   └── 📄 storage.ts           # File storage service
│   │   │
│   │   └── 📁 hooks/                   # Custom React hooks
│   │       ├── 📄 useAuth.ts           # Authentication hook
│   │       ├── 📄 useDevices.ts        # Device management hook
│   │       ├── 📄 useGolioth.ts        # Golioth integration hook
│   │       ├── 📄 useAlerts.ts         # Alert management hook
│   │       ├── 📄 useOrganization.ts   # Organization management hook
│   │       ├── 📄 useAnalytics.ts      # Analytics data hook
│   │       ├── 📄 useWebSocket.ts      # WebSocket connection hook
│   │       ├── 📄 useLocalStorage.ts   # Local storage hook
│   │       ├── 📄 useDebounce.ts       # Debouncing hook
│   │       └── 📄 usePagination.ts     # Pagination hook
│   │
│   ├── 📁 types/                       # TypeScript type definitions
│   │   ├── 📄 database.ts              # Database-related types
│   │   ├── 📄 api.ts                   # API request/response types
│   │   ├── 📄 auth.ts                  # Authentication types
│   │   ├── 📄 devices.ts               # Device-related types
│   │   ├── 📄 golioth.ts               # Golioth API types
│   │   ├── 📄 alerts.ts                # Alert-related types
│   │   ├── 📄 analytics.ts             # Analytics types
│   │   ├── 📄 organization.ts          # Organization types
│   │   ├── 📄 common.ts                # Common/shared types
│   │   └── 📄 global.ts                # Global type augmentations
│   │
│   └── 📁 styles/                      # CSS and styling
│       ├── 📄 globals.css              # Global CSS styles
│       ├── 📄 components.css           # Component-specific styles
│       ├── 📄 utilities.css            # Utility classes
│       └── 📄 themes.css               # Theme configurations
│
├── 📁 public/                          # Static assets
│   ├── 📄 favicon.ico                  # App favicon
│   ├── 📄 logo.svg                     # NetNeural logo
│   ├── 📄 manifest.json                # Web app manifest
│   ├── 📄 robots.txt                   # SEO robots file
│   ├── 📁 icons/                       # Application icons
│   ├── 📁 images/                      # Static images
│   └── 📁 fonts/                       # Custom fonts
│
├── 📁 tests/                           # Test files
│   ├── 📁 __mocks__/                   # Test mocks and fixtures
│   │   ├── 📄 supabase.ts              # Supabase mock
│   │   ├── 📄 golioth.ts               # Golioth API mock
│   │   └── 📄 next-router.ts           # Next.js router mock
│   │
│   ├── 📁 components/                  # Component tests
│   │   ├── 📄 DeviceCard.test.tsx      # Device card tests
│   │   ├── 📄 DeviceForm.test.tsx      # Device form tests
│   │   ├── 📄 LoginForm.test.tsx       # Login form tests
│   │   └── 📄 ...                      # Other component tests
│   │
│   ├── 📁 api/                         # API route tests
│   │   ├── 📄 devices.test.ts          # Device API tests
│   │   ├── 📄 auth.test.ts             # Auth API tests
│   │   ├── 📄 golioth.test.ts          # Golioth API tests
│   │   └── 📄 ...                      # Other API tests
│   │
│   ├── 📁 hooks/                       # Hook tests
│   │   ├── 📄 useAuth.test.ts          # Auth hook tests
│   │   ├── 📄 useDevices.test.ts       # Device hook tests
│   │   └── 📄 ...                      # Other hook tests
│   │
│   ├── 📁 lib/                         # Library/utility tests
│   │   ├── 📄 auth.test.ts             # Auth utility tests
│   │   ├── 📄 golioth.test.ts          # Golioth service tests
│   │   └── 📄 ...                      # Other utility tests
│   │
│   ├── 📁 integration/                 # Integration tests
│   │   ├── 📄 device-management.test.ts # Device flow tests
│   │   ├── 📄 auth-flow.test.ts        # Authentication flow tests
│   │   └── 📄 golioth-sync.test.ts     # Golioth sync tests
│   │
│   └── 📁 e2e/                         # End-to-end tests
│       ├── 📄 device-management.spec.ts # Device management E2E
│       ├── 📄 user-authentication.spec.ts # Auth E2E
│       ├── 📄 dashboard.spec.ts        # Dashboard E2E
│       └── 📄 golioth-integration.spec.ts # Golioth E2E
│
├── 📁 docs/                            # Development documentation
│   ├── 📄 api.md                       # API documentation
│   ├── 📄 deployment.md                # Deployment guide
│   ├── 📄 testing.md                   # Testing guide
│   ├── 📄 database.md                  # Database schema docs
│   ├── 📄 golioth.md                   # Golioth integration guide
│   ├── 📄 security.md                  # Security guidelines
│   ├── 📄 performance.md               # Performance optimization
│   └── 📄 troubleshooting.md           # Common issues and solutions
│
└── 📁 scripts/                         # Development and build scripts
    ├── 📄 setup.sh                     # Initial project setup
    ├── 📄 migrate.sh                   # Database migration script
    ├── 📄 seed.sh                      # Database seeding script
    ├── 📄 deploy.sh                    # Deployment script
    ├── 📄 backup.sh                    # Database backup script
    ├── 📄 restore.sh                   # Database restore script
    ├── 📄 test.sh                      # Test runner script
    ├── 📄 build.sh                     # Build script
    ├── 📄 clean.sh                     # Cleanup script
    └── 📄 health-check.sh              # Health check script
```

## 📋 Naming Conventions

### 📁 File Naming Standards

| File Type | Convention | Examples |
|-----------|------------|----------|
| **React Components** | PascalCase | `DeviceCard.tsx`, `UserMenu.tsx` |
| **Pages (App Router)** | kebab-case | `page.tsx`, `layout.tsx`, `not-found.tsx` |
| **API Routes** | kebab-case | `route.ts` |
| **Utility Functions** | camelCase | `deviceUtils.ts`, `authHelpers.ts` |
| **Type Definitions** | PascalCase | `Device.types.ts`, `API.types.ts` |
| **Constants** | SCREAMING_SNAKE_CASE | `API_ENDPOINTS.ts`, `ERROR_CODES.ts` |
| **Hooks** | camelCase with use prefix | `useDevices.ts`, `useAuth.ts` |
| **Test Files** | Component/file name + .test | `DeviceCard.test.tsx`, `auth.test.ts` |
| **E2E Tests** | Feature name + .spec | `device-management.spec.ts` |

### 📂 Directory Naming Standards

| Directory Type | Convention | Examples |
|----------------|------------|----------|
| **App Router Groups** | Parentheses | `(auth)`, `(dashboard)` |
| **Dynamic Routes** | Square brackets | `[deviceId]`, `[userId]` |
| **API Endpoints** | kebab-case | `api/devices`, `api/golioth` |
| **Component Categories** | kebab-case | `ui`, `forms`, `charts` |
| **Service Modules** | kebab-case | `services`, `hooks` |

## 🏗️ Component Organization Principles

### 1. **Atomic Design Structure**

```
components/
├── ui/           # Atoms (basic elements)
├── forms/        # Molecules (form combinations)
├── devices/      # Organisms (complex components)
├── layout/       # Templates (page structures)
└── common/       # Shared across categories
```

### 2. **Feature-Based Grouping**

- Each major feature (devices, alerts, analytics) has its own component directory
- Components are grouped by functionality, not by type
- Shared components go in `common/` or `ui/`

### 3. **Import/Export Patterns**

```typescript
// Component exports
export { default } from './DeviceCard';
export type { DeviceCardProps } from './DeviceCard.types';

// Index file exports
export { DeviceCard } from './DeviceCard';
export { DeviceList } from './DeviceList';
export { DeviceForm } from './DeviceForm';
```

## 🔗 Import Resolution

### TypeScript Path Mapping

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/hooks/*": ["./src/lib/hooks/*"],
      "@/services/*": ["./src/lib/services/*"],
      "@/styles/*": ["./src/styles/*"],
      "@/utils/*": ["./src/lib/utils/*"]
    }
  }
}
```

### Import Examples

```typescript
// Component imports
import { DeviceCard } from '@/components/devices/DeviceCard';
import { Button } from '@/components/ui/button';

// Service imports
import { goliothService } from '@/lib/services/golioth';
import { supabase } from '@/lib/supabase';

// Hook imports
import { useDevices } from '@/hooks/useDevices';
import { useAuth } from '@/hooks/useAuth';

// Type imports
import type { Device } from '@/types/devices';
import type { ApiResponse } from '@/types/api';

// Utility imports
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date';
```

## 🗃️ Database Migration Organization

### Migration Naming Convention

```
YYYYMMDD[HHMMSS]_migration_description.sql

Examples:
20250918000001_initial_schema.sql
20250918120000_add_device_metadata.sql
20250918140000_golioth_integration_tables.sql
```

### Migration Categories

1. **Schema Changes**: Table structure modifications
2. **Data Changes**: Data transformation and seeding
3. **Index Changes**: Performance optimization
4. **Security Changes**: RLS policies and permissions

## 📊 Testing Organization

### Test File Structure

```
tests/
├── __mocks__/           # Shared mocks
├── components/          # Component tests (unit)
├── api/                 # API route tests (unit)
├── hooks/               # Hook tests (unit)
├── lib/                 # Utility tests (unit)
├── integration/         # Integration tests
└── e2e/                 # End-to-end tests
```

### Test Naming Patterns

```typescript
// Component tests
describe('DeviceCard', () => {
  it('should render device name', () => {});
  it('should display device status', () => {});
  it('should handle click events', () => {});
});

// API tests
describe('GET /api/devices', () => {
  it('should return device list', () => {});
  it('should handle pagination', () => {});
  it('should filter by status', () => {});
});

// Integration tests
describe('Device Management Flow', () => {
  it('should create and sync device', () => {});
  it('should handle sync conflicts', () => {});
});
```

## 🚀 Deployment Organization

### Environment-Specific Files

```
├── .env.example         # Template
├── .env                 # Local development
├── .env.staging         # Staging environment
├── .env.production      # Production environment
```

### Build Artifacts

```
├── .next/               # Next.js build cache
├── out/                 # Static export output
├── coverage/            # Test coverage reports
├── playwright-report/   # E2E test results
└── docs/build/          # Documentation build
```

## 📝 Documentation Organization

### Documentation Categories

1. **Technical Docs**: API, database, architecture
2. **User Guides**: Setup, deployment, troubleshooting
3. **Development Docs**: Contributing, standards, workflows
4. **API Documentation**: Endpoint specifications

### Documentation Standards

- Use Markdown format
- Include code examples
- Maintain table of contents
- Keep documentation up-to-date with code changes

## 🔧 Configuration File Organization

### Root-Level Configs

- `package.json` - Project dependencies and scripts
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - ESLint rules
- `.prettierrc` - Code formatting rules
- `jest.config.js` - Unit testing configuration
- `playwright.config.ts` - E2E testing configuration

### Supabase Configs

- `supabase/config.toml` - Supabase CLI configuration
- `supabase/migrations/` - Database schema versions
- `supabase/seed.sql` - Development data

### Docker Configs

- `Dockerfile` - Production container
- `Dockerfile.dev` - Development container
- `docker-compose.yml` - Local services orchestration

This project structure provides a **scalable, maintainable, and professional foundation** for the NetNeural IoT Platform development. Every file and directory has a clear purpose and follows industry best practices.