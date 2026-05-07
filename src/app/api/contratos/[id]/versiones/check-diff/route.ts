import { NextRequest } from 'next/server'
import { checkContratoVersionDiffHandler } from '@/features/contratos/api/handlers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return checkContratoVersionDiffHandler(req, { params })
}
