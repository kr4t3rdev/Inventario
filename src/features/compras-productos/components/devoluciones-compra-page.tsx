'use client';

import { useMemo, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  anularDevolucionCompraAction,
  completarDevolucionCompraAction,
  crearDevolucionCompraAction,
} from '@/features/compras-productos/devoluciones';

interface DevolucionCompraRow {
  devolucionId: string;
  numero: string;
  estado: string;
  formaImputacion: string;
  montoTotal: number;
  montoImputado: number;
  saldoAFavor: number;
  moneda: string;
  createdAt: string | Date;
  proveedor: { nombre: string };
  compraDocumento: { numeroFactura: string };
  items: Array<{
    id: string;
    cantidad: number;
    total: number;
    producto: { nombre: string };
  }>;
}

interface CompraDevolucionOption {
  compraDocumentoId: string;
  numeroFactura: string;
  fechaCompra: string | Date;
  moneda: string;
  proveedor: { nombre: string };
  items: Array<{
    compraDocumentoItemId: string;
    cantidad: number;
    precioUnitario: number;
    producto: { nombre: string };
  }>;
}

interface DevolucionesCompraPageProps {
  devoluciones: DevolucionCompraRow[];
  compras: CompraDevolucionOption[];
}

/**
 * @description Permite registrar devoluciones a proveedores y seguir su aplicación contable.
 * @param {DevolucionesCompraPageProps} props - Devoluciones y compras disponibles del tenant.
 * @returns {JSX.Element} Panel de registro y seguimiento de devoluciones.
 */
