/**
 * @description Tests de responsive design para el Dashboard de Inteligencia Cambiaria
 * Verifica que los componentes se adapten correctamente a diferentes tamaños de pantalla
 */
import React from 'react';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwipeableTabs } from '@/components/ui/swipeable-tabs';
import { BottomSheet } from '@/components/ui/bottom-sheet';

// Mock de window.matchMedia
const setup_match_media = (width: number): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((_query: string) => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 800,
  });
};

// Tests del hook use_breakpoints
describe('use_breakpoints hook', () => {
  beforeEach(() => {
    vi.resetModules();
    setup_match_media(1024);
  });

  it('debería retornar estado inicial correcto', async () => {
    const { use_breakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_breakpoints());

    expect(result.result.current.windowWidth).toBe(1024);
    expect(result.result.current.isDesktop).toBe(true);
    expect(result.result.current.isTablet).toBe(false);
    expect(result.result.current.isMobile).toBe(false);
  });

  it('debería detectar breakpoint móvil correctamente', async () => {
    setup_match_media(480);
    const { use_breakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_breakpoints());

    expect(result.result.current.isMobile).toBe(true);
    expect(result.result.current.isTablet).toBe(false);
    expect(result.result.current.isDesktop).toBe(false);
  });

  it('debería detectar breakpoint tablet correctamente', async () => {
    setup_match_media(800);
    const { use_breakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_breakpoints());

    expect(result.result.current.isMobile).toBe(false);
    expect(result.result.current.isTablet).toBe(true);
    expect(result.result.current.isDesktop).toBe(false);
  });
});

// Tests del componente SwipeableTabs
describe('SwipeableTabs', () => {
  const tabs = [
    { value: 'tab1', label: 'Tab 1', icon: <span>Icon1</span> },
    { value: 'tab2', label: 'Tab 2', icon: <span>Icon2</span> },
    { value: 'tab3', label: 'Tab 3', icon: <span>Icon3</span> },
  ];

  it('debería renderizar todos los tabs', () => {
    render(<SwipeableTabs tabs={tabs} />);

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('debería cambiar el tab activo al hacer click', async () => {
    const onValueChange = vi.fn();
    render(<SwipeableTabs tabs={tabs} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByText('Tab 2'));

    expect(onValueChange).toHaveBeenCalledWith('tab2');
  });

  it('debería deshabilitar tabs marcados como disabled', async () => {
    const disabledTabs = [
      ...tabs,
      { value: 'tab4', label: 'Tab 4', disabled: true },
    ];
    render(<SwipeableTabs tabs={disabledTabs} />);

    const tab4 = screen.getByText('Tab 4');
    expect(tab4).toBeDisabled();
  });

  it('debería aplicar clase active al tab seleccionado', () => {
    render(<SwipeableTabs tabs={tabs} defaultValue="tab2" />);

    const tab2 = screen.getByText('Tab 2').closest('button');
    expect(tab2).toHaveClass('bg-primary');
  });
});

// Tests del componente BottomSheet
describe('BottomSheet', () => {
  it('debería renderizar cuando está abierto', () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="Test Sheet">
        <div>Contenido del BottomSheet</div>
      </BottomSheet>
    );

    expect(screen.getByText('Test Sheet')).toBeInTheDocument();
    expect(screen.getByText('Contenido del BottomSheet')).toBeInTheDocument();
  });

  it('debería no renderizar cuando está cerrado', () => {
    render(
      <BottomSheet isOpen={false} onClose={vi.fn()} title="Test Sheet">
        <div>Contenido</div>
      </BottomSheet>
    );

    expect(screen.queryByText('Test Sheet')).not.toBeInTheDocument();
  });

  it('debería llamar onClose al hacer click en cerrar', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose} title="Test Sheet">
        <div>Contenido</div>
      </BottomSheet>
    );

    const closeButton = screen.getByLabelText('Cerrar');
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});

// Tests del hook use_responsive_columns
describe('use_responsive_columns', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('debería retornar 1 columna para móvil pequeño', async () => {
    setup_match_media(480);
    const { use_responsive_columns } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_responsive_columns());

    expect(result.result.current).toBe(1);
  });

  it('debería retornar 2 columnas para tablet', async () => {
    setup_match_media(800);
    const { use_responsive_columns } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_responsive_columns());

    expect(result.result.current).toBe(2);
  });

  it('debería retornar 3 columnas para desktop grande', async () => {
    setup_match_media(1300);
    const { use_responsive_columns } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_responsive_columns());

    expect(result.result.current).toBe(3);
  });
});

// Tests del hook use_simplified_view
describe('use_simplified_view', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('debería retornar true en móvil cuando está habilitado', async () => {
    setup_match_media(375);
    const { use_simplified_view } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_simplified_view(true, false));

    expect(result.result.current).toBe(true);
  });

  it('debería retornar false en desktop', async () => {
    setup_match_media(1440);
    const { use_simplified_view } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_simplified_view(true, false));

    expect(result.result.current).toBe(false);
  });
});

// Tests de renderizado responsivo del layout
describe('Responsive layout rendering', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('debería detectar diferentes tamaños de pantalla correctamente', () => {
    // Verificar que la función setup_match_media funciona
    setup_match_media(375);
    expect(window.innerWidth).toBe(375);

    setup_match_media(800);
    expect(window.innerWidth).toBe(800);

    setup_match_media(1440);
    expect(window.innerWidth).toBe(1440);
  });
});

// Tests de accesibilidad para responsive
describe('Responsive accessibility', () => {
  it('debería tener atributos ARIA correctos en SwipeableTabs', () => {
    const tabs = [
      { value: 'tab1', label: 'Tab 1' },
      { value: 'tab2', label: 'Tab 2' },
    ];

    render(<SwipeableTabs tabs={tabs} defaultValue="tab1" />);

    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabButtons[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('debería tener role dialog en BottomSheet', () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="Test">
        <div>Content</div>
      </BottomSheet>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-label', 'Test');
  });
});

// Tests de performance para responsive
describe('Responsive performance', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('debería actualizar breakpoints en resize', async () => {
    setup_match_media(1024);
    
    const { use_breakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => use_breakpoints());

    // Simular resize
    Object.defineProperty(window, 'innerWidth', { value: 480 });
    fireEvent(window, new Event('resize'));

    expect(result.result.current.windowWidth).toBe(480);
  });

  it('debería limpiar event listeners correctamente', async () => {
    const { use_breakpoints } = await import('@/hooks/use-breakpoints');
    
    // No debe lanzar errores al desmontar
    const { unmount } = renderHook(() => use_breakpoints());
    expect(() => unmount()).not.toThrow();
  });
});
