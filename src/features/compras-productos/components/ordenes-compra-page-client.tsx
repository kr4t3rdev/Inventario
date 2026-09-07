'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  cancelarOrdenCompraAction,
  confirmarOrdenCompraAction,
  createOrdenCompraAction,
  registrarRecepcionAction,
} from '@/features/compras-productos/actions-oc';

interface VendorOption { vendorId: string; nombre: string }
interface ProductOption { id: string; nombre: string }
interface OrderRow {
  id: string;
  estado: string;
  total: number;
  createdAt: string;
  proveedor?: { nombre: string };
  items: Array<{
    id: string;
    cantidadPedida: number;
    cantidadRecibida: number;
    precioUnitario: number;
    producto?: { nombre: string };
  }>;
}
interface DraftLine {
  productoId: string;
  cantidad: string;
  precioUnitario: string;
}
interface OrdenesCompraPageClientProps {
  vendors: VendorOption[];
  products: ProductOption[];
  orders: OrderRow[];
  /** Permite crear/confirmar/cancelar OC (feature `ordenes-compra`). */
  canManageOrders?: boolean;
  /** Permite registrar recepciones (feature `recepciones`). */
  canReceive?: boolean;
  title?: string;
  showCreateForm?: boolean;
}

const EMPTY_LINE: DraftLine = { productoId: '', cantidad: '', precioUnitario: '' };

function nuevaClaveIdempotencia() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

/**
 * @description Administra OC multilínea y sus recepciones parciales con
 * backorder visible, idempotencia en recepciones y gating por feature.
 * @param {OrdenesCompraPageClientProps} props - Catálogos, órdenes y permisos.
 * @returns {JSX.Element} Pantalla de órdenes y recepciones.
 */
