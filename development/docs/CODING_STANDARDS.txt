# NetNeural Development Standards & Guidelines

This document establishes **comprehensive coding standards, testing requirements, documentation guidelines, and review processes** that govern all development on the NetNeural IoT Platform.

## 📋 Table of Contents

1. [Code Quality Standards](#code-quality-standards)
2. [TypeScript Guidelines](#typescript-guidelines)
3. [React/Next.js Best Practices](#reactnextjs-best-practices)
4. [API Development Standards](#api-development-standards)
5. [Database Guidelines](#database-guidelines)
6. [Testing Requirements](#testing-requirements)
7. [Documentation Standards](#documentation-standards)
8. [Git Workflow & Review Process](#git-workflow--review-process)
9. [Security Guidelines](#security-guidelines)
10. [Performance Standards](#performance-standards)
11. [Error Handling](#error-handling)
12. [Monitoring & Logging](#monitoring--logging)

---

## 🎯 Code Quality Standards

### General Principles

1. **Clarity over Cleverness**: Write code that is easy to understand
2. **Consistency**: Follow established patterns throughout the codebase
3. **Maintainability**: Code should be easy to modify and extend
4. **Performance**: Write efficient code, but not at the expense of clarity
5. **Security**: Security considerations must be built-in, not bolted-on

### Code Formatting

**Tools Required:**
- **Prettier** for code formatting
- **ESLint** for code linting
- **TypeScript** for type checking

**Configuration:**

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "no-console": "warn",
    "curly": "error"
  }
}
```

---

## 🔧 TypeScript Guidelines

### Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false
  }
}
```

### Type Definitions

#### 1. Interface vs Type Aliases

```typescript
// ✅ Good - Use interfaces for object shapes
interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  metadata?: Record<string, unknown>;
}

// ✅ Good - Use type aliases for unions, primitives, computed types
type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'error';
type DeviceId = string;
type DeviceUpdate = Partial<Pick<Device, 'name' | 'status' | 'metadata'>>;
```

#### 2. Generic Types

```typescript
// ✅ Good - Generic API response type
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationInfo;
}

// ✅ Good - Generic hook return type
interface UseResourceReturn<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

#### 3. Utility Types

```typescript
// ✅ Good - Use utility types appropriately
type CreateDeviceRequest = Omit<Device, 'id' | 'createdAt' | 'updatedAt'>;
type DeviceFilters = Partial<Pick<Device, 'status' | 'deviceType'>>;
type RequiredDeviceFields = Required<Pick<Device, 'name' | 'deviceId'>>;
```

### Banned Patterns

```typescript
// ❌ Forbidden - Never use 'any'
function processData(data: any): any {
  return data;
}

// ✅ Good - Use generics or specific types
function processData<T>(data: T): T {
  return data;
}

// ❌ Forbidden - Non-null assertion without good reason
const device = devices.find(d => d.id === id)!;

// ✅ Good - Proper null checking
const device = devices.find(d => d.id === id);
if (!device) {
  throw new Error(`Device with id ${id} not found`);
}
```

---

## ⚛️ React/Next.js Best Practices

### Component Structure

```typescript
// ✅ Good - Component template
import React from 'react';
import { cn } from '@/lib/utils';
import type { Device } from '@/types/devices';

interface DeviceCardProps {
  device: Device;
  onEdit?: (device: Device) => void;
  onDelete?: (deviceId: string) => void;
  className?: string;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onEdit,
  onDelete,
  className,
}) => {
  const handleEdit = React.useCallback(() => {
    onEdit?.(device);
  }, [device, onEdit]);

  const handleDelete = React.useCallback(() => {
    onDelete?.(device.id);
  }, [device.id, onDelete]);

  return (
    <div className={cn('device-card', className)}>
      <h3>{device.name}</h3>
      <p>Status: {device.status}</p>
      <div className="actions">
        {onEdit && (
          <button type="button" onClick={handleEdit}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

DeviceCard.displayName = 'DeviceCard';

export default DeviceCard;
```

### Hooks Guidelines

```typescript
// ✅ Good - Custom hook structure
export function useDevices(organizationId: string) {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchDevices = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.devices.list({ organizationId });
      setDevices(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
  };
}
```

### State Management

```typescript
// ✅ Good - Use Zustand for global state
interface DeviceStore {
  devices: Device[];
  selectedDevice: Device | null;
  setDevices: (devices: Device[]) => void;
  selectDevice: (device: Device | null) => void;
  updateDevice: (deviceId: string, updates: Partial<Device>) => void;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  selectedDevice: null,
  setDevices: (devices) => set({ devices }),
  selectDevice: (device) => set({ selectedDevice: device }),
  updateDevice: (deviceId, updates) =>
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === deviceId ? { ...device, ...updates } : device
      ),
    })),
}));
```

### Performance Optimizations

```typescript
// ✅ Good - Memoization patterns
const DeviceList = React.memo<DeviceListProps>(({ devices, onSelectDevice }) => {
  const sortedDevices = React.useMemo(
    () => devices.sort((a, b) => a.name.localeCompare(b.name)),
    [devices]
  );

  const handleSelectDevice = React.useCallback(
    (device: Device) => {
      onSelectDevice(device);
    },
    [onSelectDevice]
  );

  return (
    <div>
      {sortedDevices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          onSelect={handleSelectDevice}
        />
      ))}
    </div>
  );
});
```

---

## 🌐 API Development Standards

### Route Structure

```typescript
// ✅ Good - API route structure
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth';
import { validateRequest } from '@/lib/validations';
import { DeviceService } from '@/lib/services/device';
import { handleApiError } from '@/lib/errors';

// Request validation schema
const CreateDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  deviceId: z.string().min(1).max(100),
  deviceType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validation
    const body = await request.json();
    const validatedData = await validateRequest(CreateDeviceSchema, body);

    // Business logic
    const deviceService = new DeviceService(user.organizationId);
    const device = await deviceService.create(validatedData);

    // Response
    return NextResponse.json({
      success: true,
      data: device,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '10', 10);
    const status = searchParams.get('status') as DeviceStatus | null;

    const deviceService = new DeviceService(user.organizationId);
    const result = await deviceService.list({ page, limit, status });

    return NextResponse.json({
      success: true,
      data: result.devices,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Error Handling

```typescript
// ✅ Good - Centralized error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
    },
    { status: 500 }
  );
}
```

---

## 🗄️ Database Guidelines

### Migration Standards

```sql
-- ✅ Good - Migration template
-- Migration: 20250918000001_add_device_metadata.sql
-- Description: Add metadata column to devices table for custom properties

BEGIN;

-- Add metadata column
ALTER TABLE devices 
ADD COLUMN metadata JSONB DEFAULT '{}' NOT NULL;

-- Add index for metadata queries
CREATE INDEX idx_devices_metadata_gin ON devices USING GIN (metadata);

-- Add constraint for metadata structure validation
ALTER TABLE devices 
ADD CONSTRAINT devices_metadata_check 
CHECK (jsonb_typeof(metadata) = 'object');

-- Update existing rows
UPDATE devices SET metadata = '{}' WHERE metadata IS NULL;

COMMIT;
```

### Query Patterns

```typescript
// ✅ Good - Database service pattern
export class DeviceRepository {
  constructor(private db: SupabaseClient) {}

  async findById(id: string, organizationId: string): Promise<Device | null> {
    const { data, error } = await this.db
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch device: ${error.message}`);
    }

    return data;
  }

  async list(params: {
    organizationId: string;
    page: number;
    limit: number;
    status?: DeviceStatus;
  }): Promise<{ devices: Device[]; total: number }> {
    let query = this.db
      .from('devices')
      .select('*', { count: 'exact' })
      .eq('organization_id', params.organizationId);

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error, count } = await query
      .range(
        (params.page - 1) * params.limit,
        params.page * params.limit - 1
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch devices: ${error.message}`);
    }

    return {
      devices: data ?? [],
      total: count ?? 0,
    };
  }
}
```

---

## 🧪 Testing Requirements

### Test Coverage Requirements

**Minimum Coverage Thresholds:**
- **Overall**: 80%
- **Critical Paths**: 90%
- **API Routes**: 85%
- **Business Logic**: 90%

### Unit Testing Standards

```typescript
// ✅ Good - Component test structure
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeviceCard } from '@/components/devices/DeviceCard';
import type { Device } from '@/types/devices';

const mockDevice: Device = {
  id: '123',
  name: 'Test Device',
  deviceId: 'test-device-001',
  status: 'active',
  organizationId: 'org-123',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('DeviceCard', () => {
  it('should render device information', () => {
    render(<DeviceCard device={mockDevice} />);
    
    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.getByText('Status: active')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', async () => {
    const onEdit = jest.fn();
    render(<DeviceCard device={mockDevice} onEdit={onEdit} />);
    
    fireEvent.click(screen.getByText('Edit'));
    
    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(mockDevice);
    });
  });

  it('should not render edit button when onEdit is not provided', () => {
    render(<DeviceCard device={mockDevice} />);
    
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
```

### API Testing Standards

```typescript
// ✅ Good - API route test
import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/devices/route';

jest.mock('@/lib/auth', () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock('@/lib/services/device', () => ({
  DeviceService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));

describe('/api/devices POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create device successfully', async () => {
    const mockUser = { id: '123', organizationId: 'org-123' };
    const mockDevice = { id: '456', name: 'Test Device' };

    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser);
    (DeviceService.prototype.create as jest.Mock).mockResolvedValue(mockDevice);

    const { req } = createMocks({
      method: 'POST',
      body: {
        name: 'Test Device',
        deviceId: 'test-001',
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockDevice);
  });

  it('should return 401 for unauthenticated requests', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(null);

    const { req } = createMocks({
      method: 'POST',
      body: { name: 'Test Device' },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});
```

### E2E Testing Standards

```typescript
// ✅ Good - E2E test structure
import { test, expect } from '@playwright/test';

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login user
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create new device', async ({ page }) => {
    // Navigate to devices
    await page.click('[data-testid=nav-devices]');
    await expect(page).toHaveURL('/dashboard/devices');

    // Click create device
    await page.click('[data-testid=create-device-button]');
    await expect(page).toHaveURL('/dashboard/devices/new');

    // Fill form
    await page.fill('[data-testid=device-name]', 'Test Device');
    await page.fill('[data-testid=device-id]', 'test-device-001');
    await page.selectOption('[data-testid=device-type]', 'sensor');

    // Submit form
    await page.click('[data-testid=submit-button]');

    // Verify creation
    await expect(page).toHaveURL('/dashboard/devices');
    await expect(page.locator('[data-testid=device-card]')).toContainText('Test Device');
  });

  test('should sync device with Golioth', async ({ page }) => {
    // Implement sync test
  });
});
```

---

## 📚 Documentation Standards

### Documentation Organization

**Project Root Documentation:**
- `README.md` - Development setup and quick start
- `TECHNICAL_SPECIFICATION.md` - Master technical specification
- `CODING_STANDARDS.md` - Development standards (this document)
- `PROJECT_STRUCTURE.md` - Folder structure and organization

**Technical Documentation (`docs/` directory):**
- `docs/api.md` - API endpoint documentation
- `docs/deployment.md` - Deployment procedures
- `docs/testing.md` - Testing strategies and guides
- `docs/database.md` - Database schema and migration guides
- `docs/golioth.md` - Golioth integration specifics
- `docs/security.md` - Security guidelines and best practices
- `docs/performance.md` - Performance optimization guides
- `docs/troubleshooting.md` - Common issues and solutions
- `docs/architecture.md` - System architecture details
- `docs/contributing.md` - Contributing guidelines
- `docs/changelog.md` - Version history and changes
- `docs/faq.md` - Frequently asked questions

### Documentation Standards

- **Format**: Use Markdown (.md) for all documentation
- **Location**: Store technical docs in `development/docs/` directory
- **Structure**: Include table of contents for documents >500 lines
- **Code Examples**: Provide working code examples where applicable
- **Updates**: Keep documentation synchronized with code changes
- **Links**: Use relative links for internal documentation references
- **Images**: Store images in `docs/images/` subdirectory

### Code Documentation

```typescript
/**
 * Manages device synchronization with Golioth IoT platform
 * 
 * @example
 * ```typescript
 * const service = new GoliothService(apiKey, projectId);
 * const devices = await service.syncDevices(localDevices);
 * ```
 */
export class GoliothService {
  /**
   * Creates a new GoliothService instance
   * 
   * @param apiKey - Golioth API key for authentication
   * @param projectId - Golioth project identifier
   * @param baseUrl - Base URL for Golioth API (defaults to production)
   */
  constructor(
    private readonly apiKey: string,
    private readonly projectId: string,
    private readonly baseUrl: string = 'https://api.golioth.io'
  ) {}

  /**
   * Synchronizes local devices with Golioth platform
   * 
   * @param devices - Array of local devices to sync
   * @returns Promise resolving to sync results
   * @throws {GoliothApiError} When API request fails
   * @throws {ValidationError} When device data is invalid
   * 
   * @example
   * ```typescript
   * const results = await service.syncDevices([
   *   { id: '123', name: 'Sensor 1', deviceId: 'sensor-001' }
   * ]);
   * 
   * console.log(`Synced ${results.successful} devices`);
   * ```
   */
  async syncDevices(devices: Device[]): Promise<SyncResult> {
    // Implementation
  }
}
```

### API Documentation

```typescript
/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: List devices
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of devices per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance, error]
 *         description: Filter devices by status
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
```

---

## 🔄 Git Workflow & Review Process

### Branch Naming

```bash
# Feature branches
feature/DEV-123-add-device-sync
feature/DEV-456-golioth-integration

# Bug fix branches  
bugfix/DEV-789-fix-auth-token-refresh
bugfix/DEV-101-device-list-pagination

# Hotfix branches
hotfix/DEV-999-critical-security-patch

# Chore branches
chore/DEV-555-update-dependencies
chore/DEV-666-improve-test-coverage
```

### Commit Message Format

```bash
# Format: type(scope): description
# 
# Types: feat, fix, docs, style, refactor, test, chore
# Scope: component, api, auth, devices, golioth, etc.

# Examples:
feat(devices): add Golioth sync integration
fix(auth): resolve token refresh race condition
docs(api): update device endpoint documentation
test(components): add DeviceCard unit tests
refactor(hooks): improve useDevices performance
chore(deps): update Next.js to v14.1.0
```

### Pull Request Requirements

**Required Checks:**
- ✅ All tests passing
- ✅ Code coverage meets thresholds
- ✅ TypeScript compilation successful
- ✅ ESLint checks passing
- ✅ Prettier formatting applied
- ✅ No security vulnerabilities
- ✅ Documentation updated

**PR Template:**

```markdown
## 📋 Summary
Brief description of changes

## 🔗 Related Issues
- Closes #123
- Related to #456

## 🧪 Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## 📊 Performance Impact
- No performance impact / Performance improved / Performance impact analyzed

## 🔒 Security Considerations
- No security impact / Security review completed / Security measures added

## 📝 Documentation
- [ ] Code comments added
- [ ] API documentation updated
- [ ] README updated
- [ ] Technical documentation updated

## 🖼️ Screenshots
(If applicable)

## ✅ Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
```

### Code Review Guidelines

**Reviewer Responsibilities:**
1. **Functionality**: Does the code work as intended?
2. **Readability**: Is the code easy to understand?
3. **Performance**: Are there performance implications?
4. **Security**: Are there security concerns?
5. **Testing**: Is there adequate test coverage?
6. **Documentation**: Is the code properly documented?

**Review Checklist:**
- [ ] Logic is correct and handles edge cases
- [ ] Error handling is comprehensive
- [ ] TypeScript types are accurate
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Tests cover critical paths
- [ ] Documentation is clear and complete

---

## 🔒 Security Guidelines

### Authentication & Authorization

```typescript
// ✅ Good - Secure authentication check
export async function authenticateRequest(request: NextRequest): Promise<User | null> {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return null;
    }

    const payload = await verifyJwtToken(token);
    const user = await getUserById(payload.sub);
    
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Authentication failed:', error);
    return null;
  }
}

// ✅ Good - Authorization check
export function requireRole(allowedRoles: UserRole[]) {
  return (user: User) => {
    if (!allowedRoles.includes(user.role)) {
      throw new ApiError('Insufficient permissions', 403, 'FORBIDDEN');
    }
  };
}
```

### Data Validation

```typescript
// ✅ Good - Input validation with Zod
const DeviceSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  deviceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
  deviceType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict(); // Reject unknown properties

export async function validateDeviceInput(input: unknown): Promise<Device> {
  try {
    return await DeviceSchema.parseAsync(input);
  } catch (error) {
    throw new ApiError('Invalid device data', 400, 'VALIDATION_ERROR');
  }
}
```

### Data Encryption

```typescript
// ✅ Good - Sensitive data encryption
import { encrypt, decrypt } from '@/lib/crypto';

export class DeviceService {
  async createWithCredentials(deviceData: CreateDeviceRequest, credentials: IoTCredentials) {
    // Encrypt sensitive credentials before storing
    const encryptedCredentials = await encrypt(JSON.stringify(credentials));
    
    const device = await this.repository.create({
      ...deviceData,
      credentials: encryptedCredentials,
    });

    return device;
  }

  async getCredentials(deviceId: string): Promise<IoTCredentials> {
    const device = await this.repository.findById(deviceId);
    if (!device?.credentials) {
      throw new Error('Device credentials not found');
    }

    const decryptedData = await decrypt(device.credentials);
    return JSON.parse(decryptedData);
  }
}
```

---

## ⚡ Performance Standards

### Frontend Performance

**Core Web Vitals Targets:**
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

**Optimization Techniques:**

```typescript
// ✅ Good - Lazy loading with Suspense
const DeviceAnalytics = React.lazy(() => import('@/components/devices/DeviceAnalytics'));

function DeviceDashboard() {
  return (
    <div>
      <DeviceList />
      <React.Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <DeviceAnalytics />
      </React.Suspense>
    </div>
  );
}

// ✅ Good - Image optimization
import Image from 'next/image';

function DeviceImage({ device }: { device: Device }) {
  return (
    <Image
      src={device.imageUrl}
      alt={device.name}
      width={200}
      height={150}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}
```

### API Performance

```typescript
// ✅ Good - Database query optimization
export class DeviceRepository {
  async findWithRelations(organizationId: string) {
    // Use select to limit fields
    const { data, error } = await this.db
      .from('devices')
      .select(`
        id,
        name,
        status,
        device_services:device_service_assignments(
          service:device_services(name, service_type)
        )
      `)
      .eq('organization_id', organizationId)
      .limit(100); // Always limit results

    if (error) throw error;
    return data;
  }
}

// ✅ Good - Response caching
export async function GET(request: NextRequest) {
  const cacheKey = `devices:${organizationId}:${searchParams.toString()}`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  }

  const devices = await deviceService.list(params);
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(devices));
  
  return NextResponse.json(devices);
}
```

---

## 🚨 Error Handling

### Error Classification

```typescript
// ✅ Good - Error hierarchy
export abstract class NetNeuralError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends NetNeuralError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class AuthenticationError extends NetNeuralError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
}

export class AuthorizationError extends NetNeuralError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';
}

export class NotFoundError extends NetNeuralError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class GoliothApiError extends NetNeuralError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_API_ERROR';
}
```

### Error Boundaries

```typescript
// ✅ Good - React error boundary
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error }> }>,
  { hasError: boolean; error?: Error }
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
    
    // Report to monitoring service
    if (process.env.NODE_ENV === 'production') {
      reportError(error, { errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}
```

---

## 📊 Monitoring & Logging

### Logging Standards

```typescript
// ✅ Good - Structured logging
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'production' && {
    redact: ['password', 'token', 'apiKey']
  })
});

export function logDeviceSync(result: SyncResult) {
  logger.info({
    event: 'device_sync_completed',
    organizationId: result.organizationId,
    totalDevices: result.total,
    successful: result.successful,
    failed: result.failed,
    duration: result.durationMs,
  }, 'Device sync completed');
}

export function logApiRequest(req: NextRequest, res: NextResponse, duration: number) {
  logger.info({
    event: 'api_request',
    method: req.method,
    url: req.url,
    status: res.status,
    duration,
    userAgent: req.headers.get('user-agent'),
  }, 'API request processed');
}
```

### Performance Monitoring

```typescript
// ✅ Good - Performance tracking
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  operation: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const start = performance.now();
    
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      // Log performance metric
      logger.debug({
        event: 'performance_metric',
        operation,
        duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      logger.error({
        event: 'performance_metric',
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }) as T;
}

// Usage
const monitoredDeviceSync = withPerformanceMonitoring(
  deviceService.syncWithGolioth.bind(deviceService),
  'device_golioth_sync'
);
```

---

## 🎯 Code Review Enforcement

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ],
    "*.{md,json}": [
      "prettier --write"
    ]
  }
}
```

### Quality Gates

**Automated Checks:**
- ✅ TypeScript compilation
- ✅ ESLint passing
- ✅ Prettier formatting
- ✅ Jest tests passing (80%+ coverage)
- ✅ Playwright E2E tests passing
- ✅ Security vulnerability scan
- ✅ Bundle size analysis

**Manual Review Required:**
- Architecture decisions
- Security-sensitive changes
- Performance-critical code
- Public API changes
- Database schema changes

---

## 📋 Conclusion

These standards ensure:

1. **Consistency** across the entire codebase
2. **Quality** through automated checks and manual review
3. **Security** through built-in best practices
4. **Performance** through optimization guidelines
5. **Maintainability** through clear documentation and structure
6. **Reliability** through comprehensive testing

**All team members must:**
- Follow these standards without exception
- Keep standards updated as the project evolves
- Suggest improvements through the standard PR process
- Mentor new team members on these practices

**Remember**: These standards are living documents that should evolve with the project and industry best practices.