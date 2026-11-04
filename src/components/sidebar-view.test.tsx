import React from 'react';
import { renderToString } from 'react-dom/server';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./app-sidebar2', () => ({ AppSidebar2: () => <aside>Vista clásica</aside> }));
vi.mock('./floating-navigation', () => ({ FloatingNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, FloatingNavigationRail: () => <aside>Vista flotante</aside>, FloatingNavigationMenu: () => <nav>Menú flotante</nav> }));
vi.mock('./app-sidebar-compact', () => ({ AppSidebarCompact: () => <aside>Vista compacta</aside> }));

import { SidebarViewProvider, SidebarViewSelection, SidebarViewToggle } from './sidebar-view';

function Fixture() {
  return <SidebarViewProvider><SidebarViewSelection /><SidebarViewToggle /></SidebarViewProvider>;
}

describe('preferencia de vista de navegación', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });
  afterEach(cleanup);

  it('no muestra una vista equivocada antes de recuperar la preferencia del navegador', () => {
    window.localStorage.setItem('financemdm-sidebar-view', 'compact');
    const html = renderToString(<Fixture />);
    expect(html).not.toContain('Vista clásica');
    expect(html).not.toContain('Vista compacta');
  });

  it('alterna ambas vistas y conserva la preferencia al volver a montar', async () => {
    const rendered = render(<Fixture />);
    expect(screen.getByRole('complementary')).toHaveTextContent('Vista clásica');
    fireEvent.change(screen.getByRole('combobox', { name: 'Vista de navegación' }), { target: { value: 'compact' } });
    expect(screen.getByRole('complementary')).toHaveTextContent('Vista compacta');
    rendered.unmount();
    render(<Fixture />);
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent('Vista compacta'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Vista de navegación' }), { target: { value: 'classic' } });
    expect(screen.getByRole('complementary')).toHaveTextContent('Vista clásica');
  });

  it('recupera la vista flotante guardada', async () => {
    window.localStorage.setItem('financemdm-sidebar-view', 'floating');
    render(<Fixture />);
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent('Vista flotante'));
  });

  it('usa la vista clásica si la preferencia almacenada no es válida', async () => {
    window.localStorage.setItem('financemdm-sidebar-view', 'desconocida');
    render(<Fixture />);
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent('Vista clásica'));
  });
});

it('permite contraer y expandir la navegación desde el encabezado en ambas vistas', async () => {
  const { SidebarViewShell, SidebarViewCollapse } = await import('./sidebar-view');
  const { useSidebar } = await import('./ui/sidebar');
  function CurrentState() {
    const { state } = useSidebar();
    return <span data-testid="sidebar-state">{state}</span>;
  }
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  render(<SidebarViewProvider><SidebarViewShell><SidebarViewCollapse /><SidebarViewToggle /><CurrentState /></SidebarViewShell></SidebarViewProvider>);
  expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');
  fireEvent.click(screen.getByRole('button', { name: 'Contraer barra lateral' }));
  expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
  fireEvent.change(screen.getByRole('combobox', { name: 'Vista de navegación' }), { target: { value: 'compact' } });
  fireEvent.click(screen.getByRole('button', { name: 'Expandir barra lateral' }));
  expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');
});
