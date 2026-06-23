'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { getAuthToken } from '@/lib/token'
import { uploadToCloudinary } from '@/lib/upload/cloudinary-upload'

interface FileUploadProps {
  contratoId: string
  onUploadComplete?: () => void
}

export function FileUpload({ contratoId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    setUploading(true)
    setProgress(0)
    
    let successCount = 0
    const totalFiles = acceptedFiles.length

    for (const file of acceptedFiles) {
      try {
        // 1. Upload file a Cloudinary (signed upload directo del cliente)
        const asset = await uploadToCloudinary(file, {
          uploadKey: 'contratos.attachment',
          entityId: contratoId,
        })

        // 2. Link to contract
        const linkRes = await fetch(`/api/contratos/${contratoId}/archivos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
             'Authorization': getAuthToken(),
          },
          body: JSON.stringify({
            tipo: 'ANEXO', // Default type
            rutaArchivo: asset.secureUrl,
            cloudinaryPublicId: asset.publicId,
            mimeType: asset.mimeType,
            bytes: asset.bytes,
            nombreArchivo: file.name,
            versionId: null, // Optional
            generadoPor: 'USER', // This should be handled by backend from token actually
          })
        })

        if (!linkRes.ok) throw new Error('Failed to link file')
        
        successCount++
        setProgress((successCount / totalFiles) * 100)
        
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(`Error al subir ${file.name}`)
      }
    }

    setUploading(false)
    if (successCount > 0) {
      toast.success(`${successCount} archivos subidos correctamente`)
      if (onUploadComplete) onUploadComplete()
    }
  }, [contratoId, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className="p-4 rounded-full bg-muted">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="text-sm">
            {isDragActive ? (
              <p className="font-medium text-primary">Suelte los archivos aquí...</p>
            ) : (
              <>
                <p className="font-medium">Haga clic o arrastre archivos aquí</p>
                <p className="text-muted-foreground text-xs mt-1">Soporta PDF, Imágenes, DOCX</p>
              </>
            )}
          </div>
        </div>
      </div>
      
      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subiendo...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  )
}
