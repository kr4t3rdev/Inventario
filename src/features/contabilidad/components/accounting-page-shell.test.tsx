import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Landmark } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MotionCapture = {
  tag: string;
  initial?: unknown;
  animate?: unknown;
  transition?: unknown;
};

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
  captures: [] as MotionCapture[],
}));

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Component = ({
          children,
          initial,
          animate,
          transition,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) => {
          motionState.captures.push({ tag, initial, animate, transition });
          return React.createElement(tag, props, children);
        };

        Component.displayName = `motion.${tag}`;
        return Component;
      },
    },
  );

  return {
    motion: motionProxy,
    useReducedMotion: () => motionState.reducedMotion,
  };
});

import { AccountingPageShell } from './accounting-page-shell';

interface RenderShellOptions {
  withActions?: boolean;
}

/**
 * @description Renderiza el shell contable con contenido representativo para las pruebas.
 * @param {RenderShellOptions} options - Controla si se incluyen acciones de encabezado.
 * @returns {ReturnType<typeof render>} Utilidades de Testing Library para la vista renderizada.
 */
function renderShell({ withActions = true }: RenderShellOptions = {}): ReturnType<typeof render> {
  return render(
    <AccountingPageShell
      icon={Landmark}
      title="Contabilidad"
      description="Consulta y administra la información financiera."
      actions={withActions ? <button type="button">Exportar</button> : undefined}
    >
      <section aria-label="Resumen contable">Contenido financiero</section>
    </AccountingPageShell>,
  );
}

describe('AccountingPageShell', () => {
  beforeEach(() => {
    motionState.reducedMotion = false;
    motionState.captures = [];
  });

  it('presenta título, descripción, acciones y contenido en la estructura compartida', () => {
    renderShell();

    const heading = screen.getByRole('heading', { level: 1, name: 'Contabilidad' });
    const header = heading.closest('header');
    const content = screen.getByRole('region', { name: 'Resumen contable' });

    expect(header).toContainElement(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByText('Consulta y administra la información financiera.')).toBeInTheDocument();
    expect(content).toHaveTextContent('Contenido financiero');
    expect(header?.parentElement).toHaveClass('container', 'mx-auto', 'space-y-6', 'py-4');
    expect(header).toHaveClass(
      'flex',
      'flex-col',
      'gap-4',
      'sm:flex-row',
      'sm:items-center',
      'sm:justify-between',
    );
    expect(content.parentElement).toHaveClass('space-y-6');
  });

  it('no agrega un contenedor de acciones cuando no recibe acciones', () => {
    renderShell({ withActions: false });

    const header = screen.getByRole('heading', { name: 'Contabilidad' }).closest('header');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(header).toHaveTextContent('Contabilidad');
    expect(header?.children).toHaveLength(1);
  });

  it('aplica la entrada de Ventas y Configuración cuando el movimiento está habilitado', () => {
    renderShell();

    expect(motionState.captures).toEqual([
      {
        tag: 'header',
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 },
      },
      {
        tag: 'div',
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.3 },
      },
    ]);
  });

  it('elimina desplazamientos, duración y retraso cuando se solicita movimiento reducido', () => {
    motionState.reducedMotion = true;

    renderShell();

    expect(motionState.captures).toEqual([
      {
        tag: 'header',
        initial: { opacity: 0, y: 0 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      },
      {
        tag: 'div',
        initial: { opacity: 0, y: 0 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0, delay: 0 },
      },
    ]);
  });
});
