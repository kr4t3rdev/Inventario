export interface Licencia {
  licenciaId: string
  clave: string
  usuarioId: string
  planId: string
  activa: boolean
  inicio: Date
  expiracion: Date
  createdAt: Date
  updatedAt: Date
  usuario?: { userId: string; name: string | null; email: string | null }
  plan?: Record<string, unknown>
}
