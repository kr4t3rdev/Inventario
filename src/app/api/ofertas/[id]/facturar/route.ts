import { NextRequest } from 'next/server'
import { facturarOfertaHandler } from '@/features/ofertas/api/handlers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return facturarOfertaHandler(request, { params })
}
