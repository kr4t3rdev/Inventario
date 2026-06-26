"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { useState, useRef, type ChangeEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createDeudaCashAction } from "@/features/contabilidad/actions-deudas-cash"
import { ImageIcon, Loader2, TrendingUp, Upload, X } from "lucide-react"
import { toast } from "sonner"
import type { CloudinaryAssetUploadResult } from "@/lib/upload/cloudinary-asset"
import {
  toCloudinaryAssetUploadResult,
  uploadAsset,
} from "@/lib/upload/upload-asset"
import { calcularTotalDeudaConInteres } from "@/lib/utils/deuda-cash"
import { useAuth } from "@/contexts/auth-context"
import { hasPlanFeature } from "@/lib/plan-access"

const deudaSchema = z.object({
  proveedorId: z.string().min(1, "Seleccione un proveedor"),
  montoCapital: z.coerce.number().positive("El monto debe ser mayor que cero"),
  moneda: z.string().min(1, "Seleccione la moneda"),
  tasaInteres: z.coerce.number().min(0).optional(),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  cuentaBancariaId: z.string({ required_error: "Seleccione una cuenta bancaria" }).min(1, "Seleccione una cuenta bancaria"),
})

type DeudaFormValues = z.infer<typeof deudaSchema>

/**
 * @description Panel reactivo con el resumen financiero de la deuda.
 * Muestra capital, interés, total y cuotas estimadas diaria/semanal/mensual.
 * @param {{ control: any }} props - Control de react-hook-form.
 * @returns {JSX.Element | null} Panel de resumen o null si no hay monto.
 */
function CuotasEstimadasDeuda({ control }: { control: any }) {
  const montoCapital = useWatch({ control, name: 'montoCapital' })
  const tasaInteres = useWatch({ control, name: 'tasaInteres' })
  const fechaVencimiento = useWatch({ control, name: 'fechaVencimiento' })
  const moneda = useWatch({ control, name: 'moneda' })

  const monto = Number(montoCapital) || 0
  const tasa = Number(tasaInteres) || 0

  if (monto <= 0) return null

  const totalConInteres = calcularTotalDeudaConInteres(monto, tasa)
  const interes = totalConInteres - monto

  let dias = 0
  if (fechaVencimiento) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const vencimiento = new Date(fechaVencimiento)
    dias = Math.max(1, Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const fmt = (n: number) =>
    n.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const cuotaDiaria = dias > 0 ? totalConInteres / dias : null

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <TrendingUp className="h-4 w-4 text-primary" />
        Resumen de la deuda
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Capital</span>
          <span className="font-medium">{fmt(monto)} {moneda}</span>
        </div>
        {tasa > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interés ({tasa}%)</span>
            <span className="font-medium text-amber-500">+{fmt(interes)} {moneda}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2">
          <span>Total a pagar</span>
          <span className="text-primary">{fmt(totalConInteres)} {moneda}</span>
        </div>
      </div>

      {cuotaDiaria !== null && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Cuota fija estimada ({dias} días)</p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800">
              Diaria &middot; {fmt(cuotaDiaria)} {moneda}
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
              Semanal &middot; {fmt(cuotaDiaria * 7)} {moneda}
            </Badge>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-400 dark:border-violet-800">
              Mensual &middot; {fmt(cuotaDiaria * 30)} {moneda}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}

interface DeudaCashFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedores?: Array<{ vendorId: string; nombre: string }>
  cuentasBancarias?: Array<{ cuentaId: string; nombreBanco: string; tipoCuenta: string; moneda: string }>
  onSuccess?: () => void
}

/**
 * @description Formulario para crear nuevas deudas en efectivo.
 * @param {DeudaCashFormProps} props - Props del componente.
 * @returns {JSX.Element} Formulario de deuda cash.
 */
export function DeudaCashForm({ open, onOpenChange, proveedores = [], cuentasBancarias = [], onSuccess }: DeudaCashFormProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comprobanteAsset, setComprobanteAsset] = useState<CloudinaryAssetUploadResult | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleComprobanteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se aceptan imágenes (JPG, PNG, WEBP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB')
      return
    }
    setComprobante(file)
    setComprobantePreview(URL.createObjectURL(file))
  }

  const clearComprobante = () => {
    setComprobante(null)
    setComprobanteAsset(null)
    setComprobantePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const form = useForm<DeudaFormValues>({
    resolver: zodResolver(deudaSchema),
    defaultValues: {
      proveedorId: "",
      montoCapital: 0,
      moneda: "CUP",
      tasaInteres: 0,
      fechaVencimiento: "",
      observaciones: "",
      cuentaBancariaId: "",
    },
  })

  const montoCapital = useWatch({ control: form.control, name: 'montoCapital' })
  const tasaInteres = useWatch({ control: form.control, name: 'tasaInteres' })
  const saldoPendientePreview = calcularTotalDeudaConInteres(Number(montoCapital) || 0, Number(tasaInteres) || 0)
  const canUploadReceipt = hasPlanFeature(user, 'upload-deudas-cash-receipt')

  const onSubmit = async (data: DeudaFormValues) => {
    try {
      let comprobanteUrl: string | undefined
      let uploadedAsset: CloudinaryAssetUploadResult | null = comprobanteAsset

      if (comprobante) {
        setUploadingImg(true)
        const uploaded = await uploadAsset(comprobante, {
          uploadKey: 'deudasCash.receipt',
        })
        const asset = toCloudinaryAssetUploadResult(uploaded)
        comprobanteUrl = uploaded.url
        uploadedAsset = asset
        setComprobanteAsset(asset)
        setUploadingImg(false)
      }

      const result = await createDeudaCashAction({
        proveedorId: data.proveedorId,
        montoCapital: data.montoCapital,
        moneda: data.moneda,
        tasaInteres: data.tasaInteres || undefined,
        fechaVencimiento: data.fechaVencimiento || undefined,
        observaciones: data.observaciones || undefined,
        comprobanteUrl,
        comprobanteAsset: uploadedAsset,
        cuentaBancariaId: data.cuentaBancariaId,
      })

      if (!result.success) {
        toast.error(result.error?.message || "No se pudo registrar la deuda")
        return
      }

      toast.success("Deuda en efectivo registrada exitosamente.")
      form.reset()
      clearComprobante()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      setUploadingImg(false)
      toast.error("No se pudo registrar la deuda")
    }
  }

  const handleClose = () => {
    form.reset()
    clearComprobante()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nueva Deuda en Efectivo</DialogTitle>
          <DialogDescription>
            Registre una deuda de dinero en efectivo con un proveedor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, () => { toast.error('Completá los campos requeridos antes de continuar.') })} className="space-y-4 overflow-y-auto flex-1 pr-1">
            {Number(montoCapital) > 0 && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo a pagar</span>
                  <span className="font-semibold text-primary">{saldoPendientePreview.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.watch('moneda')}</span>
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name="cuentaBancariaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta bancaria destino</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione la cuenta de destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cuentasBancarias.map((c) => (
                        <SelectItem key={c.cuentaId} value={c.cuentaId}>
                          {c.nombreBanco} · {c.tipoCuenta} ({c.moneda})
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
                    <CurrencyInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
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
                    <CurrencyInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <CuotasEstimadasDeuda control={form.control} />

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

            {canUploadReceipt && (
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
            )}

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
