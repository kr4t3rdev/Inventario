"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useRef, type ChangeEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useCreateDeudaCashMutation } from "@/lib/redux/services/deudasCashApi"
import { ImageIcon, Loader2, Upload, X } from "lucide-react"
import { sileo } from "sileo"
import { getAuthToken } from "@/lib/token"

const deudaSchema = z.object({
  proveedorId: z.string().min(1, "Seleccione un proveedor"),
  montoCapital: z.coerce.number().positive("El monto debe ser mayor que cero"),
  moneda: z.string().min(1, "Seleccione la moneda"),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
})

type DeudaFormValues = z.infer<typeof deudaSchema>

interface DeudaCashFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedores?: Array<{ vendorId: string; nombre: string }>
  onSuccess?: () => void
}

/**
 * @description Formulario para crear nuevas deudas en efectivo.
 * @param {DeudaCashFormProps} props - Props del componente.
 * @returns {JSX.Element} Formulario de deuda cash.
 */
export function DeudaCashForm({ open, onOpenChange, proveedores = [], onSuccess }: DeudaCashFormProps) {
  const [createDeuda, { isLoading }] = useCreateDeudaCashMutation()
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleComprobanteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      sileo.error({ title: 'Solo se aceptan imágenes (JPG, PNG, WEBP)' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      sileo.error({ title: 'La imagen no puede superar 5 MB' })
      return
    }
    setComprobante(file)
    setComprobantePreview(URL.createObjectURL(file))
  }

  const clearComprobante = () => {
    setComprobante(null)
    setComprobantePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const form = useForm<DeudaFormValues>({
    resolver: zodResolver(deudaSchema),
    defaultValues: {
      montoCapital: 0,
      moneda: "CUP",
    },
  })

  const onSubmit = async (data: DeudaFormValues) => {
    try {
      let comprobanteUrl: string | undefined

      if (comprobante) {
        setUploadingImg(true)
        const fd = new FormData()
        fd.append('file', comprobante)
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
          headers: { Authorization: getAuthToken() },
        })
        setUploadingImg(false)
        if (!uploadRes.ok) {
          sileo.error({ title: 'No se pudo subir el comprobante. Intentá de nuevo.' })
          return
        }
        const uploadData = await uploadRes.json()
        comprobanteUrl = uploadData.url
      }

      await createDeuda({
        proveedorId: data.proveedorId,
        montoCapital: data.montoCapital,
        moneda: data.moneda,
        tasaInteres: data.tasaInteres,
        fechaVencimiento: data.fechaVencimiento || undefined,
        observaciones: data.observaciones || undefined,
        comprobanteUrl,
      }).unwrap()

      sileo.success({ title: "Deuda en efectivo registrada exitosamente." })
      form.reset()
      clearComprobante()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      setUploadingImg(false)
      sileo.error({ title: error?.data?.error || "No se pudo registrar la deuda" })
    }
  }

  const handleClose = () => {
    form.reset()
    clearComprobante()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Deuda en Efectivo</DialogTitle>
          <DialogDescription>
            Registre una deuda de dinero en efectivo con un proveedor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { sileo.error({ title: 'Completá los campos requeridos antes de continuar.' }) })} className="space-y-4">
            <FormField
              control={form.control}
              name="proveedorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un proveedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {proveedores.map((p) => (
                        <SelectItem key={p.vendorId} value={p.vendorId}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="montoCapital"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto de la Deuda</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CUP">CUP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MLC">MLC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tasaInteres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de Interés % (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fechaVencimiento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comprobante de deuda — opcional */}
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Comprobante (Opcional)</p>
              {comprobantePreview ? (
                <div className="relative w-full rounded-md border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comprobantePreview}
                    alt="Vista previa del comprobante"
                    className="w-full max-h-48 object-contain bg-muted"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={clearComprobante}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="px-2 py-1 text-xs text-muted-foreground truncate bg-muted/50">
                    {comprobante?.name}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="rounded-full bg-muted p-2">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Subir foto del comprobante</span>
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · Máx. 5 MB</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleComprobanteChange}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || uploadingImg}>
                {(isLoading || uploadingImg) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Deuda
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
