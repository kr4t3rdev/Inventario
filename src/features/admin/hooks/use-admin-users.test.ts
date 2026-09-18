import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminUsers } from './use-admin-users';

const mockGetUsers = vi.fn();

vi.mock('@/features/admin/actions', () => ({
  getUsersAction: (...args: unknown[]) => mockGetUsers(...args),
}));

describe('useAdminUsers', () => {
  it('fetches users when enabled (default)', async () => {
    mockGetUsers.mockResolvedValue({ success: true, data: [{ userId: 'u1' }] });

    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.users).toEqual([{ userId: 'u1' }]);
    expect(mockGetUsers).toHaveBeenCalledTimes(1);
  });

  it('does NOT fetch users when disabled', async () => {
    mockGetUsers.mockClear();

    const { result } = renderHook(() => useAdminUsers({ enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  it('returns stable empty users[] and false loading when disabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAdminUsers({ enabled }),
      { initialProps: { enabled: false } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const usersRef = result.current.users;
    const loadingRef = result.current.isLoading;

    // Re-render with same disabled value — should return same references
    rerender({ enabled: false });

    expect(result.current.users).toBe(usersRef);
    expect(result.current.isLoading).toBe(loadingRef);
  });

  it('refetch is a no-op when disabled', async () => {
    mockGetUsers.mockClear();

    const { result } = renderHook(() => useAdminUsers({ enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.refetch();
    await vi.dynamicImportSettled();

    expect(mockGetUsers).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('allows refetch when enabled flips from false to true', async () => {
    // Track call count — each call returns a fresh user
    let callCount = 0;
    mockGetUsers.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        success: true,
        data: [{ userId: `u${callCount}` }],
      });
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useAdminUsers({ enabled }),
      { initialProps: { enabled: false } },
    );

    // Wait for disabled steady state
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGetUsers).not.toHaveBeenCalled();

    // Enable hook
    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.users).toEqual([{ userId: 'u1' }]);
    });
    expect(mockGetUsers).toHaveBeenCalledTimes(1);

    // refetch still works
    result.current.refetch();
    await waitFor(() => {
      expect(result.current.users).toEqual([{ userId: 'u2' }]);
    });
    expect(mockGetUsers).toHaveBeenCalledTimes(2);
  });
});
