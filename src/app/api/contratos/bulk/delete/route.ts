import { NextRequest } from 'next/server'
import { bulkDeleteContratosHandler } from '@/features/contratos/api/handlers'

export async function POST(req: NextRequest) {
  return bulkDeleteContratosHandler(req)
}
