'use client'

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { GastoElementoForm } from "@/features/gastosDE"
import { getGastoConceptoByIdAction } from "@/features/gastosDE/actions"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function UpdateGastoElementoPage() {
    const params = useParams()
    const router = useRouter()
    const conceptoId = params.id as string
    const elementoId = params.elementoId as string
    const [concepto, setConcepto] = useState<any>(null)
    const [isLoadingConcepto, setIsLoadingConcepto] = useState(true)

    useEffect(() => {
        getGastoConceptoByIdAction(conceptoId).then(r => { if (r.success) setConcepto(r.data); setIsLoadingConcepto(false) })
    }, [conceptoId])

    // We need to fetch elementos to find the specific one
    const elemento = concepto?.elementos?.find((e: any) => e.elementoId === elementoId)

    if (isLoadingConcepto) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-6 max-w-2xl">
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

    if (!concepto || !elemento) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-6 max-w-2xl">
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">No se pudo cargar el elemento.</p>
                            <Button asChild>
                                <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos`}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
                                </Link>
                            </Button>
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
                    <div className="mb-4">
                        <Button variant="ghost" asChild>
                            <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos`}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
                            </Link>
                        </Button>
                    </div>
                    <GastoElementoForm
                        conceptoId={conceptoId}
                        conceptoNombre={concepto.nombre}
                        initialData={elemento as any}
                    />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
