import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/admin/actions', () => ({
  updateUserAction: vi.fn(),
}));

import { EditUserDialog } from './edit-user-dialog';

describe('EditUserDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders for users without tenantRole using a non-empty select value', () => {
    render(
      <EditUserDialog
        open
        onClose={() => {}}
        user={{
          userId: 'user-1',
          name: 'Admin User',
          email: 'admin@test.local',
          password: '',
          role: 'admin',
          isActive: true,
          tenantRole: undefined,
          avatar: null,
          activatedAt: null,
          expiresAt: null,
          createdAt: '',
          updatedAt: '',
          lastModifiedBy: null,
          loginAttempts: 0,
          lockedUntil: null,
          lastFailedLogin: null,
        } as never}
      />,
    );

    expect(screen.getByText('Editar Usuario')).toBeInTheDocument();
    expect(screen.getAllByText('Sin cambio').length).toBeGreaterThan(0);
  });
});
