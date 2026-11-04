'use client'

import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsPageShell } from "@/features/configuracion/components/settings-page-shell"
import { ConfiguracionContratos, TiposContratosList } from "@/features/contratos"

export default function ConfiguracionContratosPage() {
  return (
    <SettingsPageShell
      icon={FileText}
      title="Configuración de contratos"
      description="Configura los parámetros generales para gestionar contratos."
      actions={
        <Button variant="outline" asChild>
          <Link href="/busy/contratos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a contratos
          </Link>
        </Button>
      }
    >
      <ConfiguracionContratos />
      <TiposContratosList />
    </SettingsPageShell>
  )
}
