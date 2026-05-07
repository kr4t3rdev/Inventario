'use client'

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CierreDetails } from "@/components/contabilidad/cierres/CierreDetails";
import { useGetCierreQuery, useUpdateCierreMutation } from "@/features/contabilidad/api/contabilidadApi";
import { useState } from "react";

/**
 * Página para mostrar detalles de un cierre contable específico
 */
export default function CierreDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const cierreId = params.id as string;

  const { data: cierre, isLoading } = useGetCierreQuery(cierreId);
  const [updateCierre] = useUpdateCierreMutation();

  const handleApproveCierre = async () => {
    if (!cierre) return;

    try {
      await updateCierre({
        id: cierre.cierreId,
        estado: "aprobado",
        aprobadoPor: "admin", // TODO: obtener del contexto
      }).unwrap();
      // Refrescar la página o mostrar mensaje de éxito
      window.location.reload();
    } catch (error) {
      console.error("Error aprobando cierre:", error);
      alert("Error al aprobar el cierre");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!cierre) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cierre no encontrado</h1>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header con botón de volver */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Cierres
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Detalles del Cierre Contable</h1>
          <p className="text-muted-foreground">
            Información completa del cierre seleccionado
          </p>
        </div>
      </div>

      {/* Componente de detalles */}
      <CierreDetails
        cierre={{
          ...cierre,
          observaciones: cierre.observaciones || "",
          ventasVsExistencias: typeof cierre.ventasVsExistencias === "string"
            ? parseFloat(cierre.ventasVsExistencias) || 0
            : cierre.ventasVsExistencias || 0,
        }}
        onClose={() => router.back()}
        onApprove={handleApproveCierre}
      />
    </div>
  );
}