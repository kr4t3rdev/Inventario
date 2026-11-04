import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { name: 'Ana Pérez', email: 'ana@example.test', tenantRole: 'manager' }, logout: vi.fn() }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/busy/dashboard' }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/features/admin/hooks/use-admin-users', () => ({ useAdminUsers: () => ({ users: [] }) }));
vi.mock('@/components/tenant-switcher', () => ({ TenantSwitcher: () => null }));
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false }),
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarMenuButton: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...props}>{children}</button>,
}));

import { NavUser } from './nav-user';

describe('menú de cuenta en el encabezado', () => {
  it('muestra únicamente las iniciales del nombre y abre las opciones de usuario', async () => {
    render(<NavUser compact />);
    expect(screen.getByRole('button', { name: /menú de usuario/i })).toHaveTextContent('AP');
    expect(screen.queryByText('ana@example.test')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: /menú de usuario/i }), { key: 'Enter' });
    expect(await screen.findByText('Cerrar Sesión')).toBeInTheDocument();
    expect(screen.queryByText('ana@example.test')).not.toBeInTheDocument();
  });
});
