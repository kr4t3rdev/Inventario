'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { GastoElementoForm } from "@/features/gastosDE"
import { getGastoConceptoByIdAction } from "@/features/gastosDE/actions"
import { Skeleton } from "@/components/ui/skeleton"

export default function NewGastoElementoPage() {
    const params = useParams()
    const conceptoId = params.id as string
    const [concepto, setConcepto] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        getGastoConceptoByIdAction(conceptoId).then(r => { if (r.success) setConcepto(r.data); setIsLoading(false) })
    }, [conceptoId])

    if (isLoading) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-6 max-w-2xl">
                        <Skeleton className="h-10 w-full mb-4" />
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <div className="flex justify-end gap-4">
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-10 w-32" />
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    return (
        <SidebarProvider>
            <SidebarInset>
                <div className="container mx-auto py-6 max-w-2xl">
                    <GastoElementoForm conceptoId={conceptoId} conceptoNombre={concepto?.nombre} />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
