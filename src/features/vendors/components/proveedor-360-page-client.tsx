'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProveedor360Action } from '@/features/vendors/pricelist';

interface Proveedor360PageClientProps {
  vendorId: string;
}

interface Proveedor360Data {
  vendor: {
    nombre: string;
    vendorCode?: string | null;
    contacto?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    cuentaCUP?: string | null;
    cuentaUSD?: string | null;
  };
  pricelist: Array<{
    proveedorProductoId: string;
    costoUnitario: number;
    moneda: string;
    esPreferente: boolean;
    cantidadMinima?: number | null;
    plazoEntregaDias?: number | null;
    ultimaCompraDocumentoId?: string | null;
    producto: { nombre: string; codigoInterno?: string | null };
  }>;
  comprasRecientes: Array<{
    compraDocumentoId: string;
    numeroFactura: string;
    estado: string;
    total: number;
    moneda: string;
    createdAt: string | Date;
  }>;
  cuentasPorPagar: Array<Record<string, unknown>>;
  anticipos: Array<Record<string, unknown>>;
  deudasCash: Array<Record<string, unknown>>;
  contratos: Array<Record<string, unknown>>;
  metricas: { totalComprado12Meses: number; ultimaCompra?: string | Date | null };
}

function stringOrDash(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}

function amountLabel(record: Record<string, unknown>): string {
  const amount = record.saldoPendiente ?? record.saldoDisponible ?? record.montoPendiente
    ?? record.montoDeuda ?? record.montoCapital ?? record.montoOriginal ?? record.monto ?? record.total;
  const currency = typeof record.moneda === 'string' ? record.moneda : 'CUP';
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;
  if (!Number.isFinite(numericAmount)) return '—';
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(numericAmount)} ${currency}`;
}

function DetailList({
  rows,
  kind,
}: {
  rows: Array<Record<string, unknown>>;
  kind: 'payable' | 'advance' | 'debt' | 'contract';
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay registros activos.</p>;
  }

  return (
    <ul className="divide-y">
      {rows.map((row, index) => {
        const id = String(row.cuentaPorPagarId ?? row.anticipoId ?? row.deudaCashId ?? row.deudaId ?? row.contratoId ?? row.id ?? index);
        const title = kind === 'contract'
          ? stringOrDash(row.numeroContrato ?? row.nombre)
          : stringOrDash(row.numeroFactura ?? row.referenciaExterna ?? row.numero ?? row.referencia ?? row.estado);
        return (
          <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={id}>
            <div className="min-w-0">
              <p className="font-medium">{title}</p>
              {kind !== 'contract' && <p className="text-xs text-muted-foreground">{stringOrDash(row.estado)}</p>}
            </div>
            {kind !== 'contract' && <span className="tabular-nums">{amountLabel(row)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * @description Presenta la ficha 360 con pricelist, compras y saldos del proveedor.
 * @param {Proveedor360PageClientProps} props - Identificador del proveedor.
 * @returns {JSX.Element} Ficha comercial y financiera.
 */
export function Proveedor360PageClient({ vendorId }: Proveedor360PageClientProps) {
  const [data, setData] = useState<Proveedor360Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getProveedor360Action(vendorId).then((result) => {
      if (!active) return;
      if (result.success) {
        setData(result.data as Proveedor360Data);
        setError(null);
      } else setError(result.error?.message ?? 'No se pudo cargar el proveedor.');
      setLoading(false);
    }).catch(() => {
      if (active) {
        setError('No se pudo cargar el proveedor.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [vendorId, reloadKey]);

  if (loading) return <main className="container mx-auto space-y-4 py-8" aria-busy="true">Cargando ficha del proveedor…</main>;
  if (error || !data) return (
    <main className="container mx-auto space-y-4 py-8">
      <p role="alert">{error ?? 'No se encontró la información del proveedor.'}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setLoading(true); setReloadKey((key) => key + 1); }}>
          <RefreshCw className="mr-2 h-4 w-4" />Reintentar
        </Button>
        <Button variant="outline" asChild><Link href="/busy/vendor">Volver a proveedores</Link></Button>
      </div>
    </main>
  );

  const { vendor, metricas } = data;
  const money = (amount: number, currency = 'CUP') =>
    `${new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(amount / 100)} ${currency}`;

  return (
    <main className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-4">
        <Link href="/busy/vendor"><Button variant="outline" size="icon" aria-label="Volver a proveedores"><ArrowLeft /></Button></Link>
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div><h1 className="text-2xl font-semibold">{vendor.nombre}</h1><p className="text-sm text-muted-foreground">Ficha 360 del proveedor</p></div>
          {vendor.vendorCode && <Badge variant="secondary">{vendor.vendorCode}</Badge>}
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores del proveedor">
        <Card><CardHeader><CardTitle className="text-sm">Compras últimos 12 meses</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(metricas.totalComprado12Meses)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Productos en pricelist</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.pricelist.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Cuentas por pagar abiertas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.cuentasPorPagar.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Compras recientes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.comprasRecientes.length}</CardContent></Card>
      </section>
      <section aria-labelledby="datos-proveedor">
        <h2 id="datos-proveedor" className="mb-3 text-lg font-semibold">Datos del proveedor</h2>
        <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-muted-foreground">Contacto</dt><dd>{stringOrDash(vendor.contacto)}</dd></div>
          <div><dt className="text-muted-foreground">Teléfono</dt><dd>{stringOrDash(vendor.telefono)}</dd></div>
          <div><dt className="text-muted-foreground">Dirección</dt><dd>{stringOrDash(vendor.direccion)}</dd></div>
          <div><dt className="text-muted-foreground">Cuenta CUP</dt><dd>{stringOrDash(vendor.cuentaCUP)}</dd></div>
          <div><dt className="text-muted-foreground">Cuenta USD</dt><dd>{stringOrDash(vendor.cuentaUSD)}</dd></div>
        </dl>
      </section>
      <Card>
        <CardHeader><CardTitle>Precios de proveedor</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.pricelist.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay precios registrados.</p> : <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Producto</th><th className="p-2">Costo</th><th className="p-2">Cantidad mínima</th><th className="p-2">Plazo (días)</th><th className="p-2">Preferente</th></tr></thead><tbody>{data.pricelist.map((item) => <tr className="border-b" key={item.proveedorProductoId}><td className="p-2">{item.producto.nombre}</td><td className="p-2 tabular-nums">{money(item.costoUnitario, item.moneda)}</td><td className="p-2">{item.cantidadMinima ?? '—'}</td><td className="p-2">{item.plazoEntregaDias ?? '—'}</td><td className="p-2">{item.esPreferente ? 'Sí' : 'No'}</td></tr>)}</tbody></table>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Compras recientes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.comprasRecientes.length === 0 ? <p className="text-sm text-muted-foreground">No hay compras registradas.</p> : <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Factura</th><th className="p-2">Fecha</th><th className="p-2">Estado</th><th className="p-2">Total</th></tr></thead><tbody>{data.comprasRecientes.map((compra) => <tr className="border-b" key={compra.compraDocumentoId}><td className="p-2">{compra.numeroFactura || 'Sin número'}</td><td className="p-2">{new Intl.DateTimeFormat('es').format(new Date(compra.createdAt))}</td><td className="p-2">{compra.estado}</td><td className="p-2 tabular-nums">{money(compra.total, compra.moneda)}</td></tr>)}</tbody></table>}
        </CardContent>
      </Card>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Cuentas por pagar</CardTitle></CardHeader><CardContent><DetailList rows={data.cuentasPorPagar} kind="payable" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Anticipos</CardTitle></CardHeader><CardContent><DetailList rows={data.anticipos} kind="advance" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Deudas en efectivo</CardTitle></CardHeader><CardContent><DetailList rows={data.deudasCash} kind="debt" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Contratos</CardTitle></CardHeader><CardContent><DetailList rows={data.contratos} kind="contract" /></CardContent></Card>
      </section>
    </main>
  );
}
