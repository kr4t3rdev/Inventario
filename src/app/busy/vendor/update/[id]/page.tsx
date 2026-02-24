'use client'
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useGetVendorQuery } from "@/lib/redux/services/vendorsApi"
import { VendorForm } from "@/components/vendor/vendor-form"
import { motion } from "framer-motion"
import { Building2, Sparkles, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function UpdateUnidadPage() {
    const params = useParams()
    const vendorId = params.id as string
    const { data:vendors, isLoading, error } = useGetVendorQuery(vendorId)

    if (isLoading) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-4">
                        <motion.div 
                            className="mb-6"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Skeleton className="h-8 w-8 rounded-md" />
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <Skeleton className="h-8 w-48" />
                            </div>
                            <Skeleton className="h-4 w-64 ml-12" />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <div className="flex items-center justify-center py-8 mb-6">
                                <motion.div
                                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </motion.div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    if (error || !vendors) {
        return (
            <SidebarProvider>
                <SidebarInset>
                    <div className="container mx-auto py-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Alert variant="destructive" className="border-dashed">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>
                                    No se pudo cargar el proveedor. Por favor, intente nuevamente.
                                </AlertDescription>
                            </Alert>
                        </motion.div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        )
    }

    return (
        <SidebarProvider>
            <SidebarInset>
                <div className="container mx-auto py-4">
                    <motion.div 
                        className="mb-6"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Link href="/busy/vendor">
                                    <Button variant="outline" size="icon" className="h-8 w-8">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </motion.div>
                            <motion.div 
                                className="flex items-center gap-3"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <motion.div 
                                    className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                                    whileHover={{ scale: 1.05, rotate: 5 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                >
                                    <Building2 className="h-5 w-5 text-white" />
                                </motion.div>
                                <div className="relative">
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                        Editar Proveedor
                                    </h1>
                                    <motion.div
                                        className="absolute -right-4 -top-1"
                                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                        transition={{ 
                                            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                        }}
                                    >
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>
                        <motion.p 
                            className="text-muted-foreground ml-12"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            Modifique los datos del proveedor: <span className="font-semibold text-foreground">{vendors.nombre}</span>
                        </motion.p>
                    </motion.div>
                    <VendorForm initialData={vendors} />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
