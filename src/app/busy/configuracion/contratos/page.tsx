'use client'

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ConfiguracionContratos } from "@/components/configuracion/configuracion-contratos"
import { TiposContratosList } from "@/components/contratos/tipos-contratos-list"
import { Button } from "@/components/ui/button"

export default function ConfiguracionContratosPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de Contratos</h1>
        <p className="text-muted-foreground">Configure los parámetros generales para la gestión de contratos</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/busy/contratos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a contratos
          </Link>
        </Button>
      </div>
      <ConfiguracionContratos />
      <TiposContratosList />
    </div>
  )
}
