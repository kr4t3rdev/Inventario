'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { CierreForm } from "./CierreForm";
import { CierresTable } from "./CierresTable";
import { useGetCierresQuery, useCreateCierreMutation } from "@/features/contabilidad/api/contabilidadApi";

/**
 * Componente principal para gestión de cierres contables
 */
export function CierresManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: cierres = [], isLoading } = useGetCierresQuery();
  const [createCierre, { isLoading: isCreating }] = useCreateCierreMutation();

  const handleCreateCierre = async (data: any) => {
    try {
      await createCierre(data).unwrap();
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Error creando cierre:", error);
      alert("Error al crear el cierre contable");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con botón de crear */}
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

      {/* Tabla de cierres */}
      <CierresTable
        cierres={cierres}
        isLoading={isLoading}
      />
    </div>
  );
}