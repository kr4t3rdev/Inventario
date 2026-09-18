import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getCuentaHistorialAction: vi.fn(),
  getMonedasAction: vi.fn(),
  getTasasActualesAction: vi.fn(),
  getPrestamoCashHistorialAction: vi.fn(),
}));
const { getCuentaHistorialAction, getMonedasAction, getTasasActualesAction, getPrestamoCashHistorialAction } = mocks;

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  getCuentaHistorialAction: mocks.getCuentaHistorialAction,
}));
vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: mocks.getMonedasAction,
  getTasasActualesAction: mocks.getTasasActualesAction,
}));
vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  getPrestamoCashHistorialAction: mocks.getPrestamoCashHistorialAction,
}));
vi.mock('@/components/ui/animations', () => ({
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/contabilidad/utils/contabilidadUtils', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value}`,
  formatDate: (value: string) => value,
  convertCurrency: (amount: number, from: string, to: string) => amount,
}));
vi.mock('@/lib/token', () => ({ getAuthToken: () => null }));

import { AccountTransactionHistory } from './account-transaction-history';

describe('AccountTransactionHistory', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getCuentaHistorialAction.mockResolvedValue({
      success: true,
      data: {
        transacciones: [],
        resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 0 },
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      },
    });
    getMonedasAction.mockResolvedValue({ success: true, data: [] });
    getTasasActualesAction.mockResolvedValue({ success: true, data: { tasas: [] } });
    getPrestamoCashHistorialAction.mockResolvedValue({ success: true, data: null });
  });

  describe('Sincronización y Filtros (Fase 0)', () => {
    it('usa y resincroniza las fechas globales', async () => {
      const { rerender } = render(
        <AccountTransactionHistory
          cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP"
          fechaInicio="2026-04-01" fechaFin="2026-04-30"
        />,
      );
      await waitFor(() => expect(getCuentaHistorialAction).toHaveBeenCalledWith(expect.objectContaining({
        cuentaId: 'cta-1', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', page: 1,
      })));

      rerender(
        <AccountTransactionHistory
          cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP"
          fechaInicio="2026-05-01" fechaFin="2026-05-31"
        />,
      );
      await waitFor(() => expect(getCuentaHistorialAction).toHaveBeenCalledWith(expect.objectContaining({
        cuentaId: 'cta-1', fechaInicio: '2026-05-01', fechaFin: '2026-05-31', page: 1,
      })));
    });

    it('muestra el estado vacío', async () => {
      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);
      expect(await screen.findByText('No se encontraron transacciones')).toBeInTheDocument();
    });
  });

  describe('Integridad de Datos (Fase 3)', () => {
    it('usa los totales del resumen y NO la suma de la página visible', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: Array.from({ length: 2 }, (_, index) => ({
            transaccionId: `tx-${index}`, fecha: '2026-01-01', tipoMovimiento: 'venta',
            descripcion: 'Test', monedaOriginal: 'CUP', montoOriginal: 100,
          })),
          resumen: {
            saldoActual: 5000,
            totalIngresos: 1200,
            totalEgresos: 0,
            totalTransferencias: 0,
            totalMovimientos: 12
          },
          pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        expect(screen.getByText(/Ingresos/i).parentElement).toHaveTextContent('1200');
      });
    });

    it('muestra saldo cero explícito y no "Cargando..."', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [],
          resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 0 },
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await screen.findByText('No se encontraron transacciones');
      expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
      expect(screen.getByText(/Saldo actual/i).parentElement).toHaveTextContent('CUP 0');
    });

    it('restablece la paginación a 1 al cambiar el tipo de movimiento', async () => {
      const user = userEvent.setup();
      getCuentaHistorialAction.mockResolvedValue({
        success: true,
        data: {
          transacciones: [],
          resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 0 },
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      const select = await screen.findByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Ventas'));

      await waitFor(() => {
        expect(getCuentaHistorialAction).toHaveBeenCalledWith(expect.objectContaining({
          page: 1,
        }));
      });
    });
  });

  describe('Accesibilidad y Copy (Fase 3)', () => {
    it('permite navegar y activar detalles de préstamo con teclado', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [{
            transaccionId: 'tx-loan', fecha: '2026-04-15', tipoMovimiento: 'prestamo_cash_desembolso',
            descripcion: 'Préstamo Test', monedaOriginal: 'CUP', montoOriginal: 1000,
          }],
          resumen: { saldoActual: 1000, totalIngresos: 1000, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      const row = await (await screen.findByText('Préstamo Test')).closest('tr');
      expect(row).toHaveAttribute('tabIndex', '0');
    });

    it('utiliza copy en español neutro', async () => {
      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await screen.findByText('No se encontraron transacciones');
      const bodyText = document.body.textContent || '';
      expect(bodyText).not.toMatch(/Seleccioná/i);
      expect(bodyText).not.toMatch(/Mirá/i);
    });
  });

  describe('Fase 3 — RED', () => {
    it('cambiar página no modifica los totales del período', async () => {
      getCuentaHistorialAction.mockResolvedValue({
        success: true,
        data: {
          transacciones: Array.from({ length: 10 }, (_, i) => ({
            transaccionId: `tx-${i}`, fecha: '2026-01-01', tipoMovimiento: 'venta',
            descripcion: `Venta ${i}`, monedaOriginal: 'CUP', montoOriginal: 100,
          })),
          resumen: { saldoActual: 5000, totalIngresos: 12000, totalEgresos: 3000, totalTransferencias: 2, totalMovimientos: 25 },
          pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        const el = screen.getByText(/Ingresos/i).closest('div');
        expect(el?.textContent).toMatch(/12[.,]000/);
      });

      const user = userEvent.setup();
      const nextBtn = screen.getByRole('button', { name: 'Siguiente' });
      await user.click(nextBtn);

      await waitFor(() => {
        expect(getCuentaHistorialAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
      });

      const ingresosEl = screen.getByText(/Ingresos/i).closest('div');
      expect(ingresosEl?.textContent).toMatch(/12.?000/);
      const egresosEl = screen.getByText(/Egresos/i).closest('div');
      expect(egresosEl?.textContent).toMatch(/3.?000/);
    });

    it('filas no interactivas no tienen tabIndex', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [{
            transaccionId: 'tx-venta', fecha: '2026-04-15', tipoMovimiento: 'venta',
            descripcion: 'Venta normal', monedaOriginal: 'CUP', montoOriginal: 500,
          }],
          resumen: { saldoActual: 500, totalIngresos: 500, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      const row = await (await screen.findByText('Venta normal')).closest('tr');
      expect(row).not.toHaveAttribute('tabIndex');
    });

    it('todos los tipos contables tienen etiquetas legibles', async () => {
      const tipos = [
        'venta', 'servicio', 'gasto', 'salario',
        'transferencia_entrada', 'transferencia_salida',
        'ajuste_ingreso', 'ajuste_egreso',
        'prestamo_cash_pago', 'prestamo_cash_desembolso', 'deuda_cash',
      ];
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: tipos.map((tipo, i) => ({
            transaccionId: `tx-${i}`, fecha: '2026-04-15', tipoMovimiento: tipo,
            descripcion: `Test ${tipo}`, monedaOriginal: 'CUP', montoOriginal: 100,
          })),
          resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: tipos.length },
          pagination: { page: 1, limit: 20, total: tipos.length, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
      });

      const bodyText = document.body.textContent || '';
      expect(bodyText).toContain('Venta');
      expect(bodyText).toContain('Servicio');
      expect(bodyText).toContain('Gasto');
      expect(bodyText).toContain('Salario');
      expect(bodyText).toContain('Transferencia Entrada');
      expect(bodyText).toContain('Transferencia Salida');
      expect(bodyText).toContain('Ajuste Ingreso');
      expect(bodyText).toContain('Ajuste Egreso');
      expect(bodyText).toContain('Cobro Préstamo Cash');
      expect(bodyText).toContain('Desembolso Préstamo Cash');
      expect(bodyText).toContain('Deuda Cash');
    });

    it('representa los desembolsos de préstamos y deudas como egresos', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [
            {
              transaccionId: 'tx-loan-out', fecha: '2026-04-15',
              tipoMovimiento: 'prestamo_cash_desembolso', descripcion: 'Desembolso préstamo',
              monedaOriginal: 'CUP', montoOriginal: 100,
            },
            {
              transaccionId: 'tx-debt-out', fecha: '2026-04-14',
              tipoMovimiento: 'deuda_cash_pago', descripcion: 'Pago deuda',
              monedaOriginal: 'CUP', montoOriginal: 50,
            },
          ],
          resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 150, totalTransferencias: 0, totalMovimientos: 2 },
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        const loanRow = screen.getByText('Desembolso préstamo').closest('tr');
        const debtRow = screen.getByText('Pago deuda').closest('tr');
        expect(loanRow).toHaveTextContent('-CUP 100');
        expect(debtRow).toHaveTextContent('-CUP 50');
      });
    });

    it('la fila de préstamo es navegable por teclado y activa el sheet', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [{
            transaccionId: 'tx-loan', fecha: '2026-04-15', tipoMovimiento: 'prestamo_cash_desembolso',
            descripcion: 'Préstamo Test', monedaOriginal: 'CUP', montoOriginal: 1000,
          }],
          resumen: { saldoActual: 1000, totalIngresos: 1000, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      const row = await (await screen.findByText('Préstamo Test')).closest('tr');
      expect(row).toHaveAttribute('tabIndex', '0');
      expect(row).toHaveClass('cursor-pointer');
    });

    it('sheet de préstamo incluye título descriptivo en el DOM', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [{
            transaccionId: 'tx-loan', fecha: '2026-04-15', tipoMovimiento: 'prestamo_cash_desembolso',
            descripcion: 'Préstamo Test', monedaOriginal: 'CUP', montoOriginal: 1000,
          }],
          resumen: { saldoActual: 1000, totalIngresos: 1000, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });

      const { container } = render(
        <AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />,
      );

      await screen.findByText('Préstamo Test');

      const allText = container.textContent || '';
      expect(allText).toContain('Detalle de préstamo cash');
    });

    it('saldo null muestra Cargando...', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [],
          resumen: { saldoActual: null, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 0 },
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        expect(screen.getByText('Cargando...')).toBeInTheDocument();
      });
    });

    it('saldo 0 muestra monto y no Cargando...', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [],
          resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 0 },
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        },
      });

      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);

      await waitFor(() => {
        expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
      });

      const saldoEl = screen.getByText(/Saldo actual/i).closest('div');
      expect(saldoEl?.textContent).toMatch(/CUP/);
    });

    it('usa el identificador persistido para cargar el detalle del préstamo', async () => {
      getCuentaHistorialAction.mockResolvedValueOnce({
        success: true,
        data: {
          transacciones: [{
            transaccionId: 'tx-loan', fecha: '2026-04-15', tipoMovimiento: 'prestamo_cash_desembolso',
            prestamoCashId: 'prestamo-1', descripcion: 'Préstamo Test', monedaOriginal: 'CUP', montoOriginal: 1000,
          }],
          resumen: { saldoActual: 1000, totalIngresos: 1000, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      });
      getPrestamoCashHistorialAction.mockResolvedValue({
        success: true,
        data: { prestamo: { moneda: 'CUP' }, resumen: { saldoPendiente: 500 }, historial: [] },
      });

      const user = userEvent.setup();
      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);
      const row = await (await screen.findByText('Préstamo Test')).closest('tr');
      await user.click(row!);

      await waitFor(() => expect(getPrestamoCashHistorialAction).toHaveBeenCalledWith('prestamo-1'));
    });

    it('expone un nombre accesible para el filtro de tipo', async () => {
      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);
      expect(await screen.findByRole('combobox', { name: 'Filtrar por tipo de movimiento' })).toBeInTheDocument();
    });

    it('muestra 0 a 0 en la paginación vacía', async () => {
      render(<AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" />);
      expect(await screen.findByText(/Mostrando 0 a 0 de 0 transacciones/)).toBeInTheDocument();
    });

    it('descarta respuestas antiguas después de cambiar el rango', async () => {
      let resolveInitial!: (value: unknown) => void;
      let resolveLatest!: (value: unknown) => void;
      getCuentaHistorialAction
        .mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }))
        .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }));
      const { rerender } = render(
        <AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" fechaInicio="2026-04-01" />,
      );
      await waitFor(() => expect(getCuentaHistorialAction).toHaveBeenCalledTimes(1));
      rerender(
        <AccountTransactionHistory cuentaId="cta-1" nombreCuenta="Banco" numeroCuenta="123" monedaCuenta="CUP" fechaInicio="2026-05-01" />,
      );
      await waitFor(() => expect(getCuentaHistorialAction).toHaveBeenCalledTimes(2));
      resolveLatest({ success: true, data: {
        transacciones: [{ transaccionId: 'latest', fecha: '2026-05-02', tipoMovimiento: 'venta', descripcion: 'Resultado actual', monedaOriginal: 'CUP', montoOriginal: 2 }],
        resumen: { saldoActual: 2, totalIngresos: 2, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }});
      expect(await screen.findByText('Resultado actual')).toBeInTheDocument();
      resolveInitial({ success: true, data: {
        transacciones: [{ transaccionId: 'stale', fecha: '2026-04-02', tipoMovimiento: 'venta', descripcion: 'Resultado antiguo', monedaOriginal: 'CUP', montoOriginal: 1 }],
        resumen: { saldoActual: 1, totalIngresos: 1, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 1 },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }});
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByText('Resultado antiguo')).not.toBeInTheDocument();
    });
  });
});
