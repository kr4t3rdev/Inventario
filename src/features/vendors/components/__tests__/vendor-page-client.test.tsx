/**
 * @description Tests de regresión para el renderizado del contrato de proveedores.
 *
 * Cubre:
 * - Vendor con contrato muestra el número de contrato
 * - Vendor sin contrato muestra "Sin contrato"
 *
 * @module features/vendors/components/__tests__/vendor-page-client.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mocks de dependencias pesadas
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: any) => children,
  m: {
    div: ({ children, whileHover, whileTap, initial, animate, transition, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, whileHover, whileTap, initial, animate, transition, ...props }: any) => <span {...props}>{children}</span>,
    img: ({ children, whileHover, whileTap, initial, animate, transition, ...props }: any) => <div {...props}>{children}</div>,
  },
}));
vi.mock('@/components/ui/sidebar', () => ({ SidebarProvider: ({ children }: any) => <>{children}</>, SidebarInset: ({ children }: any) => <>{children}</> }));

// Mock simple del DataTable para evitar dependencias complejas
vi.mock('@/components/data-table', () => ({
  DataTable: ({ columns, data }: any) => (
    <div data-testid="data-table">
      {data.map((item: any, idx: number) => (
        <div key={idx} data-testid="vendor-row">
          {columns.map((col: any) => {
            if (col.accessorKey === 'contrato') {
              const cellElement = col.cell?.({ row: { original: item, getValue: (key: string) => item[key] } });
              return <span key={col.accessorKey} data-testid="contrato-cell">{cellElement}</span>;
            }
            return null;
          })}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <>{children}</>,
  AlertDialogContent: ({ children }: any) => <>{children}</>,
  AlertDialogHeader: ({ children }: any) => <>{children}</>,
  AlertDialogTitle: ({ children }: any) => <>{children}</>,
  AlertDialogDescription: ({ children }: any) => <>{children}</>,
  AlertDialogFooter: ({ children }: any) => <>{children}</>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <>{children}</>,
  DialogContent: ({ children }: any) => <>{children}</>,
  DialogHeader: ({ children }: any) => <>{children}</>,
  DialogTitle: ({ children }: any) => <>{children}</>,
  DialogDescription: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/features/vendors', () => ({ deleteVendorAction: vi.fn() }));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children, className }: any) => <span className={className}>{children}</span> }));
vi.mock('lucide-react', () => ({
  ArrowUp: () => null,
  ArrowUpDown: () => null,
  Eye: () => null,
  Pencil: () => null,
  Plus: () => null,
  Trash2: () => null,
  Building2: () => null,
  Sparkles: () => null,
  AlertCircle: () => null,
  FileText: () => null,
}));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, asChild, className }: any) => <button onClick={onClick} className={className}>{children}</button> }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));

import { VendorPageClient } from '@/features/vendors/components/vendor-page-client';

describe('VendorPageClient - Contrato rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el número de contrato cuando contrato está presente', () => {
    const vendors = [
      {
        vendorId: 'v1',
        nombre: 'Proveedor Test',
        contrato: 'CTR-001',
        createdAt: '2025-01-01T00:00:00.000Z',
        logo: null,
      },
    ];

    render(<VendorPageClient vendors={vendors} />);
    expect(screen.getByText('CTR-001')).toBeInTheDocument();
    expect(screen.queryByText('Sin contrato')).toBeNull();
  });

  it('muestra "Sin contrato" cuando contrato es null', () => {
    const vendors = [
      {
        vendorId: 'v2',
        nombre: 'Proveedor Sin Contrato',
        contrato: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        logo: null,
      },
    ];

    render(<VendorPageClient vendors={vendors} />);
    expect(screen.getByText('Sin contrato')).toBeInTheDocument();
    expect(screen.queryByText('CTR-001')).toBeNull();
  });
});
