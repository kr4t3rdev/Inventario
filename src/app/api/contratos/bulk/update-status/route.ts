import { NextRequest } from 'next/server'
import { bulkUpdateContratoStatusHandler } from '@/features/contratos/api/handlers'

export async function POST(req: NextRequest) {
  return bulkUpdateContratoStatusHandler(req)
}
