import { NextRequest, NextResponse } from 'next/server'
import { updateCuentaPorCobrarHandler } from "@/features/contabilidad/api/handlers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return updateCuentaPorCobrarHandler(request, { params })
}
