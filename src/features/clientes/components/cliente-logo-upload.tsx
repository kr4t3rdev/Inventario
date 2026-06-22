'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { uploadToCloudinary } from '@/lib/upload/cloudinary-upload'

interface ClienteLogoUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function ClienteLogoUpload({ value, onChange, disabled }: ClienteLogoUploadProps) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]

    if (file.size > MAX_FILE_SIZE) {
      toast.error('La imagen debe ser menor a 2MB')
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPEG, PNG, WEBP)')
      return
    }

    setUploading(true)

    try {
      const url = await uploadToCloudinary(file, 'clientes/logo')
      onChange(url)
      toast.success('Logo subido correctamente')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Error al subir el logo')
    } finally {
      setUploading(false)
    }
  }, [onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    disabled: disabled || uploading,
  })

  const handleRemove = () => {
    onChange(null)
  }

  if (value) {
    return (
      <div className="space-y-4">
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-muted">
          <img
            src={value}
            alt="Logo del cliente"
            className="w-full h-full object-contain bg-white"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              title="Eliminar logo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Haga clic en la X para cambiar el logo
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${uploading || disabled ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-full bg-muted">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="text-sm">
            {isDragActive ? (
              <p className="font-medium text-primary">Suelte la imagen aquí...</p>
            ) : (
              <>
                <p className="font-medium">Haga clic o arrastre el logo aquí</p>
                <p className="text-muted-foreground text-xs mt-1">
                  JPEG, PNG o WEBP (máx. 2MB)
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
