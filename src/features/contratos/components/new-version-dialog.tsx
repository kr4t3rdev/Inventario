'use client'

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { getAuthToken } from "@/lib/token"
import { Upload, FileUp, Loader2, AlertTriangle, FileCheck, Sparkles, FileText } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface NewVersionDialogProps {
  contratoId: string
  onSuccess: () => void
}

export function NewVersionDialog({ contratoId, onSuccess }: NewVersionDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // State for diff check result
  const [diffResult, setDiffResult] = useState<{
    hasChanges: boolean
    message: string
    diffSummary: string | null
    isFirst?: boolean
  } | null>(null)

  const [cambios, setCambios] = useState("")

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const selectedFile = acceptedFiles[0]
    setFile(selectedFile)
    setDiffResult(null)
    setCambios("")
    
    // Check Diff
    setIsChecking(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`/api/contratos/${contratoId}/versiones/check-diff`, {
        method: 'POST',
        headers: { 'Authorization': getAuthToken() },
        body: formData
      })
      
      if (!res.ok) throw new Error('Error checking diff')
      
      const data = await res.json()
      setDiffResult(data)
      
      if (data.diffSummary) {
        setCambios(data.diffSummary)
      } else if (data.hasChanges && !data.isFirst) {
        // If changes detected but no text diff (binary file), prompt user
        setCambios("Se han detectado modificaciones en el documento. (Describa los cambios aquí)")
      } else if (data.isFirst) {
        setCambios("Versión inicial del documento.")
      }

    } catch (error) {
      console.error(error)
      toast.error("Error al analizar el archivo")
    } finally {
      setIsChecking(false)
    }
  }, [contratoId])

  const handleSubmit = async () => {
    if (!file) return
    
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('cambios', cambios)

      const res = await fetch(`/api/contratos/${contratoId}/versiones`, {
        method: 'POST',
        headers: { 'Authorization': getAuthToken() },
        body: formData
      })

      if (!res.ok) throw new Error('Error creating version')

      toast.success("Nueva versión creada exitosamente")
      setOpen(false)
      setFile(null)
      setDiffResult(null)
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error("Error al subir nueva versión")
    } finally {
      setIsSubmitting(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    maxFiles: 1,
    disabled: isChecking || isSubmitting
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
            <FileUp className="h-4 w-4" />
            Nueva Versión
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] border-dashed">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                className="w-8 h-8 bg-linear-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
              >
                <FileText className="h-4 w-4 text-white" />
              </motion.div>
              Subir Nueva Versión
              <motion.div
                className="absolute right-10 top-4"
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </motion.div>
            </DialogTitle>
            <DialogDescription>
              Suba el documento modificado. El sistema verificará si hay cambios respecto a la versión anterior.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div
                    {...getRootProps()}
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                      ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                    `}
                  >
                    <input {...getInputProps()} />
                    <motion.div 
                      className="flex flex-col items-center gap-2"
                      animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium text-sm">Arrastre el archivo o haga clic para seleccionar</p>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="file-details"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="border border-dashed rounded-lg p-4 space-y-4 dark:border-gray-700"
                >
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <motion.div 
                          className="p-2 bg-primary/10 rounded"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          <FileCheck className="h-5 w-5 text-primary" />
                        </motion.div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Cambiar</Button>
                   </div>

                   {isChecking && (
                     <motion.div 
                       className="flex items-center gap-2 text-sm text-muted-foreground"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                     >
                       <Loader2 className="h-4 w-4 animate-spin" /> Analizando cambios...
                     </motion.div>
                   )}

                   {!isChecking && diffResult && (
                     <motion.div 
                       className={`p-3 rounded text-sm ${diffResult.hasChanges ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                     >
                        <div className="flex items-start gap-2">
                          {diffResult.hasChanges ? <AlertTriangle className="h-4 w-4 mt-0.5" /> : <FileCheck className="h-4 w-4 mt-0.5" />}
                          <div>
                            <p className="font-medium">{diffResult.message}</p>
                            {diffResult.hasChanges && !diffResult.diffSummary && !diffResult.isFirst && (
                              <p className="text-xs mt-1">
                                El sistema ha detectado que el archivo es diferente (binario). Por favor describa los cambios abajo.
                              </p>
                            )}
                             {diffResult.diffSummary && (
                              <p className="text-xs mt-1 font-mono bg-white/50 dark:bg-black/20 p-1 rounded">
                                {diffResult.diffSummary}
                              </p>
                            )}
                          </div>
                        </div>
                     </motion.div>
                   )}

                   <AnimatePresence>
                     {diffResult?.hasChanges && (
                       <motion.div 
                         className="space-y-2"
                         initial={{ opacity: 0, height: 0 }}
                         animate={{ opacity: 1, height: "auto" }}
                         exit={{ opacity: 0, height: 0 }}
                       >
                         <label className="text-sm font-medium">Descripción de Cambios</label>
                         <Textarea 
                           value={cambios}
                           onChange={(e) => setCambios(e.target.value)}
                           placeholder="Describa qué se modificó en esta versión..."
                           className="min-h-25 transition-all duration-200 focus:scale-[1.01]"
                         />
                       </motion.div>
                     )}
                   </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!file || isChecking || isSubmitting || (!!diffResult && !diffResult.hasChanges)}
              className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Crear Versión"
              )}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
