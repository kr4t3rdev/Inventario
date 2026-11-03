'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { getAlertasVencimientoAction } from '@/features/inventario/actions-alertas';

interface ResumenAlertasVencimiento {
  total: number;
  vencidos: number;
  porVencer: number;
}

/**
 * @description Badge con el resumen de lotes próximos a vencer en inventario.
 * No muestra estados vacíos ni errores de disponibilidad de la feature.
 * @returns {JSX.Element | null} Resumen accesible de alertas, si hay lotes.
 */
export function AlertasVencimientoBadge(): ReactElement | null {
  const [resumen, setResumen] = useState<ResumenAlertasVencimiento | null>(null);

  useEffect(() => {
    let activo = true;
    getAlertasVencimientoAction()
      .then((resultado) => {
        if (!activo || !resultado.success || !resultado.data || resultado.data.total === 0) return;
        setResumen({
          total: resultado.data.total,
          vencidos: resultado.data.vencidos,
          porVencer: resultado.data.porVencer,
        });
      })
      .catch((error: unknown) => {
        console.error('Error al cargar alertas de vencimiento de lotes:', error);
      });

    return () => {
      activo = false;
    };
  }, []);

  if (!resumen) return null;

  return (
    <div
      role="status"
      aria-label={`Alertas de vencimiento: ${resumen.vencidos} vencidos y ${resumen.porVencer} por vencer`}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
      {resumen.vencidos > 0 && (
        <Badge variant="destructive">
          {resumen.vencidos} {resumen.vencidos === 1 ? 'lote vencido' : 'lotes vencidos'}
        </Badge>
      )}
      {resumen.porVencer > 0 && (
        <Badge variant="outline" className="border-amber-500 text-amber-900 dark:text-amber-100">
          {resumen.porVencer} {resumen.porVencer === 1 ? 'lote por vencer' : 'lotes por vencer'}
        </Badge>
      )}
      <span className="text-sm">
        Revisa las fechas de vencimiento de los lotes con existencias.
      </span>
    </div>
  );
}
