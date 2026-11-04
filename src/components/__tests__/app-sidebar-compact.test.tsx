import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebarCompact } from '../app-sidebar-compact';

const auth = vi.hoisted(() => ({ user: { role: 'user', tenantRole: 'manager', tenantId: 't1', planFeatures: {}, planName: 'Básico', permissions: null } }));
const route = vi.hoisted(() => ({ pathname: '/busy/products' }));
const sidebar = vi.hoisted(() => ({ state: 'expanded', setOpen: vi.fn(), isMobile: false }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));
vi.mock('../nav-user', () => ({ NavUser: () => <div>Usuario</div> }));
vi.mock('../ui/sidebar', () => ({
  Sidebar: ({ children }: React.PropsWithChildren) => <aside>{children}</aside>,
  SidebarHeader: ({ children }: React.PropsWithChildren) => <header>{children}</header>,
  SidebarContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  SidebarRail: () => null,
  useSidebar: () => sidebar,
}));

describe('AppSidebarCompact', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    sidebar.state = 'expanded'; sidebar.setOpen.mockClear(); route.pathname = '/busy/products';
  });

  it('keeps disabled plan modules out of search', () => {
    render(<AppSidebarCompact />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en el menú' }), { target: { value: 'Kardex' } });
    expect(screen.queryByRole('link', { name: 'Kardex' })).not.toBeInTheDocument();
  });

  it('does not render a persisted favorite for a module excluded by the plan', () => {
    localStorage.setItem('financemdm-sidebar-favorites:t1', JSON.stringify(['/busy/inventario/kardex']));
    render(<AppSidebarCompact />);
    expect(screen.queryByRole('navigation', { name: 'Favoritos' })).not.toBeInTheDocument();
  });

  it('opens a group from the icon rail so nested destinations remain reachable', () => {
    sidebar.state = 'collapsed';
    render(<AppSidebarCompact />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Acciones' }));
    expect(sidebar.setOpen).toHaveBeenCalledWith(true);
  });

  it('opens the active section and submenu on entry and navigation', () => {
    route.pathname = '/busy/gastosDE/conceptos';
    const { rerender } = render(<AppSidebarCompact />);
    expect(screen.getByRole('link', { name: 'Conceptos de Gastos' })).toHaveAttribute('aria-current', 'page');
    route.pathname = '/busy/configuracion/mi-empresa';
    rerender(<AppSidebarCompact />);
    expect(screen.getByRole('link', { name: 'Mi Empresa' })).toHaveAttribute('aria-current', 'page');
  });

  it('highlights the closest destination for nested routes', () => {
    route.pathname = '/busy/gastosDE/conceptos/nuevo';
    render(<AppSidebarCompact />);
    expect(screen.getByRole('link', { name: 'Conceptos de Gastos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Gastos DE' })).not.toHaveAttribute('aria-current');
  });

  it('shows the section title as a tooltip in the rail', () => {
    sidebar.state = 'collapsed';
    render(<AppSidebarCompact />);
    expect(screen.getByRole('button', { name: 'Abrir Acciones' })).toHaveAttribute('title', 'Acciones');
  });

  it('adds an available destination to favorites', () => {
    render(<AppSidebarCompact />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Productos a favoritos' }));
    expect(screen.getByRole('navigation', { name: 'Favoritos' })).toHaveTextContent('Productos');
  });

  it('allows long destination labels to wrap while keeping favorites available', () => {
    render(<AppSidebarCompact />);
    const link = screen.getByRole('link', { name: 'Puntos de Venta' });
    expect(link.querySelector('span')).toHaveClass('whitespace-normal');
    expect(link.querySelector('span')).not.toHaveClass('truncate');
    expect(screen.getByRole('button', { name: 'Añadir Puntos de Venta a favoritos' })).toBeVisible();
  });

  it('visually nests destinations beneath their section heading', () => {
    render(<AppSidebarCompact />);
    const section = screen.getByRole('navigation', { name: 'Gestión' });
    expect(section).toHaveClass('pl-3');
    expect(section).toContainElement(screen.getByRole('link', { name: 'Productos' }));
  });
});
