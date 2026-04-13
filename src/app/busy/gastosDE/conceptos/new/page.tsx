'use client'

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { GastoConceptoForm } from "@/components/gastoDE/GastoConceptoForm"

export default function NewGastoConceptoPage() {
    return (
        <SidebarProvider>
            <SidebarInset>
                <div className="container mx-auto py-6 max-w-2xl">
                    <GastoConceptoForm />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
