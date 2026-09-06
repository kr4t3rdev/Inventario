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
interface OrdenesCompraPageClientProps {
  vendors: VendorOption[];
  products: ProductOption[];
  orders: OrderRow[];
}

/**
 * @description Administra OC y sus recepciones parciales con backorder visible.
 * @param {OrdenesCompraPageClientProps} props - Catálogos y órdenes iniciales.
 * @returns {JSX.Element} Pantalla de órdenes y recepciones.
 */
export function OrdenesCompraPageClient({
  vendors,
  products,
  orders,
}: OrdenesCompraPageClientProps) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [receiveOrderId, setReceiveOrderId] = useState('');
  const [receiveItemId, setReceiveItemId] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ success: boolean; error?: { message?: string } | null }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error?.message ?? 'No se pudo completar la operación');
      return;
    }
    router.refresh();
  }

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => createOrdenCompraAction({
      proveedorId: vendorId,
      items: [{ productoId: productId, cantidadPedida: Number(quantity), precioUnitario: Number(unitPrice) }],
    }));
  }

  async function receiveOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => registrarRecepcionAction({
      ordenId: receiveOrderId,
      items: [{ ordenItemId: receiveItemId, cantidad: Number(receiveQuantity) }],
    }));
    setReceiveOrderId('');
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Órdenes de compra</h1>
        <p className="text-sm text-muted-foreground">Solicita mercancía, recibe parcialmente y conserva el backorder.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <form className="grid gap-3 rounded-md border p-4 md:grid-cols-5" onSubmit={createOrder}>
        <label className="space-y-1 text-sm">Proveedor
          <select aria-label="Proveedor" className="h-9 w-full rounded-md border bg-background px-2" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Selecciona</option>
            {vendors.map((vendor) => <option key={vendor.vendorId} value={vendor.vendorId}>{vendor.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">Producto
          <select aria-label="Producto" className="h-9 w-full rounded-md border bg-background px-2" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Selecciona</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">Cantidad
          <Input aria-label="Cantidad" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <label className="space-y-1 text-sm">Precio unitario
          <Input aria-label="Precio unitario" type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
        </label>
        <Button type="submit" className="self-end">Crear orden</Button>
      </form>

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
                  {order.estado === 'BORRADOR' && <Button size="sm" onClick={() => run(() => confirmarOrdenCompraAction(order.id))}>Confirmar</Button>}
                  {['CONFIRMADA', 'PARCIAL'].includes(order.estado) && <Button size="sm" variant="outline" onClick={() => { setReceiveOrderId(order.id); setReceiveItemId(order.items[0]?.id ?? ''); setReceiveQuantity(''); }}>Recibir</Button>}
                  {!['RECIBIDA', 'CANCELADA'].includes(order.estado) && <Button size="sm" variant="ghost" onClick={() => run(() => cancelarOrdenCompraAction(order.id))}>Cancelar</Button>}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No hay órdenes de compra.</td></tr>}
          </tbody>
        </table>
      </div>

      {receiveOrderId && (
        <form className="space-y-3 rounded-md border p-4" onSubmit={receiveOrder}>
          <h2 className="font-medium">Registrar recepción</h2>
          <label className="block space-y-1 text-sm">Línea de orden
            <Input aria-label="Línea de orden" value={receiveItemId} onChange={(e) => setReceiveItemId(e.target.value)} required />
          </label>
          <label className="block space-y-1 text-sm">Cantidad a recibir
            <Input aria-label="Cantidad a recibir" type="number" min="1" value={receiveQuantity} onChange={(e) => setReceiveQuantity(e.target.value)} required />
          </label>
          <div className="flex gap-2"><Button type="submit">Guardar recepción</Button><Button type="button" variant="ghost" onClick={() => setReceiveOrderId('')}>Cerrar</Button></div>
        </form>
      )}
    </div>
  );
}
