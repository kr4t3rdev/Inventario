"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

//lazy loading components
const ResumenFinanciero = dynamic(() => import('@/components/economia/resume-financiero').then(mod => ({default:mod.ResumenFinanciero})))
const GraficosEconomicos = dynamic(() => import('@/components/economia/graficos-economicos').then(mod => ({default:mod.GraficosEconomicos})))
const TablaIngresos = dynamic(() => import('@/components/economia/tabla-ingresos').then(mod => ({default:mod.TablaIngresos})))
const TablaGastos = dynamic(() => import('@/components/economia/tabla-gastos').then(mod => ({default:mod.TablaGastos})))

import dynamic from "next/dynamic"
import { PresupuestoManager } from "@/components/economia/presupuesto-manager"

export default function EconomiaPage() {
  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight"> Finanzas </h1>
              <p className="text-muted-foreground">Control financiero completo de ingresos y gastos</p>
            </div>
          </div>

          <Tabs defaultValue="resumen" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
              <TabsTrigger value="gastos">Gastos</TabsTrigger>
              {/* <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger> */}
              
            </TabsList>

            <TabsContent value="resumen" className="space-y-4">
              <ResumenFinanciero />
               <GraficosEconomicos /> 
            </TabsContent>

            <TabsContent value="ingresos" className="space-y-4">
              <TablaIngresos />
            </TabsContent>

            <TabsContent value="gastos" className="space-y-4">
              <TablaGastos />
            </TabsContent>

            {/* <TabsContent value="presupuesto" className="space-y-4">
              <PresupuestoManager />
            </TabsContent> */}

            
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
