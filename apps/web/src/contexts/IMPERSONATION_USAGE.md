# Impersonation Context - Usage Guide

## Overview

The `ImpersonationContext` provides robust error handling and loading state management for impersonation operations. This guide shows how to use these features effectively.

## Features

### 1. Loading States
- Automatic loading state management during async operations
- Loading indicators during impersonation start/stop
- Prevents duplicate operations while loading

### 2. Error Handling
- Comprehensive error message extraction from API responses
- Graceful handling of network errors
- User-friendly error messages in Indonesian
- Automatic error clearing functionality

### 3. Error Display Options
- Toast notifications (automatic)
- Inline error display component
- Full-screen loading overlay

## Basic Usage

### Using the Hook

```typescript
import { useImpersonation } from '@/contexts/ImpersonationContext';

function MyComponent() {
  const {
    isImpersonating,
    loading,
    error,
    startImpersonation,
    stopImpersonation,
    clearError
  } = useImpersonation();

  // Your component logic
}
```

### Starting Impersonation with Error Handling

```typescript
const handleImpersonate = async (userId: string) => {
  try {
    await startImpersonation(userId, 'ADMIN_MANAGER');
    // Success - user will be redirected automatically
  } catch (error) {
    // Error is already captured in context state
    // Toast notification is shown automatically
    console.error('Impersonation failed:', error);
  }
};
```

### Stopping Impersonation with Error Handling

```typescript
const handleStopImpersonation = async () => {
  try {
    await stopImpersonation();
    // Success - user will be redirected automatically
  } catch (error) {
    // Error is already captured in context state
    // Toast notification is shown automatically
    console.error('Stop impersonation failed:', error);
  }
};
```

## Using Pre-built Components

### 1. ImpersonateButton

A ready-to-use button with built-in loading and error handling:

```typescript
import { ImpersonateButton } from '@/components/admin';

function AdminManagersList() {
  return (
    <table>
      <tbody>
        {managers.map(manager => (
          <tr key={manager.id}>
            <td>{manager.fullName}</td>
            <td>
              <ImpersonateButton
                userId={manager.id}
                userName={manager.fullName}
                targetRole="ADMIN_MANAGER"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 2. ImpersonationLoadingOverlay

Full-screen loading overlay for impersonation operations:

```typescript
import { ImpersonationLoadingOverlay } from '@/components/admin';

function Layout({ children }) {
  return (
    <>
      <ImpersonationLoadingOverlay />
      {children}
    </>
  );
}
```

### 3. ImpersonationErrorDisplay

Inline error display component:

```typescript
import { ImpersonationErrorDisplay } from '@/components/admin';

function AdminPage() {
  return (
    <div>
      <ImpersonationErrorDisplay />
      {/* Your page content */}
    </div>
  );
}
```

## Error Messages

The context provides user-friendly error messages for common scenarios:

| HTTP Status | Error Message |
|-------------|---------------|
| 403 | "Anda tidak memiliki izin untuk melakukan impersonation" |
| 404 | "User yang akan di-impersonate tidak ditemukan" |
| 400 | "Permintaan impersonation tidak valid" |
| 500+ | "Terjadi kesalahan server. Silakan coba lagi." |
| Network Error | "Tidak dapat terhubung ke server. Periksa koneksi internet Anda." |

## Loading State Patterns

### Pattern 1: Disable UI During Loading

```typescript
function ImpersonateButton({ userId, userName }) {
  const { startImpersonation, loading } = useImpersonation();

  return (
    <button
      onClick={() => startImpersonation(userId, 'ADMIN_MANAGER')}
      disabled={loading}
    >
      {loading ? 'Memproses...' : 'Masuk Sebagai'}
    </button>
  );
}
```

### Pattern 2: Show Loading Spinner

```typescript
function ImpersonateButton({ userId, userName }) {
  const { startImpersonation, loading } = useImpersonation();

  return (
    <button onClick={() => startImpersonation(userId, 'ADMIN_MANAGER')}>
      {loading && <Spinner />}
      {loading ? 'Memproses...' : 'Masuk Sebagai'}
    </button>
  );
}
```

### Pattern 3: Full-Screen Overlay

```typescript
function App() {
  return (
    <ImpersonationProvider>
      <ImpersonationLoadingOverlay />
      <YourApp />
    </ImpersonationProvider>
  );
}
```

## Error Handling Patterns

### Pattern 1: Toast Notifications (Automatic)

Errors are automatically shown as toast notifications. No additional code needed!

```typescript
// Error toast is shown automatically
await startImpersonation(userId, 'ADMIN_MANAGER');
```

### Pattern 2: Inline Error Display

```typescript
function AdminPage() {
  const { error, clearError } = useImpersonation();

  return (
    <div>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}
      {/* Your content */}
    </div>
  );
}
```

### Pattern 3: Custom Error Handling

```typescript
function CustomComponent() {
  const { startImpersonation, error } = useImpersonation();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleImpersonate = async (userId: string) => {
    try {
      await startImpersonation(userId, 'ADMIN_MANAGER');
    } catch (err) {
      // Custom error handling
      setLocalError('Custom error message');
      // Log to analytics, etc.
    }
  };

  return (
    <div>
      {localError && <CustomErrorDisplay message={localError} />}
      {/* Your UI */}
    </div>
  );
}
```

## Best Practices

### 1. Always Handle Errors

Even though errors are captured in context, always wrap impersonation calls in try-catch:

```typescript
// ✅ Good
try {
  await startImpersonation(userId, 'ADMIN_MANAGER');
} catch (error) {
  // Handle error or log it
}