export function OrdenesCompraPageClient({
  vendors,
  products,
  orders,
  canManageOrders = true,
  canReceive = true,
  title = 'Órdenes de compra',
  showCreateForm = true,
}: OrdenesCompraPageClientProps) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [receiveOrderId, setReceiveOrderId] = useState('');
  const [receiveItemId, setReceiveItemId] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState('');
  const [receiveKey, setReceiveKey] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const receiveOrder = orders.find((order) => order.id === receiveOrderId);
  const receiveCandidates = receiveOrder?.items.filter(
    (item) => item.cantidadRecibida < item.cantidadPedida,
  ) ?? [];

  async function run(
    action: () => Promise<{ success: boolean; error?: { message?: string } | null }>,
  ): Promise<boolean> {
    setError(null);
    setIsPending(true);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error?.message ?? 'No se pudo completar la operación');
        return false;
      }
      router.refresh();
      return true;
    } catch (error_) {
      console.error('Error en operación de compra:', error_);
      setError('No se pudo completar la operación');
      return false;
    } finally {
      setIsPending(false);
    }
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = lines
      .filter((line) => line.productoId && Number(line.cantidad) > 0)
      .map((line) => ({
        productoId: line.productoId,
        cantidadPedida: Number(line.cantidad),
        precioUnitario: Number(line.precioUnitario) || 0,
      }));
    const ok = await run(() => createOrdenCompraAction({ proveedorId: vendorId, items }));
    if (ok) setLines([{ ...EMPTY_LINE }]);
  }

  async function receiveOrderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => registrarRecepcionAction({
      ordenId: receiveOrderId,
      claveIdempotencia: receiveKey,
      items: [{ ordenItemId: receiveItemId, cantidad: Number(receiveQuantity) }],
    }));
    // Solo se cierra el panel si la recepción fue aceptada; ante error se
    // conserva línea y cantidad para que el usuario corrija.
    if (ok) {
      setReceiveOrderId('');
      setReceiveItemId('');
      setReceiveQuantity('');
      setReceiveKey(nuevaClaveIdempotencia());
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">Solicita mercancía, recibe parcialmente y conserva el backorder.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {canManageOrders && showCreateForm && (
        <form className="space-y-3 rounded-md border p-4" onSubmit={createOrder}>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm">Proveedor
              <select aria-label="Proveedor" className="h-9 w-full rounded-md border bg-background px-2" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                <option value="">Selecciona</option>
                {vendors.map((vendor) => <option key={vendor.vendorId} value={vendor.vendorId}>{vendor.nombre}</option>)}
              </select>
            </label>
          </div>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">Producto
                <select aria-label={`Producto ${index + 1}`} className="h-9 w-full rounded-md border bg-background px-2" value={line.productoId} onChange={(e) => updateLine(index, { productoId: e.target.value })} required>
                  <option value="">Selecciona</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">Cantidad
                <Input aria-label={`Cantidad ${index + 1}`} type="number" min="1" value={line.cantidad} onChange={(e) => updateLine(index, { cantidad: e.target.value })} required />
              </label>
              <label className="space-y-1 text-sm">Precio unitario
                <Input aria-label={`Precio unitario ${index + 1}`} type="number" min="0" value={line.precioUnitario} onChange={(e) => updateLine(index, { precioUnitario: e.target.value })} required />
              </label>
              {lines.length > 1 && (
                <Button type="button" variant="ghost" className="self-end" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                  Quitar línea
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}>
              Agregar línea
            </Button>
            <Button type="submit" disabled={isPending}>Crear orden</Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-3">Proveedor</th><th className="p-3">Estado</th><th className="p-3">Total</th><th className="p-3">Líneas</th><th className="p-3">Acciones</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-0">
                <td className="p-3">{order.proveedor?.nombre ?? 'Sin proveedor'}</td>
                <td className="p-3 font-medium">{order.estado}</td>
                <td className="p-3">{order.total}</td>
                <td className="p-3 space-y-1">{order.items.map((item) => <div key={item.id}>{item.producto?.nombre ?? item.id}: {item.cantidadRecibida}/{item.cantidadPedida}</div>)}</td>
                <td className="flex gap-2 p-3">
                  {canManageOrders && order.estado === 'BORRADOR' && (
                    <Button size="sm" disabled={isPending} onClick={() => run(() => confirmarOrdenCompraAction(order.id))}>Confirmar</Button>
                  )}
                  {canReceive && ['CONFIRMADA', 'PARCIAL'].includes(order.estado) && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => {
                      setReceiveOrderId(order.id);
                      const pendiente = order.items.find((item) => item.cantidadRecibida < item.cantidadPedida);
                       setReceiveItemId(pendiente?.id ?? order.items[0]?.id ?? '');
                       setReceiveQuantity('');
                       setReceiveKey(nuevaClaveIdempotencia());
                    }}>Recibir</Button>
                  )}
                  {canManageOrders && !['RECIBIDA', 'CANCELADA'].includes(order.estado) && (
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => cancelarOrdenCompraAction(order.id))}>Cancelar</Button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No hay órdenes de compra.</td></tr>}
          </tbody>
        </table>
      </div>

      {receiveOrderId && (
        <form className="space-y-3 rounded-md border p-4" onSubmit={receiveOrderSubmit}>
          <h2 className="font-medium">Registrar recepción</h2>
          <label className="block space-y-1 text-sm">Línea de orden
            <select aria-label="Línea de orden" className="h-9 w-full rounded-md border bg-background px-2" value={receiveItemId} onChange={(e) => setReceiveItemId(e.target.value)} required>
              <option value="">Selecciona la línea</option>
              {(receiveOrder?.items ?? []).map((item) => {
                const pendiente = item.cantidadPedida - item.cantidadRecibida;
                return (
                  <option key={item.id} value={item.id} disabled={pendiente <= 0}>
                    {item.producto?.nombre ?? item.id} · pendiente {Math.max(pendiente, 0)}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-1 text-sm">Cantidad a recibir
            <Input aria-label="Cantidad a recibir" type="number" min="1" value={receiveQuantity} onChange={(e) => setReceiveQuantity(e.target.value)} required />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>Guardar recepción</Button>
            <Button type="button" variant="ghost" onClick={() => {
              setReceiveOrderId('');
              setReceiveKey(nuevaClaveIdempotencia());
            }}>Cerrar</Button>
          </div>
          {receiveCandidates.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta orden no tiene líneas pendientes por recibir.</p>
          )}
        </form>
      )}
    </div>
  );
}
