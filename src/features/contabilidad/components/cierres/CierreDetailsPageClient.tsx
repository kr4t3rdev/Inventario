"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateCierreAction } from "@/features/contabilidad/actions-cierres";
import { CierreDetails } from "./CierreDetails";

interface CierreDetailsData {
  cierreId: string;
  tipo: string;
  estado: string;
  fechaInicio: string | Date;
  fechaFin: string | Date;
  creadoPor: string;
  observaciones?: string | null;
  totalVentas: number;
  totalGastos: number;
  totalGastosM: number;
  ganancias: number;
  perdidas: number;
  deudasClientes: number;
  deudasProveedores: number;
  inventarioVendido: number;
  inventarioRebajado: number;
  stockFinal: number;
  margenGanancia: number;
  margenPerdida: number;
  ventasVsExistencias?: string | number | null;
}

interface CierreDetailsPageClientProps {
  cierre: CierreDetailsData;
}

/**
 * @description Vista cliente para el detalle de un cierre contable.
 * Maneja la aprobación con Server Action y refresca la página.
 *
 * @param {CierreDetailsPageClientProps} props - Cierre cargado desde el servidor.
 * @returns {JSX.Element} Contenido interactivo del detalle.
 */
export function CierreDetailsPageClient({ cierre }: CierreDetailsPageClientProps) {
  const router = useRouter();

  const normalizedCierre = {
    ...cierre,
    observaciones: cierre.observaciones || "",
    ventasVsExistencias:
      typeof cierre.ventasVsExistencias === "string"
        ? parseFloat(cierre.ventasVsExistencias) || 0
        : cierre.ventasVsExistencias || 0,
  };

  const handleApproveCierre = async () => {
    const result = await updateCierreAction({
      id: cierre.cierreId,
      estado: "aprobado",
      aprobadoPor: "admin",
    });

    if (!result?.success) {
      console.error("Error aprobando cierre:", result?.error);
      alert("Error al aprobar el cierre");
      return;
    }

    router.refresh();
  };

  return (
    <div className="container mx-auto p-6">
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

      <CierreDetails
  // @ts-expect-error TODO: fix type for cierre prop
        cierre={
        normalizedCierre
        }
        onClose={() => router.back()}
        onApprove={handleApproveCierre}
      />
    </div>
  );
}