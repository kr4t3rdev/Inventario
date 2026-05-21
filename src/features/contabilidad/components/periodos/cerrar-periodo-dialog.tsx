/**
 * @description Dialog para cerrar un período contable.
 */
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { TipoPeriodo, EstadoPeriodo } from "@/lib/services/periodo-contable-types";

interface CerrarPeriodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  periodo: {
    periodoId: string;
    tipo: TipoPeriodo;
    estado: EstadoPeriodo;
    fechaInicio: Date | string;
    fechaFin: Date | string;
    codigoPeriodo?: string;
  } | null;
}

const TIPO_LABELS: Record<string, string> = {
  DIARIO: "Diario",
  MENSUAL: "Mensual",
  ANUAL: "Anual",
};

export function CerrarPeriodoDialog({ open, onOpenChange, onSuccess, periodo }: CerrarPeriodoDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!periodo) return;
    setIsLoading(true);
    setError('');

    try {
      const { cerrarPeriodoAction } = await import('@/features/contabilidad/actions-periodos');
      const result = await cerrarPeriodoAction({ periodoId: periodo.periodoId });

      if (!result.success) {
        setError(result.error?.message ?? 'Error al cerrar período');
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  if (!periodo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar Período Contable</DialogTitle>
          <DialogDescription>
            Esta acción genera un snapshot automático del período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Período</span>
              <Badge variant="outline">
                {TIPO_LABELS[periodo.tipo] ?? periodo.tipo}
              </Badge>
            </div>
            <div className="text-sm font-medium">
              {periodo.codigoPeriodo ?? format(new Date(periodo.fechaInicio), "dd/MM/yyyy")}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(periodo.fechaInicio), "dd/MM/yyyy")} —{" "}
              {format(new Date(periodo.fechaFin), "dd/MM/yyyy")}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Una vez cerrado, el período no acceptará nuevas operaciones contables.</p>
              <p className="mt-1">Podrá ser reabierto posteriormente con motivo justificado.</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cerrar Período
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}