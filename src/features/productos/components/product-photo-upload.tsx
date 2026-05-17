'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getAuthToken } from '@/lib/token'

interface ProductPhotoUploadProps {
  photos: string[]
  onPhotosChange: (photos: string[]) => void
  maxPhotos?: number
  maxFileSize?: number // Tamaño máximo en bytes
}

const DEFAULT_MAX_PHOTOS = 1
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB en bytes

export function ProductPhotoUpload({ 
  photos, 
  onPhotosChange, 
  maxPhotos = DEFAULT_MAX_PHOTOS,
  maxFileSize = DEFAULT_MAX_FILE_SIZE 
}: ProductPhotoUploadProps) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // Check if adding these files would exceed the limit
    if (photos.length + acceptedFiles.length > maxPhotos) {
      toast.error(`Máximo ${maxPhotos} fotos permitidas`)
      return
    }

    setUploading(true)
    
    const uploadedUrls: string[] = []

    for (const file of acceptedFiles) {
      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} no es una imagen válida`)
          continue
        }

        // Validate file size (max 2MB)
        if (file.size > maxFileSize) {
          toast.error(`${file.name} excede el tamaño máximo de 2MB`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)

        // Upload file to existing upload endpoint
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': getAuthToken(),
          },
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file')
        }
        
        const uploadData = await uploadRes.json()
        uploadedUrls.push(uploadData.url)
        
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(`Error al subir ${file.name}`)
      }
    }

    setUploading(false)
    
    if (uploadedUrls.length > 0) {
      onPhotosChange([...photos, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} foto(s) subida(s) correctamente`)
    }
  }, [photos, onPhotosChange, maxPhotos, maxFileSize])

  const removePhoto = (indexToRemove: number) => {
    const newPhotos = photos.filter((_, index) => index !== indexToRemove)
    onPhotosChange(newPhotos)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    disabled: uploading || photos.length >= maxPhotos
  })

  return (
    <div className="w-full space-y-4">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo} className="relative group aspect-square">
              <img
                src={photo}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      {photos.length < maxPhotos && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
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
                <p className="font-medium text-primary">Suelte las imágenes aquí...</p>
              ) : (
                <>
                  <p className="font-medium">Haga clic o arrastre una imagen aquí</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {photos.length === 0 ? 'Máximo 1 foto' : '1 foto subida'} - PNG, JPG, WEBP (máx 2MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
