import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloatingNavigationProvider, FloatingNavigationMenu, FloatingNavigationRail } from './floating-navigation';

const auth = vi.hoisted(() => ({ user: { role: 'user', tenantRole: 'manager', tenantId: 't1', planFeatures: {}, planName: 'Básico', permissions: null } }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
const route = vi.hoisted(() => ({ pathname: '/busy/products' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));

describe('navegación flotante', () => {
  it('cambia los destinos al elegir un grupo y respeta el plan', () => {
    render(<FloatingNavigationProvider><FloatingNavigationMenu /><FloatingNavigationRail /></FloatingNavigationProvider>);
    expect(screen.getByRole('link', { name: 'Productos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.queryByRole('link', { name: 'Productos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kardex' })).not.toBeInTheDocument();
  });
  it('retira la sección anterior de la navegación durante la transición', async () => {
    const { unmount } = render(<FloatingNavigationProvider><FloatingNavigationMenu /><FloatingNavigationRail /></FloatingNavigationProvider>);
    const rail = screen.getByRole('navigation', { name: 'Opciones de Gestión' });
    expect(rail.style.height).toContain('100dvh');
    expect(rail.firstElementChild).toHaveClass('[scrollbar-width:none]');
    expect(rail.firstElementChild).toHaveClass('overflow-y-auto');
    const initialHeight = rail.style.height;
    fireEvent.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getByRole('navigation', { name: 'Opciones de Acciones' })).toBe(rail);
    expect(rail.style.height).not.toBe(initialHeight);
    expect(screen.queryByRole('link', { name: 'Productos' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ventas' })).toBeInTheDocument());
    unmount();
  });
  it('solo resalta el destino más específico', () => {
    route.pathname = '/busy/contabilidad/cuentas';
    auth.user.role = 'admin';
    render(<FloatingNavigationProvider><FloatingNavigationMenu /><FloatingNavigationRail /></FloatingNavigationProvider>);
    expect(screen.getByRole('link', { name: 'Cuentas Bancarias' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    route.pathname = '/busy/products'; auth.user.role = 'user';
  });
  it('expone nombres en leyendas y submenús accesibles', () => {
    render(<FloatingNavigationProvider><FloatingNavigationMenu /><FloatingNavigationRail /></FloatingNavigationProvider>);
    expect(screen.getByRole('link', { name: 'Productos' })).toHaveAttribute('title', 'Productos');
    fireEvent.click(screen.getByRole('button', { name: 'Acciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar submenú de Gastos DE' }));
    expect(screen.getByRole('link', { name: 'Gastos DE' })).toBeInTheDocument();
  });
});
