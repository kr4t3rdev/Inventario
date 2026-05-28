/**
 * @description Cabecera que muestra el estado del turno activo en el POS.
 * Incluye indicador visual, datos del turno y botones de acción.
 *
 * @param {object} props - Props del componente
 * @param {object | null} props.turno - Turno activo o null
 * @param {function} props.onCerrar - Callback al hacer click en cerrar
 * @param {function} props.onArqueo - Callback al hacer click en ver arqueo
 * @returns {JSX.Element} Cabecera de turno
 */
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lock, ClipboardList, Clock, User, DollarSign, ShoppingCart } from 'lucide-react';

interface TurnoInfo {
  id: string;
  empleado?: { nombre: string; apellido: string } | null;
  fondoInicialCup: number;
  fondoInicialUsd: number;
  _count?: { ventas: number };
  ventas?: Array<{ total?: number | null }>;
}

interface CabeceraTurnoProps {
  turno: TurnoInfo | null;
  onCerrar?: () => void;
  onArqueo?: () => void;
}

export function CabeceraTurno({ turno, onCerrar, onArqueo }: CabeceraTurnoProps) {
  if (!turno) return null;

  const totalVentas = turno.ventas?.reduce((sum, v) => sum + (v.total ?? 0), 0) ?? 0;
  const totalTickets = turno._count?.ventas ?? turno.ventas?.length ?? 0;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3">
        {/* Izquierda: indicador y datos principales */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="gap-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
          >
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Turno activo
          </Badge>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {turno.empleado
                ? `${turno.empleado.nombre} ${turno.empleado.apellido}`
                : 'Sin asignar'}
            </span>
          </div>
        </div>

        {/* Centro: datos del turno */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <span>
              Fondo: <strong>${(turno.fondoInicialCup / 100).toFixed(2)} CUP</strong>
              {turno.fondoInicialUsd > 0 &&
                ` · $${(turno.fondoInicialUsd / 100).toFixed(2)} USD`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>
              Ventas: <strong>${(totalVentas / 100).toFixed(2)}</strong> ({totalTickets} tickets)
            </span>
          </div>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2">
          {onArqueo && (
            <Button variant="outline" size="sm" onClick={onArqueo} className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Arqueo
            </Button>
          )}
          {onCerrar && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCerrar}
              className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
            >
              <Lock className="h-3.5 w-3.5" />
              Cerrar Turno
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