// ❌ Bad
startImpersonation(userId, 'ADMIN_MANAGER'); // Unhandled promise
```

### 2. Disable UI During Loading

Prevent users from triggering multiple operations:

```typescript
// ✅ Good
<button disabled={loading} onClick={handleImpersonate}>
  {loading ? 'Memproses...' : 'Masuk Sebagai'}
</button>

// ❌ Bad
<button onClick={handleImpersonate}>
  Masuk Sebagai
</button>
```

### 3. Clear Errors When Appropriate

Clear errors when user takes action or navigates away:

```typescript
useEffect(() => {
  // Clear error when component unmounts
  return () => clearError();
}, [clearError]);
```

### 4. Provide User Feedback

Always show loading indicators and error messages:

```typescript
// ✅ Good - Shows loading and error states
function ImpersonateButton() {
  const { loading, error } = useImpersonation();
  
  return (
    <>
      {error && <ErrorMessage message={error} />}
      <button disabled={loading}>
        {loading ? <Spinner /> : 'Masuk Sebagai'}
      </button>
    </>
  );
}
```

## Testing

### Testing with Loading States

```typescript
import { renderHook, act } from '@testing-library/react';
import { useImpersonation } from '@/contexts/ImpersonationContext';

test('shows loading state during impersonation', async () => {
  const { result } = renderHook(() => useImpersonation());

  expect(result.current.loading).toBe(false);

  act(() => {
    result.current.startImpersonation('user-id', 'ADMIN_MANAGER');
  });

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
});
```

### Testing Error Handling

```typescript
test('captures and displays errors', async () => {
  // Mock API to return error
  mockApi.impersonateUser.mockRejectedValue({
    response: { status: 403 }
  });

  const { result } = renderHook(() => useImpersonation());

  await act(async () => {
    try {
      await result.current.startImpersonation('user-id', 'ADMIN_MANAGER');
    } catch (error) {
      // Expected to throw
    }
  });

  expect(result.current.error).toBe(
    'Anda tidak memiliki izin untuk melakukan impersonation'
  );
});
```

## Troubleshooting

### Error: "useImpersonation must be used within ImpersonationProvider"

**Solution:** Wrap your app with `ImpersonationProvider`:

```typescript
function App() {
  return (
    <ImpersonationProvider>
      <YourApp />
    </ImpersonationProvider>
  );
}
```

### Loading state stuck at true

**Solution:** Ensure API calls complete and don't throw unhandled errors:

```typescript
try {
  await startImpersonation(userId, 'ADMIN_MANAGER');
} catch (error) {
  // Handle error - loading will be set to false automatically
}
```

### Errors not clearing automatically

**Solution:** Use the `clearError()` function or wait for auto-clear timeout:

```typescript
const { error, clearError } = useImpersonation();

// Manual clear
useEffect(() => {
  if (error) {
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }
}, [error, clearError]);
```

## API Reference

### Context State

```typescript
interface ImpersonationState {
  isImpersonating: boolean;        // Whether currently impersonating
  originalUser: AuthUser | null;   // Original user before impersonation
  impersonatedUser: ImpersonatedUser | null; // Current impersonated user
  impersonationChain: ImpersonationChainItem[]; // Full impersonation chain
  loading: boolean;                // Loading state for async operations
  error: string | null;            // Current error message
}
```

### Context Methods

```typescript
interface ImpersonationContextType {
  // Start impersonating a user
  startImpersonation: (
    userId: string,
    targetRole: 'ADMIN_MANAGER' | 'ADMIN_CABANG'
  ) => Promise<void>;

  // Stop impersonation (go back one level)
  stopImpersonation: () => Promise<void>;

  // Clear current error
  clearError: () => void;
}
```

## Examples

See the following files for complete examples:
- `ImpersonateButton.tsx` - Button with loading and error handling
- `ImpersonationBanner.tsx` - Banner with error toast integration
- `ImpersonationLoadingOverlay.tsx` - Full-screen loading overlay
- `ImpersonationErrorDisplay.tsx` - Inline error display

## Support

For issues or questions, contact the development team or refer to the main documentation.