export function DevolucionesCompraPage({
  devoluciones,
  compras,
}: DevolucionesCompraPageProps): JSX.Element {
  const router = useRouter();
  const [compraId, setCompraId] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [formaImputacion, setFormaImputacion] = useState<'IMPUTACION_CXP' | 'SALDO_FAVOR'>('IMPUTACION_CXP');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const compraSeleccionada = useMemo(
    () => compras.find((compra) => compra.compraDocumentoId === compraId),
    [compras, compraId],
  );

  const enviarDevolucion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!compraSeleccionada) return;
    const items = compraSeleccionada.items
      .map((item) => ({
        compraDocumentoItemId: item.compraDocumentoItemId,
        cantidad: Number(cantidades[item.compraDocumentoItemId] ?? 0),
      }))
      .filter((item) => Number.isInteger(item.cantidad) && item.cantidad > 0);
    if (items.length === 0) {
      setError('Selecciona al menos una cantidad mayor que cero.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const result = await crearDevolucionCompraAction({
        compraDocumentoId: compraId,
        formaImputacion,
        motivo: motivo.trim() || null,
        items,
      });
      if (!result.success) throw new Error(result.error?.message ?? 'No se pudo registrar la devolución.');
      setCompraId('');
      setCantidades({});
      setMotivo('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la devolución.');
    } finally {
      setPending(false);
    }
  };

  const ejecutarAccion = async (devolucionId: string, action: 'complete' | 'cancel') => {
    setPending(true);
    setError('');
    try {
      const result = action === 'complete'
        ? await completarDevolucionCompraAction(devolucionId)
        : await anularDevolucionCompraAction(devolucionId);
      if (!result.success) throw new Error(result.error?.message ?? 'No se pudo actualizar la devolución.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la devolución.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
        <div>
            <Link href="/busy/compras-productos" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Volver a compras
            </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Compras · Proveedores</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Devoluciones</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Registra mercancía devuelta y consulta su efecto en inventario, CxP y saldo a favor.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="block text-xs font-medium uppercase tracking-wide text-amber-800">Flujo</span>
          Pendiente <span aria-hidden="true">→</span> Completada <span aria-hidden="true">→</span> Anulada
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <section aria-labelledby="nueva-devolucion" className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-900"><RotateCcw className="h-5 w-5" /></span>
          <div>
            <h2 id="nueva-devolucion" className="font-semibold">Registrar devolución</h2>
            <p className="text-sm text-muted-foreground">El sistema volverá a validar cantidades antes de afectar el stock.</p>
          </div>
        </div>
        <form className="space-y-5" onSubmit={enviarDevolucion}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Compra de origen
              <select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={compraId} onChange={(event) => { setCompraId(event.target.value); setCantidades({}); }} required>
                <option value="">Selecciona una compra</option>
                {compras.map((compra) => <option key={compra.compraDocumentoId} value={compra.compraDocumentoId}>
                  {compra.numeroFactura || compra.compraDocumentoId} · {compra.proveedor.nombre} · {new Date(compra.fechaCompra).toLocaleDateString('es')}
                </option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Aplicación del importe
              <select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={formaImputacion} onChange={(event) => setFormaImputacion(event.target.value as typeof formaImputacion)}>
                <option value="IMPUTACION_CXP">Reducir cuenta por pagar</option>
                <option value="SALDO_FAVOR">Mantener saldo a favor</option>
              </select>
            </label>
          </div>

          {compraSeleccionada ? <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] gap-3 bg-muted/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Producto</span><span>Comprado</span><span>Devolver</span>
            </div>
            {compraSeleccionada.items.map((item) => <div key={item.compraDocumentoItemId} className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] items-center gap-3 border-t px-4 py-3 text-sm">
              <span className="min-w-0 truncate">{item.producto.nombre}<span className="ml-2 text-xs text-muted-foreground">{item.precioUnitario} {compraSeleccionada.moneda}/u</span></span>
              <span>{item.cantidad}</span>
              <Input aria-label={`Cantidad a devolver: ${item.producto.nombre}`} type="number" min="0" max={item.cantidad} step="1" inputMode="numeric" value={cantidades[item.compraDocumentoItemId] ?? ''} onChange={(event) => setCantidades((current) => ({ ...current, [item.compraDocumentoItemId]: event.target.value }))} />
            </div>)}
          </div> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1.5 text-sm font-medium">
              Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
              <Input maxLength={500} value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Describe brevemente el motivo" />
            </label>
            <Button type="submit" disabled={pending || !compraSeleccionada} className="sm:min-w-48">
              {pending ? 'Guardando…' : 'Crear devolución pendiente'}
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="historial-devoluciones" className="space-y-3">
        <div className="flex items-end justify-between">
          <div><h2 id="historial-devoluciones" className="text-xl font-semibold">Historial reciente</h2><p className="text-sm text-muted-foreground">Últimas 50 devoluciones registradas en la empresa.</p></div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums">{devoluciones.length}</span>
        </div>
        {devoluciones.length === 0 ? <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium">Todavía no hay devoluciones</p><p className="mt-1 text-sm text-muted-foreground">Al registrar una, aparecerá aquí con sus movimientos y estado.</p>
        </div> : <div className="space-y-3">
          {devoluciones.map((devolucion) => <article key={devolucion.devolucionId} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{devolucion.numero}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{devolucion.estado}</span></div>
                <p className="mt-1 text-sm text-muted-foreground">{devolucion.proveedor.nombre} · Compra {devolucion.compraDocumento.numeroFactura || 'sin número'}</p>
              </div>
              <div className="text-right"><p className="font-semibold tabular-nums">{devolucion.montoTotal.toLocaleString('es')} {devolucion.moneda}</p><p className="text-xs text-muted-foreground">{new Date(devolucion.createdAt).toLocaleDateString('es')}</p></div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              {devolucion.items.map((item) => <li key={item.id}>{item.producto.nombre} × {item.cantidad}</li>)}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span>{devolucion.formaImputacion === 'IMPUTACION_CXP' ? `Aplicado a CxP: ${devolucion.montoImputado.toLocaleString('es')} ${devolucion.moneda}` : `Saldo a favor: ${devolucion.saldoAFavor.toLocaleString('es')} ${devolucion.moneda}`}</span>
              <div className="flex gap-2">
                {devolucion.estado === 'PENDIENTE' ? <Button type="button" size="sm" disabled={pending} onClick={() => void ejecutarAccion(devolucion.devolucionId, 'complete')}>Completar</Button> : null}
                {devolucion.estado !== 'ANULADA' ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void ejecutarAccion(devolucion.devolucionId, 'cancel')}>Anular</Button> : null}
              </div>
            </div>
          </article>)}
        </div>}
      </section>
    </main>
  );
}
