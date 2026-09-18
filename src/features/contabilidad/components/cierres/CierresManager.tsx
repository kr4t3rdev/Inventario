'use client'

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createCierreAction } from "@/features/contabilidad/actions-cierres";
import { CierreForm } from "./CierreForm";
import { CierresTable } from "./CierresTable";

interface CierreContableItem {
  cierreId: string;
  tipo: string;
  fechaInicio: string | Date;
  fechaFin: string | Date;
  totalVentas: number;
  totalGastos: number;
  ganancias: number;
  estado: string;
}

interface CierresManagerProps {
  cierres: CierreContableItem[];
}

/**
 * @description Componente principal para la gestión de cierres contables.
 * @param {CierresManagerProps} props - Lista inicial de cierres entregada por el server.
 * @returns {JSX.Element} Panel de cierres con tabla y diálogo de creación.
 */
export function CierresManager({ cierres: initialCierres }: CierresManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cierres, setCierres] = useState(initialCierres);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setCierres(initialCierres);
  }, [initialCierres]);

  const handleCreateCierre = async (data: unknown) => {
    setIsCreating(true);

    try {
      const result = await createCierreAction(data as never);
      if (!result?.success) {
        alert(result?.error?.message || "Error al crear el cierre contable");
        return;
      }

      if (result.data) {
        setCierres((current) => [result.data as any, ...current]);
      }

      setShowCreateDialog(false);
    } catch (error) {
      console.error("Error creando cierre:", error);
      alert("Error al crear el cierre contable");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Cierres Contables</h2>
          <p className="text-muted-foreground">
            Gestión de cierres diarios, mensuales y anuales con análisis financiero
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cierre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Cierre Contable</DialogTitle>
            </DialogHeader>
            <CierreForm
              onSubmit={handleCreateCierre}
              isLoading={isCreating}
            />
          </DialogContent>
        </Dialog>
      </div>

      <CierresTable
        cierres={cierres}
        isLoading={false}
      />
    </div>
  );
}