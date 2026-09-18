import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}));


vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

const getExpiringSoonActionMock = vi.fn();
const lockUserActionMock = vi.fn();
const unlockUserActionMock = vi.fn();
const useAdminUsersMock = vi.fn();

vi.mock('@/features/admin/actions', () => ({
  getExpiringSoonAction: (...args: unknown[]) => getExpiringSoonActionMock(...args),
  lockUserAction: (...args: unknown[]) => lockUserActionMock(...args),
  unlockUserAction: (...args: unknown[]) => unlockUserActionMock(...args),
}));

vi.mock('@/features/admin/hooks/use-admin-users', () => ({
  useAdminUsers: () => useAdminUsersMock(),
}));

vi.mock('@/features/admin/components/activity-logs-tab', () => ({
  ActivityLogsTab: () => <div>logs tab</div>,
}));

vi.mock('@/features/admin/components/sessions-tab', () => ({
  SessionsTab: () => <div>sessions tab</div>,
}));

vi.mock('@/features/admin/components/cloudinary-cleanup-tab', () => ({
  CloudinaryCleanupTab: () => <div>cloudinary cleanup tab</div>,
}));

vi.mock('@/features/admin/components/blocked-users-tab', () => ({
  BlockedUsersTab: () => <div>blocked users tab</div>,
}));

vi.mock('@/features/admin/components/expiring-users-tab', () => ({
  ExpiringUsersTab: () => <div>expiring users tab</div>,
}));

vi.mock('@/features/admin/components/login-history-dialog', () => ({
  LoginHistoryDialog: () => null,
}));

import { UserMonitoringPanel } from './user-monitoring-panel';

describe('UserMonitoringPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminUsersMock.mockReturnValue({ users: [] });
    getExpiringSoonActionMock.mockResolvedValue({ success: true, data: [] });
    lockUserActionMock.mockResolvedValue({ success: true });
    unlockUserActionMock.mockResolvedValue({ success: true });
  });

  it('separa sesiones de cleanup de Cloudinary en tabs distintas', async () => {
    render(<UserMonitoringPanel />);

    await waitFor(() => {
      expect(getExpiringSoonActionMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sesiones' }));
    expect(screen.getByText('sessions tab')).toBeInTheDocument();
    expect(screen.queryByText('cloudinary cleanup tab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cloudinary' }));
    expect(screen.getByText('cloudinary cleanup tab')).toBeInTheDocument();
    expect(screen.queryByText('sessions tab')).not.toBeInTheDocument();
  });
});
