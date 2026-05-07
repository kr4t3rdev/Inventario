import { NextRequest } from 'next/server'
import { getOfertaByIdHandler, updateOfertaHandler, deleteOfertaHandler } from '@/features/ofertas/api/handlers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return getOfertaByIdHandler(request, { params })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return updateOfertaHandler(request, { params })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return deleteOfertaHandler(request, { params })
}
