"use client";

/**
 * @description Sección completa de nómina + empleados para la subruta
 *              /busy/empleados/nomina. Solo accesible con feature `nomina`.
 *              Usa el sub-componente EmpleadoCard para la lista de empleados.
 *
 *              Reemplaza al antiguo EmpleadosNominaContent (620 líneas).
 *              Ahora este componente tiene ~200 líneas + EmpleadoCard
 *              + HistorialPagos como sub-componentes.
 *
 * @param {NominaEmpleadoSectionProps} props - Datos iniciales precargados por el server.
 * @returns {JSX.Element}
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPagoSalarioAction } from "@/features/pago-salario/actions";
import { deleteEmpleadoAction } from "@/features/empleados/actions";
import { Plus, CreditCard, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmpleadoCard } from "./empleado-card";
import { HistorialPagos } from "./historial-pagos";
import type { Empleado, Pagosalario } from "@/app/models/model";

interface PagoSalarioFormValues {
  salario: number;
  bonificaciones: number;
  deducciones: number;
  horasExtras: number;
  observaciones: string;
}

interface NominaEmpleadoSectionProps {
  initialEmpleados: Empleado[];
  initialPagos: Pagosalario[];
}

export function NominaEmpleadoSection({
  initialEmpleados,
  initialPagos,
}: NominaEmpleadoSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const puedeEditar = user?.tenantRole === "manager" || user?.role === "admin";

  const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados);
  const [pagos, setPagos] = useState<Pagosalario[]>(initialPagos);
  const [empleadoToDelete, setEmpleadoToDelete] = useState<string | null>(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setEmpleados(initialEmpleados);
  }, [initialEmpleados]);

  useEffect(() => {
    setPagos(initialPagos);
  }, [initialPagos]);

  const { register, handleSubmit, reset } = useForm<PagoSalarioFormValues>({
    defaultValues: {
      salario: 0,
      bonificaciones: 0,
      deducciones: 0,
      horasExtras: 0,
      observaciones: "",
    },
  });

  const handleOpenPagoDialog = (empleado: Empleado) => {
    setSelectedEmpleado(empleado);
    setIsDialogOpen(true);
  };

  const handleClosePagoDialog = () => {
    setIsDialogOpen(false);
    setSelectedEmpleado(null);
    reset();
  };

  const onSubmitPago = async (data: PagoSalarioFormValues) => {
    if (!selectedEmpleado) return;

    try {
      const result = await createPagoSalarioAction({
        empleadoId: selectedEmpleado.empleadoId,
        salario: data.salario,
        bonificaciones: data.bonificaciones || 0,
        deducciones: data.deducciones || 0,
        horasExtras: data.horasExtras || 0,
        observaciones: data.observaciones || undefined,
      });

      if (!result.success) {
        toast.error(result.error?.message || "Error al registrar el pago de salario");
        return;
      }

      toast.success("Pago de salario registrado exitosamente");
      handleClosePagoDialog();
      router.refresh();
    } catch (_error) {
      toast.error("Error al registrar el pago de salario");
    }
  };

  const handleDelete = async () => {
    if (!empleadoToDelete) return;

    try {
      const result = await deleteEmpleadoAction(empleadoToDelete);
      if (!result.success) {
        toast.error(result.error?.message || "Hubo un error al eliminar el empleado.");
        return;
      }

      toast.success("El empleado ha sido eliminado exitosamente.");
      router.refresh();
    } catch (_error) {
      toast.error("Hubo un error al eliminar el empleado.");
    } finally {
      setEmpleadoToDelete(null);
    }
  };

  return (
    <>
      <div className="container mx-auto py-6 px-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Empleados y Nómina
              </h1>
            </div>
            {puedeEditar && (
              <Button
                asChild
                className="bg-linear-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <Link href="/busy/empleados/new">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
                </Link>
              </Button>
            )}
          </div>

          {/* Lista de empleados con botones de pago y delete */}
          {empleados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No hay empleados registrados.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empleados.map((empleado) => (
                <EmpleadoCard
                  key={empleado.empleadoId}
                  empleado={empleado}
                  puedeEditar={puedeEditar}
                  showPagoButton={true}
                  showDeleteButton={true}
                  onPago={handleOpenPagoDialog}
                  onDelete={setEmpleadoToDelete}
                />
              ))}
            </div>
          )}

          {/* Historial de pagos */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Historial de Pagos de Salario
              </h2>
            </div>
            <HistorialPagos pagos={pagos} />
          </div>
      </div>

      {/* Dialog de pago */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleClosePagoDialog()}
      >
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Registrar Pago de Salario
            </DialogTitle>
            <DialogDescription>
              Complete los detalles del pago para {selectedEmpleado?.nombre}{" "}
              {selectedEmpleado?.apellido}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitPago)} className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="salario" className="text-right">
                Salario Base
              </Label>
              <Input
                id="salario"
                type="number"
                className="col-span-3"
                {...register("salario", {
                  required: true,
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bonificaciones" className="text-right">
                Bonificaciones
              </Label>
              <Input
                id="bonificaciones"
                type="number"
                className="col-span-3"
                {...register("bonificaciones", { valueAsNumber: true })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deducciones" className="text-right">
                Deducciones
              </Label>
              <Input
                id="deducciones"
                type="number"
                className="col-span-3"
                {...register("deducciones", { valueAsNumber: true })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="horasExtras" className="text-right">
                Horas Extras
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="horasExtras"
                  type="number"
                  {...register("horasExtras", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Cantidad de horas; se pagan a 1.5× la tarifa horaria del salario base.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="observaciones" className="text-right">
                Observaciones
              </Label>
              <Textarea
                id="observaciones"
                className="col-span-3"
                {...register("observaciones")}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClosePagoDialog}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-linear-to-r from-orange-500 to-red-600 text-white"
              >
                Registrar Pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de eliminación */}
      <AlertDialog
        open={!!empleadoToDelete}
        onOpenChange={(open) => !open && setEmpleadoToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              al empleado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
