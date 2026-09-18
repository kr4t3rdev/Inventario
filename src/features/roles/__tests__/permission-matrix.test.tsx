import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { describe, expect, it } from 'vitest';

expect.extend({ toHaveNoViolations: toHaveNoViolations as ExpectMatcherFn });

type ExpectMatcherFn = (result: Awaited<ReturnType<typeof axe>>) => {
  pass: boolean;
  message: () => string;
};

import { PermissionMatrix } from '../components/permission-matrix';

/**
 * Accesibilidad y comportamiento de la matriz de permisos (PG-06-T3).
 */
describe('PermissionMatrix (a11y + interacción)', () => {
  it('no tiene violaciones de accesibilidad al renderizar toda la matriz', async () => {
    const { container } = render(<PermissionMatrix selectedKeys={[]} onChange={() => {}} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('marca como marcados los permisos seleccionados (aria-checked)', async () => {
    render(
      <PermissionMatrix
        selectedKeys={['ventas.venta.registrar']}
        onChange={() => {}}
      />,
    );

    const check = screen.getByLabelText('Registrar ventas');
    expect(check).toHaveProperty('checked', true);
  });

  it('el toggling selecciona/deselecciona una clave', async () => {
    const onChange = (keys: string[]) => newKeys.push(...keys);
    const newKeys: string[] = [];
    render(
      <PermissionMatrix selectedKeys={[]} onChange={onChange} />,
    );

    // "Registrar ventas" pertenece a la categoría ventas.
    const check = screen.getByLabelText('Registrar ventas');
    await userEvent.click(check);
    expect(newKeys).toContain('ventas.venta.registrar');
  });

  it('"seleccionar todos" de una categoría añade sus claves', async () => {
    const newKeys: string[] = [];
    render(<PermissionMatrix selectedKeys={[]} onChange={(k) => newKeys.push(...k)} />);

    // Selector "todos" de la categoría "ventas".
    const all = screen.getByLabelText('Seleccionar todos en ventas');
    await userEvent.click(all);

    expect(newKeys).toContain('ventas.venta.registrar');
  });

  it('respeta disabled (no interactúan checkbox deshabilitados)', async () => {
    const onChange = () => { throw new Error('no debería llamarse') };
    render(
      <PermissionMatrix selectedKeys={[]} onChange={onChange} disabled />,
    );

    const check = screen.getByLabelText('Registrar ventas');
    expect(check).toHaveProperty('disabled', true);
  });
});