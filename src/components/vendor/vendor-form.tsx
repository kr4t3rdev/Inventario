import { useAddVendorMutation, useGetVendorsQuery, useUpdateVendorMutation } from "@/lib/redux/services/vendorsApi";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Building2, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { sileo } from '@/lib/sileo-shim';
import { z } from "zod";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { VendorLogoUpload } from "./vendor-logo-upload";


const vendorSchema = z.object({
    nombre: z.string({
        required_error: 'El campo Nombre no ha sido rellenado',
    }),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    contacto: z.string().optional(),
    cuentaCUP: z.string().optional(),
    cuentaUSD: z.string().optional(),
    logo: z.string().nullable().optional(),
})

type VendorFormValues = z.infer<typeof vendorSchema>

interface VendorFormProps {
    initialData?: {
        vendorId: string
        nombre: string
        vendorCode?: string | null
        ean13Code?: string | null
        direccion?: string | null
        telefono?: string | null
        contacto?: string | null
        cuentaCUP?: string | null
        cuentaUSD?: string | null
        logo?: string | null
    }
}

export function VendorForm({initialData}: VendorFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    const { data: vendor, isLoading: isLoadingVendor} = useGetVendorsQuery()

    const [addVendor] = useAddVendorMutation()
    const [updateVendor] = useUpdateVendorMutation()

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        sileo.success({ title: 'Copiado al portapapeles' })
        setTimeout(() => setCopiedField(null), 2000)
    }

    const form = useForm<VendorFormValues>({
        resolver: zodResolver(vendorSchema),
        defaultValues: {
            nombre: initialData?.nombre || "",
            direccion: initialData?.direccion || "",
            telefono: initialData?.telefono || "",
            contacto: initialData?.contacto || "",
            cuentaCUP: initialData?.cuentaCUP || "",
            cuentaUSD: initialData?.cuentaUSD || "",
            logo: initialData?.logo || null,
        }
    })

    async function onSubmit(data: VendorFormValues) {
        setIsLoading(true)
        try {
            if (initialData) {
        await updateVendor({
            vendorId: initialData.vendorId,
          ...data,
        }).unwrap()
        sileo.success({ title: 'El proveedor ha sido actualizado exitosamente.' })
      } else {
        await addVendor(data).unwrap()
        sileo.success({ title: 'El proveedor ha sido registrado exitosamente.' })
      }
      router.push("/busy/vendor")
      router.refresh()
        } catch (error) {
            console.error("Error al guardar el proveedor:", error);
            sileo.error({ title: 'Hubo un error al guardar el proveedor.' })
        }finally {
            setIsLoading(false)
        }
    }

    if (isLoadingVendor) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="border-dashed">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-center py-8 mb-6">
                            <motion.div
                                className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                        </div>
                        <div className="space-y-6">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                            >
                                <Skeleton className="h-10 w-full" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Skeleton className="h-10 w-full" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Skeleton className="h-10 w-full" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <Skeleton className="h-10 w-full" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <Skeleton className="h-10 w-full" />
                            </motion.div>
                            <div className="flex justify-end space-x-4">
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-10 w-24" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        )
    }
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="border-dashed overflow-hidden">
                <div className="h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
                <CardContent className="pt-6">
                    <motion.div 
                        className="flex items-center gap-3 mb-6"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <motion.div 
                            className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                            <Building2 className="h-5 w-5 text-white" />
                        </motion.div>
                        <div className="relative">
                            <h2 className="text-lg font-semibold">
                                {initialData ? "Editar Proveedor" : "Nuevo Proveedor"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {initialData ? "Modifique los datos del proveedor" : "Ingrese los datos para registrar un nuevo proveedor"}
                            </p>
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

                    <Form {... form}>
                        <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-6">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="nombre"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese el nombre del proveedor</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            {initialData?.vendorCode && (
                                <motion.div
                                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.25 }}
                                >
                                    <div className="space-y-2">
                                        <FormLabel className="text-sm">Código de Proveedor</FormLabel>
                                        <motion.div
                                            className="flex items-center gap-2 p-3 bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <Badge variant="secondary" className="text-lg font-mono">
                                                {initialData.vendorCode}
                                            </Badge>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(initialData.vendorCode!, 'vendorCode')}
                                                className="ml-auto p-1 hover:bg-white rounded transition-colors"
                                            >
                                                {copiedField === 'vendorCode' ? (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-gray-600" />
                                                )}
                                            </button>
                                        </motion.div>
                                        <FormDescription className="text-xs">
                                            Código único asignado automáticamente
                                        </FormDescription>
                                    </div>

                                    <div className="space-y-2">
                                        <FormLabel className="text-sm">Código EAN13</FormLabel>
                                        <motion.div
                                            className="flex items-center gap-2 p-3 bg-linear-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200"
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <Badge variant="secondary" className="text-sm font-mono">
                                                {initialData.ean13Code}
                                            </Badge>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(initialData.ean13Code!, 'ean13Code')}
                                                className="ml-auto p-1 hover:bg-white rounded transition-colors"
                                            >
                                                {copiedField === 'ean13Code' ? (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-gray-600" />
                                                )}
                                            </button>
                                        </motion.div>
                                        <FormDescription className="text-xs">
                                            Código EAN13 para etiquetado
                                        </FormDescription>
                                    </div>
                                </motion.div>
                            )}

                            <motion.div 
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="direccion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Dirección</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese la dirección del proveedor</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="telefono"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Teléfono</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese el teléfono del proveedor</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            <motion.div 
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="cuentaCUP"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cuenta CUP</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese la cuenta en CUP</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="cuentaUSD"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cuenta USD</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese la cuenta en USD</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="contacto"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona de contacto</FormLabel>
                                            <FormControl>
                                                <Input type="text" {...field} className="transition-all duration-200 focus:scale-[1.01]" />
                                            </FormControl>
                                            <FormDescription>Ingrese el nombre de la persona de contacto</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="logo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Logo</FormLabel>
                                            <FormControl>
                                                <VendorLogoUpload
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    disabled={isLoading}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Suba un logo opcional para el proveedor (máx. 2MB).
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            <motion.div 
                                className="flex justify-end space-x-4 pt-4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button type="button" variant="outline" onClick={() => router.push("/busy/vendor")}>
                                        Cancelar
                                    </Button>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : initialData ? (
                                            "Actualizar Proveedor"
                                        ) : (
                                            "Crear Proveedor"
                                        )}
                                    </Button>
                                </motion.div>
                            </motion.div>       
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </motion.div>
    )

}