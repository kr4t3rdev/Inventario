/**
 * @description Diálogo para abrir un turno en un punto de venta.
 * Permite seleccionar empleado y definir fondo inicial en CUP y USD.
 *
 * @param {object} props - Props del componente
 * @param {boolean} props.open - Estado del diálogo
 * @param {function} props.onOpenChange - Callback para cambio de estado
 * @param {string} props.puntoDeVentaId - ID del punto de venta
 * @param {string} props.puntoDeVentaNombre - Nombre del punto de venta
 * @param {function} props.onSuccess - Callback al abrir turno exitosamente
 * @returns {JSX.Element} Diálogo de apertura de turno
 */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, DollarSign, User, AlertCircle } from 'lucide-react';
import { abrirTurnoAction } from '@/features/turnos-pos/actions';
import { getEmpleadosAction } from '@/features/empleados/actions';

interface EmpleadoOption {
  empleadoId: string;
  nombre: string;
  apellido: string;
}

interface AperturaTurnoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puntoDeVentaId: string;
  puntoDeVentaNombre: string;
  onSuccess?: () => void;
}

export function AperturaTurnoDialog({
  open,
  onOpenChange,
  puntoDeVentaId,
  puntoDeVentaNombre,
  onSuccess,
}: AperturaTurnoDialogProps) {
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [fondoCup, setFondoCup] = useState('');
  const [fondoUsd, setFondoUsd] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmpleados();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setEmpleadoId('');
    setFondoCup('');
    setFondoUsd('');
    setObservaciones('');
  };

  const loadEmpleados = async () => {
    setIsLoadingEmpleados(true);
    try {
      const result = await getEmpleadosAction();
      if (result.success) {
        setEmpleados(result.data ?? []);
      }
    } catch {
      // Silently fail, empleados quedan vacío
    } finally {
      setIsLoadingEmpleados(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await abrirTurnoAction({
        puntoDeVentaId,
        empleadoId: empleadoId || null,
        fondoInicialCup: fondoCup ? Math.round(parseFloat(fondoCup) * 100) : 0,
        fondoInicialUsd: fondoUsd ? Math.round(parseFloat(fondoUsd) * 100) : 0,
        observaciones: observaciones || null,
      });

      if (result.success) {
        toast.success('Turno abierto exitosamente');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error?.message ?? 'Error al abrir turno');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string) => {
    if (!value) return '';
    const num = parseFloat(value);
    return isNaN(num) ? value : num.toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Abrir Turno — {puntoDeVentaNombre}
          </DialogTitle>
          <DialogDescription>
            Registre el fondo inicial de caja y el cajero responsable
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cajero */}
          <div className="space-y-2">
            <Label htmlFor="empleado" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Cajero responsable
            </Label>
            <Select
              value={empleadoId}
              onValueChange={setEmpleadoId}
              disabled={isLoadingEmpleados}
            >
              <SelectTrigger id="empleado">
                <SelectValue placeholder="Seleccionar cajero..." />
              </SelectTrigger>
              <SelectContent>
                {empleados.map((emp) => (
                  <SelectItem key={emp.empleadoId} value={emp.empleadoId}>
                    {emp.nombre} {emp.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fondo inicial CUP */}
          <div className="space-y-2">
            <Label htmlFor="fondoCup">Fondo inicial CUP</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="fondoCup"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                value={fondoCup}
                onChange={(e) => setFondoCup(e.target.value)}
              />
            </div>
          </div>

          {/* Fondo inicial USD */}
          <div className="space-y-2">
            <Label htmlFor="fondoUsd">Fondo inicial USD</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="fondoUsd"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                value={fondoUsd}
                onChange={(e) => setFondoUsd(e.target.value)}
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              placeholder="Opcional"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
            />
          </div>

          {fondoCup && parseFloat(fondoCup) > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Fondo inicial: <strong>${formatCurrency(fondoCup)} CUP</strong>
                {fondoUsd && parseFloat(fondoUsd) > 0
                  ? ` + $${formatCurrency(fondoUsd)} USD`
                  : ''}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Abriendo...
              </>
            ) : (
              'Abrir Turno'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
