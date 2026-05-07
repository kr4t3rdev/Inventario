import { NextRequest } from 'next/server'
import { getContratoArchivosHandler, createContratoArchivoHandler } from '@/features/contratos/api/handlers'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getContratoArchivosHandler(req, context)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createContratoArchivoHandler(request, { params })
}
