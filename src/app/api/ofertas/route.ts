import { NextRequest } from 'next/server'
import { getOfertasHandler, createOfertaHandler } from '@/features/ofertas/api/handlers'

export async function GET(request: NextRequest) {
  return getOfertasHandler(request)
}

export async function POST(request: NextRequest) {
  return createOfertaHandler(request)
}
