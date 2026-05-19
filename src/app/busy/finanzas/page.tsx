"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ResumenFinanciero } from "@/features/contabilidad/components/resumen-financiero"

export default function EconomiaPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
              <p className="text-muted-foreground">Control financiero completo de ingresos y gastos</p>
            </div>
          </div>

          <ResumenFinanciero
            periodo="mes"
            page={1}
            limit={10}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
