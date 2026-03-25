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

const setViewport = (width: number, height: number = 800): void => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
};

describe('useBreakpoints hook', () => {
  beforeEach(() => {
    vi.resetModules();
    setViewport(1024);
  });

  it('retorna estado inicial correcto', async () => {
    const { useBreakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => useBreakpoints());

    expect(result.result.current.windowWidth).toBe(1024);
    expect(result.result.current.isDesktop).toBe(true);
    expect(result.result.current.isTablet).toBe(false);
    expect(result.result.current.isMobile).toBe(false);
  });

  it('actualiza estado tras resize', async () => {
    const { useBreakpoints } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => useBreakpoints());
    setViewport(480);
    fireEvent(window, new Event('resize'));

    expect(result.result.current.windowWidth).toBe(480);
    expect(result.result.current.isMobile).toBe(true);
  });
});

describe('useResponsiveColumns y useSimplifiedView', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('retorna 1 columna en móvil', async () => {
    setViewport(480);
    const { useResponsiveColumns } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => useResponsiveColumns());
    expect(result.result.current).toBe(1);
  });

  it('retorna 2 columnas en tablet', async () => {
    setViewport(800);
    const { useResponsiveColumns } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => useResponsiveColumns());
    expect(result.result.current).toBe(2);
  });

  it('retorna vista simplificada en móvil cuando está habilitada', async () => {
    setViewport(375);
    const { useSimplifiedView } = await import('@/hooks/use-breakpoints');
    const result = renderHook(() => useSimplifiedView(true, false));
    expect(result.result.current).toBe(true);
  });
});

describe('SwipeableTabs', () => {
  const tabs = [
    { value: 'tab1', label: 'Tab 1', icon: <span>Icon1</span> },
    { value: 'tab2', label: 'Tab 2', icon: <span>Icon2</span> },
    { value: 'tab3', label: 'Tab 3', icon: <span>Icon3</span> },
  ];

  it('renderiza tabs y permite cambiar tab', async () => {
    const onValueChange = vi.fn();
    render(<SwipeableTabs tabs={tabs} onValueChange={onValueChange} />);

    expect(screen.getByText('Tab 1')).toBeTruthy();
    await userEvent.click(screen.getByText('Tab 2'));
    expect(onValueChange).toHaveBeenCalledWith('tab2');
  });

  it('marca el tab disabled correctamente', () => {
    const disabledTabs = [...tabs, { value: 'tab4', label: 'Tab 4', disabled: true }];
    render(<SwipeableTabs tabs={disabledTabs} />);
    const tabButton = screen.getByText('Tab 4').closest('button');
    expect(tabButton?.getAttribute('disabled')).not.toBeNull();
  });
});

describe('BottomSheet', () => {
  it('renderiza cuando está abierto y tiene role dialog', () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="Test Sheet">
        <div>Contenido</div>
      </BottomSheet>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBe('Test Sheet');
  });

  it('no renderiza contenido cuando está cerrado', () => {
    render(
      <BottomSheet isOpen={false} onClose={vi.fn()} title="Test Sheet">
        <div>Contenido</div>
      </BottomSheet>
    );

    expect(screen.queryByText('Test Sheet')).toBeNull();
  });
});
