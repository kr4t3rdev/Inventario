'use client'

import { ConfiguracionContratos } from "@/components/configuracion/configuracion-contratos"
import { TiposContratosList } from "@/components/contratos/tipos-contratos-list"

export default function ConfiguracionContratosPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Contratos</h1>
        <p className="text-muted-foreground">Configure los parámetros generales para la gestión de contratos</p>
      </div>
      <ConfiguracionContratos />
      <TiposContratosList />
    </div>
  )
}
